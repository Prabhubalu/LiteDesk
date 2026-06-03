/**
 * INV4 — Valuation context resolution + COGS hook emission (no GL).
 */

const {
  roundQty,
  INVENTORY_VALUATION_METHOD_DEFAULT
} = require('../constants/inventoryLifecycle');
const { getOrCreateSettings } = require('./inventorySettingsService');
const { writeInventoryActivity } = require('./inventoryActivityService');

const COGS_ENTRY_TYPES = new Set(['fulfillment_deduct', 'shipment', 'transfer_out', 'adjustment_out']);

async function resolveValuationContext({ variant, line = {}, settings = null, organizationId }) {
  const resolvedSettings = settings || (await getOrCreateSettings(organizationId));

  const unitCostSnapshot = roundQty(
    line.unitCostSnapshot != null ? line.unitCostSnapshot : variant.cost_price || 0
  );

  let valuationMethod = line.valuationMethod || resolvedSettings.defaultValuationMethod;
  if (!valuationMethod) valuationMethod = INVENTORY_VALUATION_METHOD_DEFAULT;

  let costSource = line.costSource || 'catalog_cost';
  if (line.unitCostSnapshot != null && line.unitCostSnapshot !== variant.cost_price) {
    costSource = line.costSource || 'manual_override';
  }

  return { unitCostSnapshot, valuationMethod, costSource };
}

async function emitCostOfGoodsCalculated({
  organizationId,
  ledgerEntry,
  userId = null,
  transaction = null
}) {
  if (!ledgerEntry || roundQty(ledgerEntry.quantityDelta) >= 0) return null;
  if (!COGS_ENTRY_TYPES.has(ledgerEntry.entryType)) return null;

  const payload = {
    inventoryLedgerEntryId: ledgerEntry.inventoryLedgerEntryId,
    inventoryTransactionId: ledgerEntry.inventoryTransactionId,
    variantId: String(ledgerEntry.variantId),
    inventoryLocationId: ledgerEntry.inventoryLocationId,
    quantityDelta: roundQty(ledgerEntry.quantityDelta),
    unitCostSnapshot: roundQty(ledgerEntry.unitCostSnapshot || 0),
    extendedCost: roundQty(ledgerEntry.extendedCost || 0),
    valuationMethod: ledgerEntry.valuationMethod || INVENTORY_VALUATION_METHOD_DEFAULT,
    costSource: ledgerEntry.costSource || 'catalog_cost',
    entryType: ledgerEntry.entryType,
    transactionType: transaction?.transactionType || null,
    sourceRef: ledgerEntry.sourceRef || null
  };

  await writeInventoryActivity({
    organizationId,
    recordId: ledgerEntry.inventoryLedgerEntryId,
    userId,
    action: 'inventory.cost_of_goods_calculated',
    message: 'Inventory cost of goods calculated',
    details: payload
  });

  return payload;
}

module.exports = {
  resolveValuationContext,
  emitCostOfGoodsCalculated
};
