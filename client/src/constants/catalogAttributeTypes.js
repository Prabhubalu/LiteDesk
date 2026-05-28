/** Client mirror of server/constants/catalogAttributeTypes.js */

export const CATALOG_ATTRIBUTE_DATA_TYPES = [
  'text',
  'number',
  'boolean',
  'select',
  'multi-select',
  'date'
];

export const CATALOG_ATTRIBUTE_TYPE_LABEL_KEYS = {
  text: 'platform.catalogAttrTypeText',
  number: 'platform.catalogAttrTypeNumber',
  boolean: 'platform.catalogAttrTypeBoolean',
  select: 'platform.catalogAttrTypeSelect',
  'multi-select': 'platform.catalogAttrTypeMultiSelect',
  date: 'platform.catalogAttrTypeDate'
};

export function isCatalogAttributeDataType(value) {
  return CATALOG_ATTRIBUTE_DATA_TYPES.includes(value);
}

export function slugifyCatalogKey(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64) || 'field';
}
