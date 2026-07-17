'use strict';

/**
 * Phase 4 scheduled AI digest brief.
 * Preview/generation only: never emits notifications, schedules jobs, sends email,
 * or marks notifications read. Existing digestScheduler remains authoritative.
 */

const { aggregateDigest } = require('../notificationDigestService');
const { getLlmAdapter } = require('./providerRegistry');
const { resolveAiRequestConfig } = require('./aiSettingsResolver');
const { assertCreditsAvailable, debitCredits } = require('./aiCreditService');
const { writeAiAuditLog } = require('./aiAuditLogService');
const { redactMessages } = require('./piiRedaction');
const { getPrompt } = require('./prompts/promptRegistry');
const { AiConfigurationError } = require('./errors');

const ALLOWED_DIGEST_WINDOWS = new Set(['daily', 'weekly']);
const ALLOWED_APP_KEYS = new Set(['SALES', 'AUDIT', 'PORTAL']);

function normalizeDigestWindow(window) {
  const value = String(window || 'daily').trim().toLowerCase();
  return ALLOWED_DIGEST_WINDOWS.has(value) ? value : 'daily';
}

function resolveSinceDate(window, now = new Date()) {
  const days = normalizeDigestWindow(window) === 'weekly' ? 7 : 1;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function normalizeAppKey(appKey) {
  const value = String(appKey || 'SALES').trim().toUpperCase();
  return ALLOWED_APP_KEYS.has(value) ? value : 'SALES';
}

function parseDigestBriefJson(text) {
  const raw = String(text || '').trim();
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) {
    return { subject: '', summary: '', priorities: [], suggestedActions: [] };
  }
  try {
    const parsed = JSON.parse(match[0]);
    return {
      subject: String(parsed?.subject || '').slice(0, 120),
      summary: String(parsed?.summary || '').slice(0, 1200),
      priorities: (Array.isArray(parsed?.priorities) ? parsed.priorities : [])
        .map((p) => String(p || '').trim())
        .filter(Boolean)
        .slice(0, 5),
      suggestedActions: (Array.isArray(parsed?.suggestedActions) ? parsed.suggestedActions : [])
        .map((a) => String(a || '').trim())
        .filter(Boolean)
        .slice(0, 5),
    };
  } catch {
    return { subject: '', summary: '', priorities: [], suggestedActions: [] };
  }
}

async function generateDigestBrief({
  organizationId,
  userId,
  appKey = 'SALES',
  window = 'daily',
  now = new Date(),
  aggregateDigestFn = aggregateDigest,
}) {
  const startedAt = Date.now();
  const normalizedAppKey = normalizeAppKey(appKey);
  const normalizedWindow = normalizeDigestWindow(window);
  const sinceDate = resolveSinceDate(normalizedWindow, now);

  const digest = await aggregateDigestFn(userId, organizationId, normalizedAppKey, sinceDate);
  if (!digest || !Array.isArray(digest.items) || digest.items.length === 0) {
    return {
      subject: '',
      summary: '',
      priorities: [],
      suggestedActions: [],
      digest,
      appKey: normalizedAppKey,
      window: normalizedWindow,
      since: sinceDate.toISOString(),
      empty: true,
      confirmRequired: true,
      autoSend: false,
    };
  }

  let auditBase = {
    organizationId,
    userId,
    abilityKey: 'scheduled_digest',
    provider: 'unknown',
    model: 'unknown',
    keyMode: 'platform',
  };

  try {
    const config = await resolveAiRequestConfig({ organizationId, abilityKey: 'scheduled_digest' });
    auditBase = {
      ...auditBase,
      provider: config.provider,
      model: config.model,
      keyMode: config.keyMode,
    };
    assertCreditsAvailable({ keyMode: config.keyMode, creditsBalance: config.creditsBalance });

    const systemPrompt = getPrompt('scheduled_digest_system');
    const adapter = getLlmAdapter(config.provider);
    const completion = await adapter.complete({
      apiKey: config.apiKey,
      model: config.model,
      messages: redactMessages([
        { role: 'system', content: systemPrompt.text },
        {
          role: 'user',
          content: [
            `App: ${normalizedAppKey}`,
            `Window: ${normalizedWindow}`,
            `Since: ${sinceDate.toISOString()}`,
            `Deterministic digest:\n${JSON.stringify(digest)}`,
            'Return JSON only: {"subject":"...","summary":"...","priorities":["..."],"suggestedActions":["..."]}.',
            'Use only the provided digest data. Do not claim messages were sent or tasks were completed.',
          ].join('\n'),
        },
      ]),
      temperature: 0.2,
      maxTokens: 700,
      providerOptions: config.providerOptions,
    });

    const brief = parseDigestBriefJson(completion.text);
    const creditsDebited = await debitCredits({
      organizationId,
      keyMode: config.keyMode,
      usage: completion.usage,
    });

    await writeAiAuditLog({
      ...auditBase,
      status: 'success',
      promptVersion: systemPrompt.version,
      contextRefs: [{ sourceType: 'notification_digest', sourceId: normalizedWindow, moduleKey: normalizedAppKey }],
      usage: completion.usage,
      creditsDebited,
      latencyMs: Date.now() - startedAt,
    });

    return {
      ...brief,
      digest,
      appKey: normalizedAppKey,
      window: normalizedWindow,
      since: sinceDate.toISOString(),
      empty: false,
      confirmRequired: true,
      autoSend: false,
      provider: config.provider,
      model: config.model,
      keyMode: config.keyMode,
      creditsDebited,
      usage: completion.usage,
    };
  } catch (error) {
    await writeAiAuditLog({
      ...auditBase,
      status: error instanceof AiConfigurationError ? 'not_configured' : 'failed',
      latencyMs: Date.now() - startedAt,
      errorCode: error.code || 'AI_SCHEDULED_DIGEST_FAILED',
      errorMessage: error.message,
    });
    throw error;
  }
}

module.exports = {
  generateDigestBrief,
  parseDigestBriefJson,
  normalizeDigestWindow,
  normalizeAppKey,
  resolveSinceDate,
};
