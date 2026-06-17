'use strict';

const { normalizeWebformFieldType } = require('../constants/moduleFieldTypes');

const TEXT_LIKE_TYPES = new Set([
  'Text',
  'Text-Area',
  'Email',
  'Phone',
  'URL',
  'Long Text'
]);

function stripControlChars(value) {
  return String(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
}

function stripHtmlTags(value) {
  return stripControlChars(String(value).replace(/<[^>]*>/g, ''));
}

function escapeHtmlEntities(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeStringAnswer(value, fieldType) {
  const type = normalizeWebformFieldType(fieldType);
  if (!TEXT_LIKE_TYPES.has(type)) {
    return typeof value === 'string' ? stripControlChars(value).trim() : value;
  }
  const stripped = stripHtmlTags(value).trim();
  return escapeHtmlEntities(stripped);
}

/**
 * Sanitize submitted field values before persistence / CRM ingest.
 * @param {Array<{ fieldId: string, type: string }>} fields
 * @param {Record<string, unknown>} values
 */
function sanitizeWebformFieldValues(fields, values) {
  const fieldById = new Map(
    (Array.isArray(fields) ? fields : []).map((field) => [String(field.fieldId), field])
  );
  const next = { ...values };

  for (const [key, value] of Object.entries(next)) {
    const field = fieldById.get(String(key));
    if (!field) continue;

    const type = normalizeWebformFieldType(field.type);
    if (type === 'Multi-Picklist' && Array.isArray(value)) {
      next[key] = value.map((item) => sanitizeStringAnswer(item, 'Text'));
      continue;
    }
    if (typeof value === 'string') {
      next[key] = sanitizeStringAnswer(value, field.type);
    }
  }

  return next;
}

module.exports = {
  sanitizeWebformFieldValues,
  stripHtmlTags,
  escapeHtmlEntities
};
