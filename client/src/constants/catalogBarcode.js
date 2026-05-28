/** Client mirror of server/constants/catalogBarcode.js — keep in sync. */

export const CATALOG_BARCODE_TYPES = ['EAN13', 'UPC', 'GTIN', 'CODE128', 'QR', 'OTHER'];

export const CATALOG_MEDIA_KINDS = ['image', 'document'];

export const CATALOG_BARCODE_TYPE_LABEL_KEYS = {
  EAN13: 'platform.catalogBarcodeEan13',
  UPC: 'platform.catalogBarcodeUpc',
  GTIN: 'platform.catalogBarcodeGtin',
  CODE128: 'platform.catalogBarcodeCode128',
  QR: 'platform.catalogBarcodeQr',
  OTHER: 'platform.catalogBarcodeOther'
};

export function isCatalogBarcodeType(value) {
  return CATALOG_BARCODE_TYPES.includes(value);
}

export function isCatalogMediaKind(value) {
  return CATALOG_MEDIA_KINDS.includes(value);
}
