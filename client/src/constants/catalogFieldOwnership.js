/**
 * Client mirror — variant fields are edited on ItemVariant in catalog UI.
 * `item_code` is the parent system Item Code (Module Numbering), not a variant field.
 */
export const VARIANT_FIELD_KEYS = [
  'variant_code',
  'unit_of_measure',
  'selling_price',
  'cost_price',
  'currency',
  'tax_type',
  'tax_percentage',
  'commission_rate',
  'barcode',
  'barcode_type',
  'qr_payload'
];
