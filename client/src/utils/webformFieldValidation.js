import { normalizeWebformFieldType, isFieldValueEmpty, isFileFieldType } from '@/utils/webformFieldTypeUtils';
import { validatePhoneValue } from '@/utils/phoneInput';
import { validateField } from '@/utils/fieldValidation';
import { getDefaultEmailValidations } from '@/utils/defaultFieldValidations';
import { getWebformFieldDependencyState } from '@/utils/webformModuleFields';

const PHONE_CRM_KEY_PATTERN = /(^|_)(phone|mobile|tel)(_|$)/i;

export function isWebformEmailField(field) {
  const type = normalizeWebformFieldType(field?.type);
  if (type === 'Email') return true;
  const key = String(field?.crmFieldKey || '').toLowerCase();
  return key === 'email' || key.endsWith('_email') || key === 'requesteremail';
}

export function isWebformPhoneField(field) {
  const type = normalizeWebformFieldType(field?.type);
  if (type === 'Phone') return true;
  const key = String(field?.crmFieldKey || '').toLowerCase();
  return key === 'phone' || key === 'mobile' || PHONE_CRM_KEY_PATTERN.test(key);
}

/**
 * Validate webform field values before submit.
 * @param {Array} fields
 * @param {Record<string, unknown>} values
 * @param {{ required: (label: string) => string, emailInvalid: (label: string) => string, phoneInvalid: (label: string) => string }} messages
 * @param {{ moduleKey?: string, allFields?: Array, moduleFields?: Array }} [options]
 */
export function validateWebformFields(fields, values, messages = {}, options = {}) {
  const errors = {};
  const rows = Array.isArray(fields) ? fields : [];
  const allFields = Array.isArray(options.allFields) ? options.allFields : rows;
  const moduleKey = String(options.moduleKey || '').trim();
  const moduleFields = Array.isArray(options.moduleFields) ? options.moduleFields : null;

  for (const field of rows) {
    const fieldId = String(field.fieldId || '');
    if (!fieldId) continue;

    const depState = moduleKey
      ? getWebformFieldDependencyState(field, allFields, values, moduleKey, moduleFields)
      : null;

    if (depState && depState.visible === false) continue;

    const type = normalizeWebformFieldType(field.type);
    const value = values[fieldId];
    const label = String(field.label || fieldId).trim() || fieldId;
    const isRequired = depState ? depState.required === true : field.required === true;

    if (isRequired && isFieldValueEmpty(type, value)) {
      errors[fieldId] = messages.required
        ? messages.required(label)
        : `${label} is required.`;
      continue;
    }

    if (isFieldValueEmpty(type, value)) continue;

    if (isFileFieldType(type)) {
      if (!value || typeof value !== 'object' || !String(value.uploadToken || '').trim()) {
        errors[fieldId] = messages.fileInvalid
          ? messages.fileInvalid(label)
          : `${label} requires a valid upload.`;
      }
      continue;
    }

    if (isWebformEmailField(field)) {
      const emailCheck = validateField(String(value).trim(), getDefaultEmailValidations());
      if (!emailCheck.isValid) {
        errors[fieldId] = messages.emailInvalid
          ? messages.emailInvalid(label)
          : emailCheck.error || 'Invalid email format';
      }
      continue;
    }

    if (isWebformPhoneField(field)) {
      const phoneCheck = validatePhoneValue(value);
      if (!phoneCheck.isValid) {
        errors[fieldId] = messages.phoneInvalid
          ? messages.phoneInvalid(label)
          : phoneCheck.error || 'Invalid phone number';
      }
    }
  }

  const fieldIds = Object.keys(errors);
  return {
    valid: fieldIds.length === 0,
    errors,
    firstErrorFieldId: fieldIds[0] || null
  };
}
