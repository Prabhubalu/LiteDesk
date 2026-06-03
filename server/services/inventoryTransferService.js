/**
 * INV2 — Inventory transfers (draft → post paired ledger legs).
 */

const InventoryTransfer = require('../models/InventoryTransfer');
const { roundQty } = require('../constants/inventoryLifecycle');
const { assertActiveLocation } = require('./inventoryLocationService');
const { postInventoryTransferTransaction } = require('./inventoryTransactionService');
const { writeInventoryActivity } = require('./inventoryActivityService');

async function createTransfer({
  organizationId,
  userId,
  fromLocationId,
  toLocationId,
  lines = [],
  notes = null
}) {
  await assertActiveLocation({ organizationId, inventoryLocationId: fromLocationId });
  await assertActiveLocation({ organizationId, inventoryLocationId: toLocationId });

  if (String(fromLocationId) === String(toLocationId)) {
    const err = new Error('Transfer source and destination must differ');
    err.code = 'VALIDATION';
    throw err;
  }

  if (!lines.length) {
    const err = new Error('At least one transfer line is required');
    err.code = 'VALIDATION';
    throw err;
  }

  const transfer = await InventoryTransfer.create({
    organizationId,
    fromLocationId,
    toLocationId,
    lines: lines.map((line) => ({
      variantId: line.variantId,
      quantity: roundQty(line.quantity),
      unitCostSnapshot: line.unitCostSnapshot != null ? roundQty(line.unitCostSnapshot) : 0,
      notes: line.notes || null
    })),
    notes,
    createdBy: userId || null,
    status: 'draft'
  });

  await writeInventoryActivity({
    organizationId,
    recordId: transfer.inventoryTransferId,
    userId,
    action: 'inventory_transfer_created',
    message: 'Transfer draft created',
    details: { inventoryTransferId: transfer.inventoryTransferId }
  });

  return transfer.toObject();
}

async function postTransfer({ organizationId, inventoryTransferId, userId }) {
  const transfer = await InventoryTransfer.findOne({ organizationId, inventoryTransferId });
  if (!transfer) {
    const err = new Error('Inventory transfer not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  if (transfer.status === 'posted') {
    return { duplicate: true, transfer: transfer.toObject() };
  }

  if (transfer.status !== 'draft' && transfer.status !== 'in_transit') {
    const err = new Error('Only draft or in_transit transfers can be posted');
    err.code = 'VALIDATION';
    throw err;
  }

  const result = await postInventoryTransferTransaction({
    organizationId,
    userId,
    fromLocationId: transfer.fromLocationId,
    toLocationId: transfer.toLocationId,
    lines: transfer.lines.map((line) => ({
      variantId: line.variantId,
      quantity: line.quantity,
      unitCostSnapshot: line.unitCostSnapshot,
      lineId: line.inventoryTransferLineId,
      notes: line.notes
    })),
    sourceRef: {
      moduleKey: 'inventory_transfers',
      recordId: transfer.inventoryTransferId
    },
    notes: transfer.notes
  });

  transfer.status = 'posted';
  transfer.postedAt = new Date();
  transfer.postedBy = userId || null;
  transfer.receivedAt = transfer.receivedAt || new Date();
  transfer.inventoryTransactionId = result.transaction?.inventoryTransactionId || null;
  await transfer.save();

  await writeInventoryActivity({
    organizationId,
    recordId: transfer.inventoryTransferId,
    userId,
    action: 'inventory_transfer_posted',
    message: 'Transfer posted',
    details: {
      inventoryTransferId: transfer.inventoryTransferId,
      inventoryTransactionId: transfer.inventoryTransactionId
    }
  });

  return {
    duplicate: result.duplicate || false,
    transfer: transfer.toObject(),
    transaction: result.transaction,
    ledgerEntries: result.ledgerEntries,
    balances: result.balances
  };
}

async function getTransferById({ organizationId, inventoryTransferId }) {
  return InventoryTransfer.findOne({ organizationId, inventoryTransferId }).lean();
}

async function listTransfers({ organizationId, status = null, limit = 100 }) {
  const query = { organizationId };
  if (status) query.status = status;
  return InventoryTransfer.find(query).sort({ createdAt: -1 }).limit(limit).lean();
}

module.exports = {
  createTransfer,
  postTransfer,
  getTransferById,
  listTransfers
};
