'use strict';

const { getLlmAdapter } = require('./providerRegistry');
const { resolveAiRequestConfig } = require('./aiSettingsResolver');
const { assertCreditsAvailable, debitCredits } = require('./aiCreditService');
const { writeAiAuditLog } = require('./aiAuditLogService');
const { redactText } = require('./piiRedaction');
const { getPrompt } = require('./prompts/promptRegistry');
const { AiConfigurationError } = require('./errors');

/**
 * Parse a single-label classification result, constrained to allowed labels.
 * @param {string} text
 * @param {string[]} allowedLabels
 * @param {string} fallbackLabel
 */
function parseClassificationJson(text, allowedLabels, fallbackLabel) {
  const allowed = Array.isArray(allowedLabels) ? allowedLabels.map((l) => String(l)) : [];
  const fallback = fallbackLabel && allowed.includes(fallbackLabel) ? fallbackLabel : allowed[0] || '';
  const raw = String(text || '').trim();
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) {
    return { label: fallback, confidence: 0, rationale: '', matched: false };
  }
  try {
    const parsed = JSON.parse(match[0]);
    const proposed = String(parsed?.label || '').trim();
    const matched = allowed.includes(proposed);
    return {
      label: matched ? proposed : fallback,
      confidence: Math.max(0, Math.min(1, Number(parsed?.confidence) || 0)),
      rationale: String(parsed?.rationale || '').slice(0, 240),
      matched,
    };
  } catch {
    return { label: fallback, confidence: 0, rationale: '', matched: false };
  }
}

/**
 * Classify untrusted text into exactly one of the caller-supplied labels.
 * Propose-only: never routes, assigns, or mutates records.
 */
async function classifyText({
  organizationId,
  userId,
  labels,
  fallbackLabel = null,
  text,
  sourceType = 'text',
  sourceId = null,
}) {
  const startedAt = Date.now();
  const allowedLabels = Array.isArray(labels) ? labels.map((l) => String(l).trim()).filter(Boolean) : [];
  const sourceText = String(text || '').trim();
  if (allowedLabels.length < 2) {
    throw new AiConfigurationError('At least two labels are required', 'AI_LABELS_REQUIRED');
  }
  if (!sourceText) {
    throw new AiConfigurationError('text is required', 'AI_TEXT_REQUIRED');
  }
  const fallback = fallbackLabel && allowedLabels.includes(fallbackLabel) ? fallbackLabel : allowedLabels[0];

  let auditBase = {
    organizationId,
    userId,
    abilityKey: 'classify',
    provider: 'unknown',
    model: 'unknown',
    keyMode: 'platform',
  };

  try {
    const config = await resolveAiRequestConfig({ organizationId, abilityKey: 'classify' });
    auditBase = {
      ...auditBase,
      provider: config.provider,
      model: config.model,
      keyMode: config.keyMode,
    };
    assertCreditsAvailable({ keyMode: config.keyMode, creditsBalance: config.creditsBalance });

    const systemPrompt = getPrompt('classify_system');
    const adapter = getLlmAdapter(config.provider);
    const completion = await adapter.complete({
      apiKey: config.apiKey,
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt.text },
        {
          role: 'user',
          content: `Allowed labels: ${JSON.stringify(allowedLabels)}\nFallback label: ${fallback}\n\nUntrusted text to classify:\n${redactText(sourceText).slice(0, 5000)}`,
        },
      ],
      temperature: 0,
      maxTokens: 200,
      providerOptions: config.providerOptions,
    });

    const result = parseClassificationJson(completion.text, allowedLabels, fallback);
    const creditsDebited = await debitCredits({
      organizationId,
      keyMode: config.keyMode,
      usage: completion.usage,
    });

    await writeAiAuditLog({
      ...auditBase,
      status: 'success',
      promptVersion: systemPrompt.version,
      contextRefs: sourceId ? [{ sourceType, sourceId: String(sourceId), moduleKey: sourceType }] : [],
      usage: completion.usage,
      creditsDebited,
      latencyMs: Date.now() - startedAt,
    });

    return {
      label: result.label,
      confidence: result.confidence,
      rationale: result.rationale,
      matched: result.matched,
      allowedLabels,
      confirmRequired: true,
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
      errorCode: error.code || 'AI_CLASSIFY_FAILED',
      errorMessage: error.message,
    });
    throw error;
  }
}

module.exports = {
  classifyText,
  parseClassificationJson,
};
