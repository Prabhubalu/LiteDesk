import { normalizeWebformFieldType, isPicklistFieldType } from '@/constants/moduleFieldTypes';

export function isTextareaFieldType(type) {
  const normalized = normalizeWebformFieldType(type);
  return normalized === 'Text-Area' || normalized === 'Rich Text';
}

export function isMultiPicklistFieldType(type) {
  return normalizeWebformFieldType(type) === 'Multi-Picklist';
}

export function isRadioFieldType(type) {
  return normalizeWebformFieldType(type) === 'Radio Button';
}

export function isCheckboxFieldType(type) {
  return normalizeWebformFieldType(type) === 'Checkbox';
}

export function isFileFieldType(type) {
  return normalizeWebformFieldType(type) === 'File';
}

export function isFileFieldValueEmpty(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return true;
  return !String(value.uploadToken || '').trim();
}

export function isSingleSelectFieldType(type) {
  const normalized = normalizeWebformFieldType(type);
  return normalized === 'Picklist';
}

export function isNativeInputFieldType(type) {
  const normalized = normalizeWebformFieldType(type);
  return [
    'Text',
    'Email',
    'Phone',
    'URL',
    'Integer',
    'Decimal',
    'Currency',
    'Date',
    'Date-Time',
    'Image'
  ].includes(normalized);
}

export function htmlInputTypeForFieldType(type) {
  const normalized = normalizeWebformFieldType(type);
  if (normalized === 'Email') return 'email';
  if (normalized === 'Phone') return 'tel';
  if (normalized === 'URL' || normalized === 'Image') return 'url';
  if (['Integer', 'Decimal', 'Currency'].includes(normalized)) return 'number';
  if (normalized === 'Date') return 'date';
  if (normalized === 'Date-Time') return 'datetime-local';
  return 'text';
}

export function isFieldValueEmpty(type, value) {
  if (isCheckboxFieldType(type)) return value !== true;
  if (isFileFieldType(type)) return isFileFieldValueEmpty(value);
  if (isMultiPicklistFieldType(type)) {
    if (Array.isArray(value)) return value.length === 0;
    return String(value || '').trim() === '';
  }
  if (value === undefined || value === null) return true;
  return String(value).trim() === '';
}

export { normalizeWebformFieldType, isPicklistFieldType };
