'use strict';

/**
 * ItemVariant (+ parent Item) ↔ Tally Stock Item
 */

function resolveStockItemName(variant = {}, item = {}) {
  const itemName = item.item_name || item.name || null;
  const code = variant.variant_code || null;
  if (itemName && code && !itemName.includes(code)) {
    return `${itemName} (${code})`;
  }
  return itemName || code || (variant._id ? String(variant._id) : null);
}

/**
 * @param {object} variant - ItemVariant
 * @param {object} [item] - parent Item
 */
function toTally(variant = {}, item = {}) {
  const parentGroup =
    item.category ||
    (item.categoryId ? String(item.categoryId) : null) ||
    'Primary';

  return {
    masterType: 'STOCKITEM',
    name: resolveStockItemName(variant, item),
    parent: parentGroup,
    baseUnits: variant.unit_of_measure || item.unit_of_measure || 'Nos',
    hsnSac: variant.hsnSac || null,
    gstTaxability: variant.gstTaxability || null,
    gstRatePercent: variant.gstRatePercent != null ? Number(variant.gstRatePercent) : null,
    taxPercentage: variant.tax_percentage != null ? Number(variant.tax_percentage) : null,
    taxType: variant.tax_type || null,
    sellingPrice: variant.selling_price != null ? Number(variant.selling_price) : null,
    costPrice: variant.cost_price != null ? Number(variant.cost_price) : null,
    barcode: variant.barcode || null,
    variantCode: variant.variant_code || null,
    itemCode: item.item_code || null,
    arivuId: variant._id ? String(variant._id) : null,
    itemId: variant.itemId ? String(variant.itemId) : item._id ? String(item._id) : null,
  };
}

/**
 * @param {object} stockItem - Tally stock item fields
 */
function fromTally(stockItem = {}) {
  return {
    variant_code: stockItem.variantCode || stockItem.name || stockItem.NAME || null,
    unit_of_measure: stockItem.baseUnits || stockItem.BASEUNITS || null,
    hsnSac: stockItem.hsnSac || stockItem.HSNCODE || stockItem.HSN || null,
    gstRatePercent:
      stockItem.gstRatePercent != null
        ? Number(stockItem.gstRatePercent)
        : stockItem.GSTRATE != null
          ? Number(stockItem.GSTRATE)
          : null,
    gstTaxability: stockItem.gstTaxability || null,
    selling_price:
      stockItem.sellingPrice != null
        ? Number(stockItem.sellingPrice)
        : stockItem.RATE != null
          ? Number(stockItem.RATE)
          : null,
    barcode: stockItem.barcode || stockItem.BARCODE || null,
    externalReferenceId: stockItem.masterId || stockItem.MASTERID || stockItem.guid || stockItem.GUID || null,
    itemName: stockItem.name || stockItem.NAME || null,
    parentGroup: stockItem.parent || stockItem.PARENT || null,
  };
}

module.exports = {
  toTally,
  fromTally,
  resolveStockItemName,
};
