/**
 * Field context filtering (server). Keep aligned with client/src/utils/fieldContextFilter.js
 */

function appKeyToFieldContextToken(appKey) {
  if (appKey == null || appKey === '') return '';
  return String(appKey).trim().toLowerCase();
}

/**
 * Resolve a field's visibility context token from context + appKey.
 * Legacy People fields used context: 'app' with appKey: 'SALES' — routes use 'sales'.
 */
function resolveFieldContextToken(field) {
  if (!field) return 'global';
  const raw =
    field.context != null && String(field.context).trim() !== ''
      ? String(field.context).trim().toLowerCase()
      : 'global';

  if (raw === 'global') return 'global';
  if (raw === 'app') {
    const fromAppKey = appKeyToFieldContextToken(field.appKey);
    return fromAppKey || 'app';
  }
  return raw;
}

function isFieldVisibleInContext(field, currentContext) {
  if (!field) return false;
  const ctx = currentContext != null && String(currentContext).trim() !== ''
    ? String(currentContext).trim().toLowerCase()
    : 'platform';

  if (ctx === 'all') return true;

  const fieldToken = resolveFieldContextToken(field);
  if (fieldToken === 'global') return true;
  if (ctx === 'platform') return false;
  return fieldToken === ctx;
}

function filterFieldsByContext(fields, currentContext) {
  if (!Array.isArray(fields)) return [];
  return fields.filter((field) => isFieldVisibleInContext(field, currentContext));
}

module.exports = {
  appKeyToFieldContextToken,
  resolveFieldContextToken,
  isFieldVisibleInContext,
  filterFieldsByContext,
};
