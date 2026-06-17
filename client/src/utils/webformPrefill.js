import { slugifyWebformClient } from '@/utils/webformFormatters';
import {
  isCheckboxFieldType,
  isMultiPicklistFieldType,
  normalizeWebformFieldType
} from '@/utils/webformFieldTypeUtils';

/** Query keys used by the app — not treated as field prefill. */
export const WEBFORM_RESERVED_QUERY_KEYS = new Set([
  'webformId'
]);

const TRUTHY = new Set(['1', 'true', 'yes', 'on']);
const FALSY = new Set(['0', 'false', 'no', 'off']);

/**
 * @param {Array<{ fieldId: string, crmFieldKey?: string, label?: string }>} fields
 */
export function buildWebformFieldPrefillIndex(fields) {
  const byFieldId = new Map();
  const byCrmKey = new Map();
  const byLabelSlug = new Map();

  for (const field of Array.isArray(fields) ? fields : []) {
    const fieldId = String(field?.fieldId || '').trim();
    if (!fieldId) continue;
    byFieldId.set(fieldId, field);

    const crmKey = String(field?.crmFieldKey || '').trim().toLowerCase();
    if (crmKey && !byCrmKey.has(crmKey)) {
      byCrmKey.set(crmKey, field);
    }

    const labelSlug = slugifyWebformClient(field?.label || '');
    if (labelSlug && !byLabelSlug.has(labelSlug)) {
      byLabelSlug.set(labelSlug, field);
    }
  }

  return { byFieldId, byCrmKey, byLabelSlug };
}

/**
 * @param {string} key
 * @param {ReturnType<typeof buildWebformFieldPrefillIndex>} index
 */
export function resolveWebformFieldForPrefillKey(key, index) {
  const normalized = String(key || '').trim();
  if (!normalized || WEBFORM_RESERVED_QUERY_KEYS.has(normalized)) return null;

  if (index.byFieldId.has(normalized)) {
    return index.byFieldId.get(normalized);
  }

  if (normalized.startsWith('field_')) {
    const fieldId = normalized.slice(6);
    if (index.byFieldId.has(fieldId)) {
      return index.byFieldId.get(fieldId);
    }
  }

  const lower = normalized.toLowerCase();
  if (index.byCrmKey.has(lower)) {
    return index.byCrmKey.get(lower);
  }

  const slug = slugifyWebformClient(normalized);
  if (slug && index.byLabelSlug.has(slug)) {
    return index.byLabelSlug.get(slug);
  }

  return null;
}

/**
 * @param {object} field
 * @param {string} raw
 */
export function coerceWebformPrefillValue(field, raw) {
  const type = normalizeWebformFieldType(field?.type);
  const text = String(raw ?? '').trim();
  if (!text) return null;

  if (isCheckboxFieldType(type)) {
    const lower = text.toLowerCase();
    if (TRUTHY.has(lower)) return true;
    if (FALSY.has(lower)) return false;
    return null;
  }

  if (isMultiPicklistFieldType(type)) {
    return text.split(',').map((part) => part.trim()).filter(Boolean);
  }

  return text;
}

/**
 * Apply URL/query prefill values onto form data.
 * @param {Array} fields
 * @param {Record<string, unknown>} formData
 * @param {Record<string, string | string[] | null | undefined>} query
 */
export function applyWebformPrefillFromQuery(fields, formData, query) {
  const next = { ...(formData || {}) };
  const index = buildWebformFieldPrefillIndex(fields);
  const source = query && typeof query === 'object' ? query : {};

  for (const [key, rawValue] of Object.entries(source)) {
    const field = resolveWebformFieldForPrefillKey(key, index);
    if (!field) continue;

    const raw = Array.isArray(rawValue) ? rawValue[0] : rawValue;
    const coerced = coerceWebformPrefillValue(field, raw);
    if (coerced === null && !isCheckboxFieldType(normalizeWebformFieldType(field.type))) {
      continue;
    }
    if (coerced !== null) {
      next[field.fieldId] = coerced;
    }
  }

  return next;
}

/**
 * Build an example prefill URL for the builder publish step.
 * @param {string} baseUrl
 * @param {Array} fields
 */
export function buildWebformPrefillExampleUrl(baseUrl, fields) {
  const url = String(baseUrl || '').trim();
  if (!url) return '';

  const rows = Array.isArray(fields) ? fields : [];
  const params = new URLSearchParams();

  for (const field of rows.slice(0, 3)) {
    const key = String(field?.crmFieldKey || field?.fieldId || '').trim();
    if (!key) continue;
    params.set(key, '...');
  }

  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}
