/**
 * Validates item.attributeValues against category attribute templates.
 */

function coerceAttributeValue(dataType, rawValue) {
  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return null;
  }

  switch (dataType) {
    case 'number': {
      const num = Number(rawValue);
      return Number.isFinite(num) ? num : NaN;
    }
    case 'boolean':
      if (typeof rawValue === 'boolean') return rawValue;
      if (rawValue === 'true' || rawValue === true) return true;
      if (rawValue === 'false' || rawValue === false) return false;
      return null;
    case 'multi-select':
      if (Array.isArray(rawValue)) return rawValue.map(String);
      return String(rawValue).split(',').map((s) => s.trim()).filter(Boolean);
    case 'date':
      return String(rawValue);
    default:
      return String(rawValue);
  }
}

function validateAttributeValues(templates, attributeValues = {}) {
  const errors = [];
  const sanitized = {};
  const values = attributeValues && typeof attributeValues === 'object' ? attributeValues : {};

  for (const template of templates) {
    if (!template.isActive) continue;

    const raw = values[template.key];
    const coerced = coerceAttributeValue(template.dataType, raw);
    const isEmpty = coerced === null || coerced === undefined
      || (Array.isArray(coerced) && coerced.length === 0)
      || coerced === '';

    if (template.required && isEmpty) {
      errors.push({ key: template.key, message: `${template.label} is required` });
      continue;
    }

    if (isEmpty) continue;

    if (template.dataType === 'number' && Number.isNaN(coerced)) {
      errors.push({ key: template.key, message: `${template.label} must be a number` });
      continue;
    }

    if (template.dataType === 'select' && template.options?.length) {
      if (!template.options.includes(coerced)) {
        errors.push({ key: template.key, message: `${template.label} has an invalid option` });
        continue;
      }
    }

    if (template.dataType === 'multi-select' && template.options?.length) {
      const invalid = coerced.filter((v) => !template.options.includes(v));
      if (invalid.length) {
        errors.push({ key: template.key, message: `${template.label} has invalid options` });
        continue;
      }
    }

    sanitized[template.key] = coerced;
  }

  return {
    ok: errors.length === 0,
    errors,
    sanitized
  };
}

module.exports = {
  coerceAttributeValue,
  validateAttributeValues
};
