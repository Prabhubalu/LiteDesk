/**
 * Parent Item vs ItemVariant field ownership (C3).
 * @see docs/CATALOG_ROADMAP.md
 */

/** Fields owned by the sellable ItemVariant (canonical for Quotes/Orders). */
const VARIANT_PAYLOAD_KEYS = new Set([
  'item_code',
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
]);

const VARIANT_TO_ITEM_COMPAT_MAP = {
  variant_code: 'item_code',
  selling_price: 'selling_price',
  cost_price: 'cost_price',
  currency: 'currency',
  unit_of_measure: 'unit_of_measure',
  tax_type: 'tax_type',
  tax_percentage: 'tax_percentage',
  commission_rate: 'commission_rate'
};

function splitItemPayload(payload = {}) {
  const parentPayload = {};
  const variantPayload = {};

  for (const [key, value] of Object.entries(payload)) {
    if (VARIANT_PAYLOAD_KEYS.has(key)) {
      if (key === 'item_code') {
        variantPayload.variant_code = value;
      } else {
        variantPayload[key] = value;
      }
    } else {
      parentPayload[key] = value;
    }
  }

  return { parentPayload, variantPayload };
}

function hasVariantPayloadFields(variantPayload) {
  return Object.keys(variantPayload).length > 0;
}

function buildItemCompatFieldsFromVariant(variant) {
  if (!variant) return {};
  const compat = {};
  for (const [variantKey, itemKey] of Object.entries(VARIANT_TO_ITEM_COMPAT_MAP)) {
    if (variant[variantKey] !== undefined && variant[variantKey] !== null) {
      compat[itemKey] = variant[variantKey];
    }
  }
  return compat;
}

function applyFlatCompatShim(itemData, defaultVariant) {
  if (!itemData) return itemData;
  const out = typeof itemData.toObject === 'function' ? itemData.toObject() : { ...itemData };
  if (!defaultVariant) return out;

  Object.assign(out, buildItemCompatFieldsFromVariant(defaultVariant));
  out.catalogVariantId = defaultVariant._id;
  return out;
}

/** Detail responses include full defaultVariant; list uses flat compat fields only. */
function applyFlatCompatShimForList(itemData, defaultVariant) {
  return applyFlatCompatShim(itemData, defaultVariant);
}

function applyFlatCompatShimForDetail(itemData, defaultVariant) {
  const out = applyFlatCompatShim(itemData, defaultVariant);
  if (defaultVariant) {
    out.defaultVariant = defaultVariant;
  }
  return out;
}

module.exports = {
  VARIANT_PAYLOAD_KEYS,
  VARIANT_TO_ITEM_COMPAT_MAP,
  splitItemPayload,
  hasVariantPayloadFields,
  buildItemCompatFieldsFromVariant,
  applyFlatCompatShim,
  applyFlatCompatShimForList,
  applyFlatCompatShimForDetail
};
