'use strict';

/**
 * Resolve process action fieldValues (create_record / update_record).
 *
 * Entry shapes (backward compatible):
 *   "literal" | 123 | true
 *   { mode: 'raw', value }
 *   { mode: 'copy', source: 'first_name' | 'event.currentState.first_name' | 'dataBag.x' }
 *   { mode: 'expression', expression: 'uppercase(trigger.first_name)' }
 *     also supports mergetags: 'Hi {{trigger.first_name|uppercase}}'
 */

const { evaluateFormula, looksLikeFormula } = require('./processFormulaEvaluator');

const MERGE_TAG_RE = /\{\{\s*([^}]+?)\s*\}\}/g;

function getByPath(obj, path) {
  if (obj == null || path == null || path === '') return undefined;
  return String(path)
    .split('.')
    .reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function buildScope(ctx = {}) {
  const event = ctx.event || {};
  const currentState = event.currentState || {};
  const dataBag = ctx.dataBag && typeof ctx.dataBag === 'object' ? ctx.dataBag : {};
  const record =
    (dataBag.currentRecord && typeof dataBag.currentRecord === 'object'
      ? dataBag.currentRecord
      : null) || currentState;

  return {
    event,
    currentState,
    dataBag,
    record,
    trigger: record,
    entityId: ctx.entityId || event.entityId || null,
    entityType: ctx.entityType || event.entityType || null,
    now: new Date().toISOString()
  };
}

function applyPipeHelper(value, helperName) {
  const h = String(helperName || '')
    .trim()
    .toLowerCase();
  if (!h) return value;
  if (value == null) return value;
  const s = String(value);
  switch (h) {
    case 'uppercase':
    case 'upper':
      return s.toUpperCase();
    case 'lowercase':
    case 'lower':
      return s.toLowerCase();
    case 'trim':
      return s.trim();
    case 'string':
      return s;
    case 'number': {
      const n = Number(s);
      return Number.isFinite(n) ? n : value;
    }
    default:
      return value;
  }
}

/**
 * Resolve a single merge-tag body: "trigger.first_name|uppercase" or "now"
 */
function resolveTagBody(body, scope) {
  const raw = String(body || '').trim();
  if (!raw) return '';

  const parts = raw.split('|').map((p) => p.trim()).filter(Boolean);
  const pathPart = parts[0] || '';
  const helpers = parts.slice(1);

  let value;
  if (pathPart === 'now') {
    value = scope.now;
  } else if (pathPart === 'entityId' || pathPart === 'trigger.id') {
    value = scope.entityId;
  } else if (pathPart.startsWith('dataBag.')) {
    value = getByPath(scope.dataBag, pathPart.slice('dataBag.'.length));
  } else if (pathPart.startsWith('event.currentState.')) {
    value = getByPath(scope.currentState, pathPart.slice('event.currentState.'.length));
  } else if (pathPart.startsWith('event.')) {
    value = getByPath(scope.event, pathPart.slice('event.'.length));
  } else if (pathPart.startsWith('trigger.')) {
    value = getByPath(scope.trigger, pathPart.slice('trigger.'.length));
  } else if (pathPart.startsWith('record.')) {
    value = getByPath(scope.record, pathPart.slice('record.'.length));
  } else {
    value =
      getByPath(scope.trigger, pathPart) ??
      getByPath(scope.currentState, pathPart) ??
      getByPath(scope.dataBag, pathPart);
  }

  for (const helper of helpers) {
    value = applyPipeHelper(value, helper);
  }
  return value == null ? '' : value;
}

function interpolateMergetags(text, scope) {
  return String(text).replace(MERGE_TAG_RE, (_full, body) => {
    const resolved = resolveTagBody(body, scope);
    return resolved == null ? '' : String(resolved);
  });
}

/**
 * Expression: mergetags and/or formula helpers.
 */
function resolveExpression(expression, scope) {
  const original = expression == null ? '' : String(expression);
  if (!original.trim()) return '';

  let text = original;
  if (text.includes('{{')) {
    text = interpolateMergetags(text, scope);
  }

  // Pure formula (or formula after mergetag expansion)
  if (looksLikeFormula(text)) {
    try {
      return evaluateFormula(text, scope);
    } catch {
      // fall through — return interpolated text for prose templates
    }
  }

  // Entire original was a formula (no mergetags) — try once more on original
  if (!original.includes('{{') && looksLikeFormula(original)) {
    try {
      return evaluateFormula(original, scope);
    } catch {
      /* ignore */
    }
  }

  return text;
}

function resolveCopySource(source, scope) {
  const s = String(source || '').trim();
  if (!s) return undefined;
  if (looksLikeFormula(s) && /[()]/.test(s)) {
    try {
      return evaluateFormula(s, scope);
    } catch {
      /* fall through */
    }
  }
  return resolveTagBody(s, scope);
}

function normalizeEntry(raw) {
  if (raw == null) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return { mode: 'raw', value: raw };
  }
  const mode = String(raw.mode || 'raw').toLowerCase();
  if (mode === 'copy') {
    return { mode: 'copy', source: raw.source ?? raw.field ?? raw.path ?? '' };
  }
  if (mode === 'expression') {
    return { mode: 'expression', expression: raw.expression ?? raw.value ?? '' };
  }
  return { mode: 'raw', value: raw.value !== undefined ? raw.value : raw };
}

/**
 * @param {Record<string, unknown>} fieldValues
 * @param {object} ctx - process action context
 * @returns {Record<string, unknown>}
 */
function resolveFieldValues(fieldValues, ctx = {}) {
  if (!fieldValues || typeof fieldValues !== 'object' || Array.isArray(fieldValues)) {
    return {};
  }
  const scope = buildScope(ctx);
  const out = {};
  for (const [key, raw] of Object.entries(fieldValues)) {
    if (!key || raw === undefined) continue;
    try {
      const entry = normalizeEntry(raw);
      if (!entry) continue;

      if (entry.mode === 'copy') {
        const v = resolveCopySource(entry.source, scope);
        if (v !== undefined) out[key] = v;
        continue;
      }
      if (entry.mode === 'expression') {
        out[key] = resolveExpression(entry.expression, scope);
        continue;
      }
      out[key] = entry.value;
    } catch {
      // Skip broken field mapping — do not fail the whole action
      out[key] = null;
    }
  }
  return out;
}

module.exports = {
  resolveFieldValues,
  resolveExpression,
  resolveCopySource,
  buildScope,
  normalizeEntry
};
