/**
 * Catalog attribute template data types.
 * @see docs/CATALOG_ROADMAP.md (C2)
 */

const CATALOG_ATTRIBUTE_DATA_TYPES = [
  'text',
  'number',
  'boolean',
  'select',
  'multi-select',
  'date'
];

function isCatalogAttributeDataType(value) {
  return CATALOG_ATTRIBUTE_DATA_TYPES.includes(value);
}

function slugifyCatalogKey(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64) || 'field';
}

module.exports = {
  CATALOG_ATTRIBUTE_DATA_TYPES,
  isCatalogAttributeDataType,
  slugifyCatalogKey
};
