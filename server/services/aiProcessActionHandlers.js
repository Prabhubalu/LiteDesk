'use strict';

/**
 * Process-designer AI actions: propose-only structured outputs into dataBag.
 * Never auto-apply field patches, route records, or send communications.
 * Downstream update_record / approval_gate steps remain human-gated.
 */

const { buildScope, resolveExpression } = require('../utils/processFieldValueResolver');
const { isAiSuiteEntitledForOrg } = require('../utils/addonAccessUtils');
const { AiConfigurationError } = require('./ai/errors');

// Legacy AI classify/extract services removed with Astra v2 cutover.
// Default handlers now soft-fail with a clear error; callers may inject test doubles via deps.
function classifyText() {
  throw new AiConfigurationError(
    'AI classify capability has been removed',
    'AI_CAPABILITY_REMOVED'
  );
}
function extractFields() {
  throw new AiConfigurationError(
    'AI extract capability has been removed',
    'AI_CAPABILITY_REMOVED'
  );
}

function ensureDataBag(ctx) {
  if (!ctx.dataBag || typeof ctx.dataBag !== 'object') {
    ctx.dataBag = {};
  }
  return ctx.dataBag;
}

function resolveTextParam(raw, ctx) {
  if (raw == null) return '';
  const scope = buildScope(ctx);
  return String(resolveExpression(String(raw), scope) || '').trim();
}

function parseLabels(raw) {
  if (Array.isArray(raw)) {
    return raw.map((l) => String(l).trim()).filter(Boolean);
  }
  return String(raw || '')
    .split(/[\n,]/)
    .map((l) => l.trim())
    .filter(Boolean);
}

async function assertAiReady(organizationId, isEntitledFn = isAiSuiteEntitledForOrg) {
  if (!organizationId) {
    throw new AiConfigurationError('organizationId is required', 'ORGANIZATION_REQUIRED');
  }
  const entitled = await isEntitledFn(organizationId);
  if (!entitled) {
    throw new AiConfigurationError(
      'Arivu AI is not installed or active for this organization',
      'AI_SUITE_NOT_ENTITLED'
    );
  }
}

/**
 * ai_classify — classify untrusted text into caller-supplied labels; store in dataBag.
 * @param {object} [deps] optional test doubles
 */
async function aiClassifyAction(ctx, params, deps = {}) {
  const classifyFn = deps.classifyText || classifyText;
  const isEntitledFn = deps.isAiSuiteEntitledForOrg || isAiSuiteEntitledForOrg;

  const variableName =
    params?.variableName != null ? String(params.variableName).trim() : 'aiClassification';
  if (!variableName) return { ok: false, error: 'ai_classify requires variableName' };

  const text = resolveTextParam(params?.text, ctx);
  if (!text) return { ok: false, error: 'ai_classify requires text' };

  const labels = parseLabels(params?.labels);
  if (labels.length < 2) {
    return { ok: false, error: 'ai_classify requires at least two labels' };
  }

  const fallbackLabel =
    params?.fallbackLabel != null ? String(params.fallbackLabel).trim() : labels[0];
  const sourceType =
    params?.sourceType != null ? String(params.sourceType).trim() : ctx.entityType || 'text';
  const sourceId =
    params?.sourceId != null
      ? String(resolveTextParam(params.sourceId, ctx) || '').trim() || null
      : ctx.entityId
        ? String(ctx.entityId)
        : null;

  try {
    await assertAiReady(ctx.organizationId, isEntitledFn);
    const result = await classifyFn({
      organizationId: ctx.organizationId,
      userId: ctx.triggeredBy || ctx.userId || null,
      labels,
      fallbackLabel,
      text,
      sourceType,
      sourceId,
    });

    const bag = ensureDataBag(ctx);
    bag[variableName] = {
      label: result.label,
      confidence: result.confidence,
      rationale: result.rationale,
      matched: result.matched,
      confirmRequired: true,
    };
    bag[`${variableName}__meta`] = {
      abilityKey: 'classify',
      provider: result.provider,
      model: result.model,
      keyMode: result.keyMode,
      allowedLabels: result.allowedLabels,
      at: new Date().toISOString(),
    };

    return {
      ok: true,
      variableName,
      label: result.label,
      confidence: result.confidence,
      confirmRequired: true,
    };
  } catch (err) {
    return {
      ok: false,
      error: err.message || String(err),
      code: err.code || 'AI_CLASSIFY_FAILED',
    };
  }
}

/**
 * ai_extract — propose field patches from text; store in dataBag (never writes records).
 * @param {object} [deps] optional test doubles
 */
async function aiExtractAction(ctx, params, deps = {}) {
  const extractFn = deps.extractFields || extractFields;
  const isEntitledFn = deps.isAiSuiteEntitledForOrg || isAiSuiteEntitledForOrg;

  const variableName =
    params?.variableName != null ? String(params.variableName).trim() : 'aiPatches';
  if (!variableName) return { ok: false, error: 'ai_extract requires variableName' };

  const text = resolveTextParam(params?.text, ctx);
  if (!text) return { ok: false, error: 'ai_extract requires text' };

  const moduleKey =
    params?.moduleKey != null
      ? String(params.moduleKey).trim().toLowerCase()
      : String(ctx.entityType || 'people').toLowerCase();
  const recordId =
    params?.recordId != null
      ? String(resolveTextParam(params.recordId, ctx) || '').trim() || null
      : ctx.entityId
        ? String(ctx.entityId)
        : null;

  try {
    await assertAiReady(ctx.organizationId, isEntitledFn);
    const result = await extractFn({
      organizationId: ctx.organizationId,
      userId: ctx.triggeredBy || ctx.userId || null,
      moduleKey,
      recordId,
      text,
    });

    const bag = ensureDataBag(ctx);
    bag[variableName] = Array.isArray(result.patches) ? result.patches : [];
    bag[`${variableName}__raw`] = result.rawText || '';
    bag[`${variableName}__meta`] = {
      abilityKey: 'extract_fields',
      provider: result.provider,
      model: result.model,
      keyMode: result.keyMode,
      confirmRequired: true,
      moduleKey,
      recordId,
      at: new Date().toISOString(),
    };

    return {
      ok: true,
      variableName,
      patchCount: bag[variableName].length,
      confirmRequired: true,
    };
  } catch (err) {
    return {
      ok: false,
      error: err.message || String(err),
      code: err.code || 'AI_EXTRACT_FAILED',
    };
  }
}

module.exports = {
  aiClassifyAction,
  aiExtractAction,
  parseLabels,
  resolveTextParam,
};
