import { isCheckboxFieldType, normalizeWebformFieldType, isFileFieldType } from '@/utils/webformFieldTypeUtils';

export const WEBFORM_VISIBILITY_MATCH_MODES = ['all', 'any'];

export const WEBFORM_VISIBILITY_OPERATORS = [
  'equals',
  'not_equals',
  'contains',
  'not_contains',
  'is_empty',
  'is_not_empty',
  'is_checked',
  'is_not_checked'
];

export function defaultFieldVisibility() {
  return {
    enabled: false,
    match: 'all',
    conditions: []
  };
}

export function sanitizeFieldVisibility(raw) {
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
  if (isCheckboxFieldType(type)) return value !== true;
  if (isFileFieldType(type)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return true;
    return !String(value.uploadToken || '').trim();
  }
  if (normalizeWebformFieldType(type) === 'Multi-Picklist') {
    if (Array.isArray(value)) return value.length === 0;
    return value === undefined || value === null || String(value).trim() === '';
  }
  if (value === undefined || value === null) return true;
  return String(value).trim() === '';
}

function normalizeComparableValue(type, value) {
  if (isCheckboxFieldType(type)) return value === true ? 'true' : 'false';
  if (normalizeWebformFieldType(type) === 'Multi-Picklist') {
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

export function isWebformFieldVisible(field, fields, values) {
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

export function filterVisibleWebformFields(fields, values, allFields) {
  const rows = Array.isArray(fields) ? fields : [];
  const lookupFields = Array.isArray(allFields) ? allFields : rows;
  return rows.filter((field) => isWebformFieldVisible(field, lookupFields, values));
}

export function operatorsForSourceFieldType(type) {
  if (isCheckboxFieldType(type)) {
    return ['is_checked', 'is_not_checked', 'equals', 'not_equals'];
  }
  return WEBFORM_VISIBILITY_OPERATORS.filter((op) => !['is_checked', 'is_not_checked'].includes(op));
}

export function conditionOperatorNeedsValue(operator) {
  return !['is_empty', 'is_not_empty', 'is_checked', 'is_not_checked'].includes(operator);
}
