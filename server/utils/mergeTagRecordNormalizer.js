'use strict';

function snakeToCamel(key) {
  return String(key || '').replace(/_([a-z])/g, (_, char) => char.toUpperCase());
}

function camelToSnake(key) {
  return String(key || '')
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');
}

function fieldKeyVariants(key) {
  const source = String(key || '').trim();
  if (!source) return [];

  const variants = new Set([source]);
  variants.add(snakeToCamel(source));
  variants.add(camelToSnake(source));
  return [...variants].filter(Boolean);
}

/**
 * Add camelCase / snake_case mirrors so merge paths match module field keys and DB paths.
 * @param {Record<string, unknown> | null | undefined} record
 * @returns {Record<string, unknown>}
 */
function normalizeRecordForMergeTags(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return {};
  }

  const normalized = { ...record };

  for (const [key, value] of Object.entries(record)) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) continue;

    for (const variant of fieldKeyVariants(key)) {
      if (!Object.prototype.hasOwnProperty.call(normalized, variant)) {
        normalized[variant] = value;
      }
    }
  }

  if (normalized.first_name || normalized.last_name) {
    const fullName = [normalized.first_name, normalized.last_name].filter(Boolean).join(' ').trim();
    if (fullName) {
      normalized.full_name = fullName;
      normalized.fullName = fullName;
    }
  }

  return normalized;
}

module.exports = {
  snakeToCamel,
  camelToSnake,
  fieldKeyVariants,
  normalizeRecordForMergeTags
};
