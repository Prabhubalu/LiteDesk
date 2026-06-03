/**
 * INV0 — ItemInventory rollup from InventoryLedgerEntry (stock authority).
 */

const InventoryLedgerEntry = require('../models/InventoryLedgerEntry');
const ItemInventory = require('../models/ItemInventory');
const ItemVariant = require('../models/ItemVariant');
const { roundQty, computeAvailable } = require('../constants/inventoryLifecycle');

async function sumLedgerOnHand({ organizationId, variantId, inventoryLocationId }) {
  const rows = await InventoryLedgerEntry.aggregate([
    {
      $match: {
        organizationId,
        variantId,
        inventoryLocationId,
        status: 'posted'
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$quantityDelta' },
        lastAt: { $max: '$postedAt' }
      }
    }
  ]);

  if (!rows.length) {
    return { onHand: 0, lastLedgerEntryAt: null };
  }

  return {
    onHand: roundQty(rows[0].total),
    lastLedgerEntryAt: rows[0].lastAt || null
  };
}

async function recomputeItemInventory({
  organizationId,
  variantId,
  inventoryLocationId,
  reserved = null,
  safetyStock = null
}) {
  const { onHand, lastLedgerEntryAt } = await sumLedgerOnHand({
    organizationId,
    variantId,
    inventoryLocationId
  });

  let existing = await ItemInventory.findOne({
    organizationId,
    variantId,
    inventoryLocationId
  });

  const variant = await ItemVariant.findOne({ _id: variantId, organizationId })
    .select('itemId unit_of_measure')
    .lean();

  const nextReserved = reserved != null ? roundQty(reserved) : roundQty(existing?.reserved || 0);
  const nextSafety = safetyStock != null ? roundQty(safetyStock) : roundQty(existing?.safetyStock || 0);
  const incoming = roundQty(existing?.incoming || 0);
  const available = computeAvailable({
    onHand,
    reserved: nextReserved,
    safetyStock: nextSafety,
    incoming
  });

  const patch = {
    onHand,
    reserved: nextReserved,
    safetyStock: nextSafety,
    incoming,
    available,
    lastLedgerEntryAt,
    unitOfMeasure: variant?.unit_of_measure || existing?.unitOfMeasure || null,
    itemId: variant?.itemId || existing?.itemId || null
  };

  if (existing) {
    Object.assign(existing, patch);
    await existing.save();
    return existing.toObject();
  }

  existing = await ItemInventory.create({
    organizationId,
    variantId,
    inventoryLocationId,
    ...patch
  });

  return existing.toObject();
}

async function getBalance({ organizationId, variantId, inventoryLocationId }) {
  return ItemInventory.findOne({ organizationId, variantId, inventoryLocationId }).lean();
}

async function listBalances({ organizationId, inventoryLocationId = null, variantId = null, limit = 100 }) {
  const query = { organizationId };
  if (inventoryLocationId) query.inventoryLocationId = inventoryLocationId;
  if (variantId) query.variantId = variantId;
  return ItemInventory.find(query).sort({ updatedAt: -1 }).limit(limit).lean();
}

module.exports = {
  sumLedgerOnHand,
  recomputeItemInventory,
  getBalance,
  listBalances
};
