function hasImportDefaultValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

function importDefaultValueToCellString(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry).trim()).filter(Boolean).join(', ');
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

/**
 * Override CSV cell values with configured import defaults before row processing.
 * @param {Record<string, string>} row
 * @param {Record<string, string>} fieldMapping
 * @param {Record<string, unknown>} fieldDefaultValues
 */
function applyImportFieldDefaults(row, fieldMapping, fieldDefaultValues) {
  if (!row || !fieldDefaultValues || typeof fieldDefaultValues !== 'object') {
    return row;
  }

  const result = { ...row };
  for (const [csvField, defaultValue] of Object.entries(fieldDefaultValues)) {
    const mappedField = fieldMapping?.[csvField];
    if (!mappedField) continue;
    if (!hasImportDefaultValue(defaultValue)) continue;
    result[csvField] = importDefaultValueToCellString(defaultValue);
  }
  return result;
}

function sanitizeImportFieldDefaultValues(fieldDefaultValues) {
  if (!fieldDefaultValues || typeof fieldDefaultValues !== 'object') return {};
  const sanitized = {};
  for (const [csvField, value] of Object.entries(fieldDefaultValues)) {
    if (!hasImportDefaultValue(value)) continue;
    sanitized[csvField] = value;
  }
  return sanitized;
}

module.exports = {
  applyImportFieldDefaults,
  sanitizeImportFieldDefaultValues,
  hasImportDefaultValue,
  importDefaultValueToCellString,
};
