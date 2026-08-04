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
  const found = await getAdjustmentById({ organizationId, inventoryAdjustmentId });
  if (!found) {
    const err = new Error('Inventory adjustment not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const adjustment = await InventoryAdjustment.findOne({
    organizationId,
    inventoryAdjustmentId: found.inventoryAdjustmentId
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
  const raw = inventoryAdjustmentId == null ? '' : String(inventoryAdjustmentId).trim();
  if (!raw) return null;

  let row = await InventoryAdjustment.findOne({ organizationId, inventoryAdjustmentId: raw }).lean();
  if (!row && require('mongoose').Types.ObjectId.isValid(raw)) {
    row = await InventoryAdjustment.findOne({ organizationId, _id: raw }).lean();
  }
  return row;
}

async function listAdjustments({ organizationId, status = null, limit = 200 }) {
  const query = { organizationId };
  if (status) {
    const statuses = String(status)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (statuses.length === 1) query.status = statuses[0];
    else if (statuses.length > 1) query.status = { $in: statuses };
  }
  const cap = Math.min(Math.max(Number(limit) || 200, 1), 500);
  const rows = await InventoryAdjustment.find(query).sort({ createdAt: -1 }).limit(cap).lean();

  const locIds = [
    ...new Set(rows.map((r) => r.inventoryLocationId).filter(Boolean).map(String))
  ];
  let nameById = new Map();
  if (locIds.length) {
    const InventoryLocation = require('../models/InventoryLocation');
    const locs = await InventoryLocation.find({
      organizationId,
      inventoryLocationId: { $in: locIds }
    })
      .select({ inventoryLocationId: 1, name: 1, locationCode: 1 })
      .lean();
    nameById = new Map(
      locs.map((l) => [
        String(l.inventoryLocationId),
        l.name || l.locationCode || String(l.inventoryLocationId)
      ])
    );
  }

  return rows.map((row) => ({
    ...row,
    inventoryLocationName:
      nameById.get(String(row.inventoryLocationId)) || row.inventoryLocationId || null
  }));
}

module.exports = {
  createAdjustment,
  postAdjustment,
  getAdjustmentById,
  listAdjustments
};
