/**
 * Platform module field types — keep in sync with server/constants/moduleFieldTypes.js
 * Labels reuse Settings → Add field i18n keys.
 */

export const PLATFORM_MODULE_FIELD_TYPES = Object.freeze([
  'Text',
  'Text-Area',
  'Rich Text',
  'Integer',
  'Decimal',
  'Currency',
  'Date',
  'Date-Time',
  'Picklist',
  'Multi-Picklist',
  'Checkbox',
  'Radio Button',
  'Email',
  'Phone',
  'URL',
  'Image',
  'Auto-Number',
  'Lookup (Relationship)',
  'Formula',
  'Rollup Summary'
]);

export const WEBFORM_EXCLUDED_FIELD_TYPES = new Set([
  'Auto-Number',
  'Formula',
  'Rollup Summary',
  'Lookup (Relationship)'
]);

export const WEBFORM_FIELD_TYPE_ALIASES = Object.freeze({
  Textarea: 'Text-Area',
  Number: 'Integer',
  Dropdown: 'Picklist'
});

export const PICKLIST_FIELD_TYPES = Object.freeze([
  'Picklist',
  'Multi-Picklist',
  'Radio Button'
]);

export const FIELD_TYPE_I18N = Object.freeze({
  Text: 'settingsAddFieldTypeText',
  'Text-Area': 'settingsAddFieldTypeTextArea',
  'Rich Text': 'settingsAddFieldTypeRichText',
  Integer: 'settingsAddFieldTypeInteger',
  Decimal: 'settingsAddFieldTypeDecimal',
  Currency: 'settingsAddFieldTypeCurrency',
  Date: 'settingsAddFieldTypeDate',
  'Date-Time': 'settingsAddFieldTypeDateTime',
  Picklist: 'settingsAddFieldTypePicklist',
  'Multi-Picklist': 'settingsAddFieldTypeMultiPicklist',
  Checkbox: 'settingsAddFieldTypeCheckbox',
  'Radio Button': 'settingsAddFieldTypeRadioButton',
  Email: 'settingsAddFieldTypeEmail',
  Phone: 'settingsAddFieldTypePhone',
  URL: 'settingsAddFieldTypeUrl',
  Image: 'settingsAddFieldTypeImage',
  'Auto-Number': 'settingsAddFieldTypeAutoNumber',
  'Lookup (Relationship)': 'settingsAddFieldTypeLookup',
  Formula: 'settingsAddFieldTypeFormula',
  'Rollup Summary': 'settingsAddFieldTypeRollupSummary'
});

export const WEBFORM_FIELD_TYPES = Object.freeze([
  ...PLATFORM_MODULE_FIELD_TYPES.filter((type) => !WEBFORM_EXCLUDED_FIELD_TYPES.has(type)),
  'File'
]);

export function normalizeWebformFieldType(type) {
  const raw = String(type || '').trim();
  if (!raw) return 'Text';
  if (WEBFORM_FIELD_TYPE_ALIASES[raw]) return WEBFORM_FIELD_TYPE_ALIASES[raw];
  return raw;
}

export function isPicklistFieldType(type) {
  return PICKLIST_FIELD_TYPES.includes(normalizeWebformFieldType(type));
}

export function fieldTypeSettingsLabelKey(type) {
  return FIELD_TYPE_I18N[normalizeWebformFieldType(type)] || null;
}

export function defaultColumnWidthForFieldType(type) {
  const normalized = normalizeWebformFieldType(type);
  if (['Text-Area', 'Rich Text', 'Multi-Picklist', 'Checkbox', 'Radio Button', 'Image', 'File'].includes(normalized)) {
    return 'full';
  }
  return 'half';
}

export function fieldTypeNeedsOptions(type) {
  return isPicklistFieldType(type);
}
