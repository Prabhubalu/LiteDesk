/**
 * INV0 — Inventory adjustments (opening balances + corrections).
 */

const InventoryAdjustment = require('../models/InventoryAdjustment');
const { roundQty } = require('../constants/inventoryLifecycle');
const { assertActiveLocation, getDefaultLocation } = require('./inventoryLocationService');
const { postInventoryTransaction } = require('./inventoryTransactionService');
const { writeInventoryActivity } = require('./inventoryActivityService');

async function createAdjustment({
  organizationId,
  userId,
  inventoryLocationId = null,
  reasonCode = 'correction',
  lines = [],
  notes = null
}) {
  const location = inventoryLocationId
    ? await assertActiveLocation({ organizationId, inventoryLocationId })
    : await getDefaultLocation(organizationId, userId);

  if (!lines.length) {
    const err = new Error('At least one adjustment line is required');
    err.code = 'VALIDATION';
    throw err;
  }

  const adjustment = await InventoryAdjustment.create({
    organizationId,
    inventoryLocationId: location.inventoryLocationId,
    reasonCode,
    lines: lines.map((line) => ({
      variantId: line.variantId,
      quantityDelta: roundQty(line.quantityDelta),
      unitCostSnapshot: line.unitCostSnapshot != null ? roundQty(line.unitCostSnapshot) : 0,
      notes: line.notes || null
    })),
    notes,
    createdBy: userId || null,
    status: 'draft'
  });

  await writeInventoryActivity({
    organizationId,
    recordId: adjustment.inventoryAdjustmentId,
    userId,
    action: 'inventory_adjustment_created',
    message: `Adjustment draft created (${reasonCode})`,
    details: { inventoryAdjustmentId: adjustment.inventoryAdjustmentId }
  });

  return adjustment.toObject();
}

async function postAdjustment({ organizationId, inventoryAdjustmentId, userId }) {
  const adjustment = await InventoryAdjustment.findOne({
    organizationId,
    inventoryAdjustmentId
  });

  if (!adjustment) {
    const err = new Error('Inventory adjustment not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  if (adjustment.status === 'posted') {
    return { duplicate: true, adjustment: adjustment.toObject() };
  }

  if (adjustment.status !== 'draft') {
    const err = new Error('Only draft adjustments can be posted');
    err.code = 'VALIDATION';
    throw err;
  }

  const transactionType =
    adjustment.reasonCode === 'opening_balance' ? 'opening_balance' : 'adjustment';

  const result = await postInventoryTransaction({
    organizationId,
    userId,
    transactionType,
    inventoryLocationId: adjustment.inventoryLocationId,
    sourceContext: adjustment.reasonCode === 'opening_balance' ? 'opening_balance' : 'adjustment',
    sourceRef: {
      moduleKey: 'inventory_adjustments',
      recordId: adjustment.inventoryAdjustmentId
    },
    notes: adjustment.notes,
    lines: adjustment.lines.map((line, index) => ({
      variantId: line.variantId,
      quantityDelta: line.quantityDelta,
      unitCostSnapshot: line.unitCostSnapshot,
      lineId: String(line.variantId),
      entryType:
        adjustment.reasonCode === 'opening_balance'
          ? 'opening_balance'
          : line.quantityDelta >= 0
            ? 'adjustment_in'
            : 'adjustment_out',
      notes: line.notes
    }))
  });

  adjustment.status = 'posted';
  adjustment.postedAt = new Date();
  adjustment.postedBy = userId || null;
  adjustment.inventoryTransactionId = result.transaction?.inventoryTransactionId || null;
  await adjustment.save();

  await writeInventoryActivity({
    organizationId,
    recordId: adjustment.inventoryAdjustmentId,
    userId,
    action: 'inventory_adjustment_posted',
    message: `Adjustment posted (${adjustment.reasonCode})`,
    details: {
      inventoryAdjustmentId: adjustment.inventoryAdjustmentId,
      inventoryTransactionId: adjustment.inventoryTransactionId
    }
  });

  return {
    duplicate: result.duplicate || false,
    adjustment: adjustment.toObject(),
    transaction: result.transaction,
    ledgerEntries: result.ledgerEntries,
    balances: result.balances
  };
}

async function getAdjustmentById({ organizationId, inventoryAdjustmentId }) {
  return InventoryAdjustment.findOne({ organizationId, inventoryAdjustmentId }).lean();
}

async function listAdjustments({ organizationId, status = null, limit = 50 }) {
  const query = { organizationId };
  if (status) query.status = status;
  return InventoryAdjustment.find(query).sort({ createdAt: -1 }).limit(limit).lean();
}

module.exports = {
  createAdjustment,
  postAdjustment,
  getAdjustmentById,
  listAdjustments
};
