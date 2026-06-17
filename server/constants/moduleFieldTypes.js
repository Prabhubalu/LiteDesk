'use strict';

/**
 * Canonical platform module field types (Settings → Modules & Fields).
 * Webforms and module customization must derive allowed types from here.
 */
const PLATFORM_MODULE_FIELD_TYPES = Object.freeze([
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

/** System/computed types — not offered on public webforms. */
const WEBFORM_EXCLUDED_FIELD_TYPES = new Set([
  'Auto-Number',
  'Formula',
  'Rollup Summary',
  'Lookup (Relationship)'
]);

/** Legacy webform builder values persisted before platform type alignment. */
const WEBFORM_FIELD_TYPE_ALIASES = Object.freeze({
  Textarea: 'Text-Area',
  Number: 'Integer',
  Dropdown: 'Picklist'
});

const WEBFORM_PICKLIST_FIELD_TYPES = new Set([
  'Picklist',
  'Multi-Picklist',
  'Radio Button'
]);

const WEBFORM_FIELD_TYPES = Object.freeze([
  ...PLATFORM_MODULE_FIELD_TYPES.filter((type) => !WEBFORM_EXCLUDED_FIELD_TYPES.has(type)),
  'File'
]);

const WEBFORM_FIELD_TYPE_META = Object.freeze({
  Text: { category: 'text', defaultColumnWidth: 'half' },
  'Text-Area': { category: 'textarea', defaultColumnWidth: 'full' },
  'Rich Text': { category: 'richText', defaultColumnWidth: 'full' },
  Integer: { category: 'number', defaultColumnWidth: 'half' },
  Decimal: { category: 'number', defaultColumnWidth: 'half' },
  Currency: { category: 'number', defaultColumnWidth: 'half' },
  Date: { category: 'date', defaultColumnWidth: 'half' },
  'Date-Time': { category: 'datetime', defaultColumnWidth: 'half' },
  Picklist: { category: 'picklist', defaultColumnWidth: 'half' },
  'Multi-Picklist': { category: 'multiPicklist', defaultColumnWidth: 'full' },
  Checkbox: { category: 'checkbox', defaultColumnWidth: 'full' },
  'Radio Button': { category: 'radio', defaultColumnWidth: 'full' },
  Email: { category: 'email', defaultColumnWidth: 'half' },
  Phone: { category: 'phone', defaultColumnWidth: 'half' },
  URL: { category: 'url', defaultColumnWidth: 'half' },
  Image: { category: 'image', defaultColumnWidth: 'full' },
  File: { category: 'file', defaultColumnWidth: 'full' }
});

function normalizeWebformFieldType(type) {
  const raw = String(type || '').trim();
  if (!raw) return 'Text';
  if (WEBFORM_FIELD_TYPE_ALIASES[raw]) return WEBFORM_FIELD_TYPE_ALIASES[raw];
  return raw;
}

function isWebformPicklistFieldType(type) {
  return WEBFORM_PICKLIST_FIELD_TYPES.has(normalizeWebformFieldType(type));
}

function isWebformFieldTypeAllowed(type) {
  const normalized = normalizeWebformFieldType(type);
  return WEBFORM_FIELD_TYPES.includes(normalized);
}

function getWebformFieldTypeMeta(type) {
  const normalized = normalizeWebformFieldType(type);
  return WEBFORM_FIELD_TYPE_META[normalized] || { category: 'text', defaultColumnWidth: 'half' };
}

function listWebformBuilderFieldTypes() {
  return WEBFORM_FIELD_TYPES.map((type) => {
    const meta = getWebformFieldTypeMeta(type);
    return {
      type,
      category: meta.category,
      picklist: isWebformPicklistFieldType(type),
      multiSelect: normalizeWebformFieldType(type) === 'Multi-Picklist',
      defaultColumnWidth: meta.defaultColumnWidth
    };
  });
}

module.exports = {
  PLATFORM_MODULE_FIELD_TYPES,
  WEBFORM_FIELD_TYPES,
  WEBFORM_FIELD_TYPE_ALIASES,
  WEBFORM_PICKLIST_FIELD_TYPES,
  WEBFORM_EXCLUDED_FIELD_TYPES,
  normalizeWebformFieldType,
  isWebformPicklistFieldType,
  isWebformFieldTypeAllowed,
  getWebformFieldTypeMeta,
  listWebformBuilderFieldTypes
};
