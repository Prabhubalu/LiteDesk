/**
 * Catalog barcode / QR identity types (variant-level).
 * @see docs/CATALOG_ROADMAP.md (C1)
 */

const CATALOG_BARCODE_TYPES = ['EAN13', 'UPC', 'GTIN', 'CODE128', 'QR', 'OTHER'];

const CATALOG_MEDIA_KINDS = ['image', 'document'];

function isCatalogBarcodeType(value) {
  return CATALOG_BARCODE_TYPES.includes(value);
}

function isCatalogMediaKind(value) {
  return CATALOG_MEDIA_KINDS.includes(value);
}

function inferBarcodeTypeFromValue(barcode) {
  const normalized = String(barcode || '').replace(/\D/g, '');
  if (!normalized) return 'OTHER';
  if (normalized.length === 13) return 'EAN13';
  if (normalized.length === 12) return 'UPC';
  if (normalized.length === 8 || normalized.length === 14) return 'GTIN';
  return 'OTHER';
}

module.exports = {
  CATALOG_BARCODE_TYPES,
  CATALOG_MEDIA_KINDS,
  isCatalogBarcodeType,
  isCatalogMediaKind,
  inferBarcodeTypeFromValue
};
