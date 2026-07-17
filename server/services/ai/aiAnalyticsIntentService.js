'use strict';

/**
 * Phase 4 Analytics intent AI — map a natural-language question to existing
 * saved reports the user can already view. Suggest-only: never builds or runs
 * ad-hoc queries; every suggested reportId must come from the visible-report
 * allow-list resolved through analyticsReportAccessService.
 */

const AnalyticsReport = require('../../models/AnalyticsReport');
const {
  buildReportListVisibilityFilter,
} = require('../analytics/analyticsReportAccessService');
const { getLlmAdapter } = require('./providerRegistry');
const { resolveAiRequestConfig } = require('./aiSettingsResolver');
const { assertCreditsAvailable, debitCredits } = require('./aiCreditService');
const { writeAiAuditLog } = require('./aiAuditLogService');
const { redactMessages } = require('./piiRedaction');
const { getPrompt } = require('./prompts/promptRegistry');
const { AiConfigurationError } = require('./errors');

const MAX_CANDIDATES = 60;
const MAX_MATCHES = 5;

function buildReportCandidates(reports) {
  return (Array.isArray(reports) ? reports : [])
    .map((r) => ({
      reportId: String(r._id || ''),
      name: String(r.name || '').slice(0, 120),
      description: String(r.description || '').slice(0, 200),
      type: String(r.type || ''),
      primaryModule: String(r.primaryModule || ''),
    }))
    .filter((r) => r.reportId && r.name)
    .slice(0, MAX_CANDIDATES);
}

/**
 * Parse LLM output and constrain matches to the candidate reportId allow-list.
 */
function parseIntentSuggestions(text, candidates) {
  const byId = new Map(candidates.map((c) => [c.reportId, c]));
  const raw = String(text || '').trim();
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return { interpretation: '', matches: [] };
  try {
    const parsed = JSON.parse(match[0]);
    const rows = Array.isArray(parsed?.matches) ? parsed.matches : [];
    const seen = new Set();
    const matches = [];
    for (const row of rows) {
      const reportId = String(row?.reportId || '').trim();
      if (!reportId || !byId.has(reportId) || seen.has(reportId)) continue;
      seen.add(reportId);
      const candidate = byId.get(reportId);
      matches.push({
        reportId,
        name: candidate.name,
        type: candidate.type,
        primaryModule: candidate.primaryModule,
        confidence: Math.max(0, Math.min(1, Number(row.confidence) || 0)),
        rationale: String(row.rationale || '').slice(0, 200),
      });
      if (matches.length >= MAX_MATCHES) break;
    }
    return {
      interpretation: String(parsed?.interpretation || '').slice(0, 300),
      matches,
    };
  } catch {
    return { interpretation: '', matches: [] };
  }
}

async function suggestAnalyticsIntent({ organizationId, userId, user, question }) {
  const startedAt = Date.now();
  const normalizedQuestion = String(question || '').trim().slice(0, 500);
  if (!normalizedQuestion) {
    throw new AiConfigurationError('question is required', 'AI_ANALYTICS_QUESTION_REQUIRED');
  }

  const visibilityFilter = await buildReportListVisibilityFilter(user, organizationId);
  const reports = await AnalyticsReport.find({
    $and: [{ organizationId }, visibilityFilter],
  })
    .sort({ updatedAt: -1 })
    .limit(MAX_CANDIDATES)
    .select('name description type primaryModule')
    .lean();

  const candidates = buildReportCandidates(reports);
  if (!candidates.length) {
    return {
      interpretation: '',
      matches: [],
      noReports: true,
      confirmRequired: true,
      autoApply: false,
    };
  }

  let auditBase = {
    organizationId,
    userId,
    abilityKey: 'analytics_intent',
    provider: 'unknown',
    model: 'unknown',
    keyMode: 'platform',
  };

  try {
    const config = await resolveAiRequestConfig({ organizationId, abilityKey: 'analytics_intent' });
    auditBase = {
      ...auditBase,
      provider: config.provider,
      model: config.model,
      keyMode: config.keyMode,
    };
    assertCreditsAvailable({ keyMode: config.keyMode, creditsBalance: config.creditsBalance });

    const systemPrompt = getPrompt('analytics_intent_system');
    const adapter = getLlmAdapter(config.provider);
    const completion = await adapter.complete({
      apiKey: config.apiKey,
      model: config.model,
      messages: redactMessages([
        { role: 'system', content: systemPrompt.text },
        {
          role: 'user',
          content: [
            `Question: ${normalizedQuestion}`,
            `Available saved reports (JSON):\n${JSON.stringify(candidates)}`,
            'Return JSON only: {"interpretation":"short restatement of what the user wants","matches":[{"reportId":"...","confidence":0-1,"rationale":"..."}]}.',
            'Only use reportIds from the available list. Return at most 5 matches. Return an empty matches array if nothing fits.',
          ].join('\n'),
        },
      ]),
      temperature: 0.1,
      maxTokens: 600,
      providerOptions: config.providerOptions,
    });

    const { interpretation, matches } = parseIntentSuggestions(completion.text, candidates);
    const creditsDebited = await debitCredits({
      organizationId,
      keyMode: config.keyMode,
      usage: completion.usage,
    });

    await writeAiAuditLog({
      ...auditBase,
      status: 'success',
      promptVersion: systemPrompt.version,
      contextRefs: matches.map((m) => ({
        sourceType: 'analytics_report',
        sourceId: m.reportId,
        moduleKey: m.primaryModule || null,
      })),
      usage: completion.usage,
      creditsDebited,
      latencyMs: Date.now() - startedAt,
    });

    return {
      interpretation,
      matches,
      noReports: false,
      confirmRequired: true,
      autoApply: false,
      provider: config.provider,
      model: config.model,
      keyMode: config.keyMode,
      creditsDebited,
      usage: completion.usage,
    };
  } catch (error) {
    await writeAiAuditLog({
      ...auditBase,
      status: 'failed',
      latencyMs: Date.now() - startedAt,
      errorCode: error.code || 'AI_ANALYTICS_INTENT_FAILED',
      errorMessage: error.message,
    });
    throw error;
  }
}

module.exports = {
  suggestAnalyticsIntent,
  parseIntentSuggestions,
  buildReportCandidates,
};
