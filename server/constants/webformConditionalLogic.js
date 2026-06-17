'use strict';

const { normalizeWebformFieldType } = require('./moduleFieldTypes');
const { isWebformFileFieldType, isFileFieldValueEmpty } = require('./webformFileFields');

const WEBFORM_VISIBILITY_MATCH_MODES = ['all', 'any'];

const WEBFORM_VISIBILITY_OPERATORS = [
  'equals',
  'not_equals',
  'contains',
  'not_contains',
  'is_empty',
  'is_not_empty',
  'is_checked',
  'is_not_checked'
];

function defaultFieldVisibility() {
  return {
    enabled: false,
    match: 'all',
    conditions: []
  };
}

function sanitizeFieldVisibility(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const conditions = Array.isArray(source.conditions) ? source.conditions : [];
  return {
    enabled: source.enabled === true,
    match: source.match === 'any' ? 'any' : 'all',
    conditions: conditions
      .map((row) => ({
        fieldId: String(row?.fieldId || '').trim(),
        operator: WEBFORM_VISIBILITY_OPERATORS.includes(row?.operator) ? row.operator : 'equals',
        value: String(row?.value ?? '').trim()
      }))
      .filter((row) => row.fieldId)
  };
}

function isValueEmpty(type, value) {
  const normalized = normalizeWebformFieldType(type);
  if (normalized === 'Checkbox') return value !== true;
  if (isWebformFileFieldType(normalized)) return isFileFieldValueEmpty(value);
  if (normalized === 'Multi-Picklist') {
    if (Array.isArray(value)) return value.length === 0;
    return value === undefined || value === null || String(value).trim() === '';
  }
  if (value === undefined || value === null) return true;
  return String(value).trim() === '';
}

function normalizeComparableValue(type, value) {
  if (type === 'Checkbox') return value === true ? 'true' : 'false';
  if (type === 'Multi-Picklist') {
    if (Array.isArray(value)) return value.map((part) => String(part).trim()).filter(Boolean).join(',');
    return String(value ?? '').trim();
  }
  return String(value ?? '').trim();
}

function evaluateVisibilityCondition(condition, fieldsById, values) {
  const fieldId = String(condition?.fieldId || '').trim();
  const sourceField = fieldsById.get(fieldId);
  if (!sourceField) return false;

  const operator = WEBFORM_VISIBILITY_OPERATORS.includes(condition?.operator)
    ? condition.operator
    : 'equals';
  const type = normalizeWebformFieldType(sourceField.type);
  const raw = values[fieldId];
  const empty = isValueEmpty(type, raw);

  if (operator === 'is_empty') return empty;
  if (operator === 'is_not_empty') return !empty;
  if (operator === 'is_checked') return raw === true;
  if (operator === 'is_not_checked') return raw !== true;

  const actual = normalizeComparableValue(type, raw).toLowerCase();
  const expected = String(condition?.value ?? '').trim().toLowerCase();

  switch (operator) {
    case 'equals':
      return actual === expected;
    case 'not_equals':
      return actual !== expected;
    case 'contains':
      return expected !== '' && actual.includes(expected);
    case 'not_contains':
      return expected === '' ? true : !actual.includes(expected);
    default:
      return false;
  }
}

function isWebformFieldVisible(field, fields, values) {
  const visibility = sanitizeFieldVisibility(field?.visibility);
  if (!visibility.enabled || !visibility.conditions.length) return true;

  const fieldsById = new Map(
    (Array.isArray(fields) ? fields : []).map((row) => [String(row.fieldId), row])
  );
  const results = visibility.conditions.map((condition) =>
    evaluateVisibilityCondition(condition, fieldsById, values || {})
  );

  return visibility.match === 'any' ? results.some(Boolean) : results.every(Boolean);
}

function filterVisibleWebformFields(fields, values, allFields) {
  const rows = Array.isArray(fields) ? fields : [];
  const lookupFields = Array.isArray(allFields) ? allFields : rows;
  return rows.filter((field) => isWebformFieldVisible(field, lookupFields, values));
}

function stripHiddenWebformFieldValues(fields, values) {
  const rows = Array.isArray(fields) ? fields : [];
  const source = values && typeof values === 'object' && !Array.isArray(values) ? values : {};
  const next = { ...source };
  for (const field of rows) {
    if (!isWebformFieldVisible(field, rows, source)) {
      delete next[field.fieldId];
    }
  }
  return next;
}

module.exports = {
  WEBFORM_VISIBILITY_MATCH_MODES,
  WEBFORM_VISIBILITY_OPERATORS,
  defaultFieldVisibility,
  sanitizeFieldVisibility,
  isWebformFieldVisible,
  filterVisibleWebformFields,
  stripHiddenWebformFieldValues
};
