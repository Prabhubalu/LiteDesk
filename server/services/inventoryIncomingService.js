/**
 * INV4 — Procurement incoming qty stub (no PO module).
 */

const InventoryIncomingStub = require('../models/InventoryIncomingStub');
const ItemInventory = require('../models/ItemInventory');
const { roundQty, computeAvailable } = require('../constants/inventoryLifecycle');
const { assertActiveLocation } = require('./inventoryLocationService');
const { postInventoryTransaction } = require('./inventoryTransactionService');
const { recomputeItemInventory } = require('./inventoryRollupService');
const { writeInventoryActivity } = require('./inventoryActivityService');

async function sumActiveIncoming({ organizationId, variantId, inventoryLocationId }) {
  const rows = await InventoryIncomingStub.aggregate([
    {
      $match: {
        organizationId,
        variantId,
        inventoryLocationId,
        status: 'active'
      }
    },
    { $group: { _id: null, total: { $sum: '$quantity' } } }
  ]);
  if (!rows.length) return 0;
  return roundQty(rows[0].total);
}

async function recomputeIncomingRollup({ organizationId, variantId, inventoryLocationId }) {
  const incoming = await sumActiveIncoming({ organizationId, variantId, inventoryLocationId });
  let balance = await ItemInventory.findOne({ organizationId, variantId, inventoryLocationId });

  if (!balance) {
    await recomputeItemInventory({ organizationId, variantId, inventoryLocationId });
    balance = await ItemInventory.findOne({ organizationId, variantId, inventoryLocationId });
  }

  if (!balance) {
    return { incoming, onHand: 0, reserved: 0, available: 0 };
  }

  balance.incoming = incoming;
  balance.available = computeAvailable({
    onHand: balance.onHand,
    reserved: balance.reserved,
    safetyStock: balance.safetyStock,
    incoming
  });
  await balance.save();
  return balance.toObject();
}

async function createIncomingStub({
  organizationId,
  variantId,
  inventoryLocationId,
  quantity,
  expectedAt = null,
  notes = null,
  sourceRef = null,
  userId = null
}) {
  await assertActiveLocation({ organizationId, inventoryLocationId });
  const qty = roundQty(quantity);
  if (qty <= 0) {
    const err = new Error('quantity must be positive');
    err.code = 'VALIDATION';
    throw err;
  }

  const stub = await InventoryIncomingStub.create({
    organizationId,
    variantId,
    inventoryLocationId,
    quantity: qty,
    expectedAt,
    notes,
    sourceRef: sourceRef || { moduleKey: 'purchase_orders', recordId: null, lineId: null },
    createdBy: userId || null
  });

  await recomputeIncomingRollup({ organizationId, variantId, inventoryLocationId });

  await writeInventoryActivity({
    organizationId,
    recordId: stub.inventoryIncomingStubId,
    userId,
    action: 'inventory_incoming_stub_created',
    message: 'Incoming quantity stub created',
    details: {
      inventoryIncomingStubId: stub.inventoryIncomingStubId,
      quantity: qty,
      variantId: String(variantId),
      inventoryLocationId
    }
  });

  return stub.toObject();
}

async function cancelIncomingStub({ organizationId, inventoryIncomingStubId, userId = null }) {
  const stub = await InventoryIncomingStub.findOne({ organizationId, inventoryIncomingStubId });
  if (!stub) {
    const err = new Error('Incoming stub not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (stub.status !== 'active') {
    const err = new Error('Only active incoming stubs can be cancelled');
    err.code = 'VALIDATION';
    throw err;
  }

  stub.status = 'cancelled';
  await stub.save();

  await recomputeIncomingRollup({
    organizationId,
    variantId: stub.variantId,
    inventoryLocationId: stub.inventoryLocationId
  });

  await writeInventoryActivity({
    organizationId,
    recordId: stub.inventoryIncomingStubId,
    userId,
    action: 'inventory_incoming_stub_cancelled',
    message: 'Incoming quantity stub cancelled',
    details: { inventoryIncomingStubId: stub.inventoryIncomingStubId }
  });

  return stub.toObject();
}

async function receiveIncomingStub({
  organizationId,
  inventoryIncomingStubId,
  userId = null,
  unitCostSnapshot = null
}) {
  const stub = await InventoryIncomingStub.findOne({ organizationId, inventoryIncomingStubId });
  if (!stub) {
    const err = new Error('Incoming stub not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (stub.status !== 'active') {
    const err = new Error('Only active incoming stubs can be received');
    err.code = 'VALIDATION';
    throw err;
  }

  const result = await postInventoryTransaction({
    organizationId,
    userId,
    transactionType: 'adjustment',
    inventoryLocationId: stub.inventoryLocationId,
    lines: [
      {
        variantId: stub.variantId,
        quantityDelta: stub.quantity,
        entryType: 'receipt',
        unitCostSnapshot,
        lineId: stub.inventoryIncomingStubId
      }
    ],
    sourceContext: 'purchase_receipt',
    sourceRef: {
      moduleKey: stub.sourceRef?.moduleKey || 'purchase_orders',
      recordId: stub.sourceRef?.recordId || stub.inventoryIncomingStubId,
      lineId: stub.sourceRef?.lineId || stub.inventoryIncomingStubId
    },
    idempotent: true
  });

  stub.status = 'received';
  await stub.save();

  await recomputeIncomingRollup({
    organizationId,
    variantId: stub.variantId,
    inventoryLocationId: stub.inventoryLocationId
  });

  await writeInventoryActivity({
    organizationId,
    recordId: stub.inventoryIncomingStubId,
    userId,
    action: 'inventory_incoming_stub_received',
    message: 'Incoming quantity stub received into stock',
    details: {
      inventoryIncomingStubId: stub.inventoryIncomingStubId,
      inventoryTransactionId: result.transaction?.inventoryTransactionId || null
    }
  });

  return { stub: stub.toObject(), receipt: result };
}

async function listIncomingStubs({
  organizationId,
  variantId = null,
  inventoryLocationId = null,
  status = null,
  limit = 100
}) {
  const query = { organizationId };
  if (variantId) query.variantId = variantId;
  if (inventoryLocationId) query.inventoryLocationId = inventoryLocationId;
  if (status) query.status = status;
  return InventoryIncomingStub.find(query).sort({ createdAt: -1 }).limit(limit).lean();
}

async function getIncomingStubById({ organizationId, inventoryIncomingStubId }) {
  return InventoryIncomingStub.findOne({ organizationId, inventoryIncomingStubId }).lean();
}

module.exports = {
  sumActiveIncoming,
  recomputeIncomingRollup,
  createIncomingStub,
  cancelIncomingStub,
  receiveIncomingStub,
  listIncomingStubs,
  getIncomingStubById
};
