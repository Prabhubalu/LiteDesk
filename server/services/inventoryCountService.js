/**
 * INV2 — Cycle count sessions + variance posting.
 */

const InventoryCount = require('../models/InventoryCount');
const ItemVariant = require('../models/ItemVariant');
const { roundQty } = require('../constants/inventoryLifecycle');
const { assertActiveLocation } = require('./inventoryLocationService');
const { getBalance } = require('./inventoryRollupService');
const { postInventoryTransaction } = require('./inventoryTransactionService');
const { writeInventoryActivity } = require('./inventoryActivityService');

function computeVariance(systemQty, countedQty) {
  return roundQty(roundQty(countedQty) - roundQty(systemQty));
}

async function createCount({
  organizationId,
  userId,
  inventoryLocationId,
  sessionTitle = null,
  lines = [],
  notes = null
}) {
  await assertActiveLocation({ organizationId, inventoryLocationId });

  const count = await InventoryCount.create({
    organizationId,
    inventoryLocationId,
    sessionTitle,
    lines: lines.map((line) => ({
      variantId: line.variantId,
      systemQty: 0,
      countedQty: line.countedQty != null ? roundQty(line.countedQty) : null,
      varianceQty: 0,
      unitCostSnapshot: line.unitCostSnapshot != null ? roundQty(line.unitCostSnapshot) : 0,
      notes: line.notes || null
    })),
    notes,
    createdBy: userId || null,
    status: 'draft'
  });

  await writeInventoryActivity({
    organizationId,
    recordId: count.inventoryCountId,
    userId,
    action: 'inventory_count_created',
    message: 'Count session draft created',
    details: { inventoryCountId: count.inventoryCountId }
  });

  return count.toObject();
}

async function startCountSession({ organizationId, inventoryCountId, userId, lines = null }) {
  const count = await InventoryCount.findOne({ organizationId, inventoryCountId });
  if (!count) {
    const err = new Error('Inventory count not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  if (count.status !== 'draft') {
    const err = new Error('Only draft count sessions can be started');
    err.code = 'VALIDATION';
    throw err;
  }

  if (Array.isArray(lines) && lines.length) {
    count.lines = lines.map((line) => ({
      variantId: line.variantId,
      systemQty: 0,
      countedQty: line.countedQty != null ? roundQty(line.countedQty) : null,
      varianceQty: 0,
      unitCostSnapshot: line.unitCostSnapshot != null ? roundQty(line.unitCostSnapshot) : 0,
      notes: line.notes || null
    }));
  }

  for (const line of count.lines) {
    const balance = await getBalance({
      organizationId,
      variantId: line.variantId,
      inventoryLocationId: count.inventoryLocationId
    });
    line.systemQty = roundQty(balance?.onHand || 0);
    if (line.countedQty != null) {
      line.varianceQty = computeVariance(line.systemQty, line.countedQty);
    }

    if (!line.unitCostSnapshot) {
      const variant = await ItemVariant.findOne({ _id: line.variantId, organizationId })
        .select('cost_price')
        .lean();
      line.unitCostSnapshot = roundQty(variant?.cost_price || 0);
    }
  }

  count.status = 'counting';
  count.countingStartedAt = new Date();
  await count.save();

  await writeInventoryActivity({
    organizationId,
    recordId: count.inventoryCountId,
    userId,
    action: 'inventory_count_started',
    message: 'Count session started — system quantities snapshotted',
    details: { inventoryCountId: count.inventoryCountId, lineCount: count.lines.length }
  });

  return count.toObject();
}

async function updateCountLines({ organizationId, inventoryCountId, lines = [], userId = null }) {
  const count = await InventoryCount.findOne({ organizationId, inventoryCountId });
  if (!count) {
    const err = new Error('Inventory count not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  if (count.status !== 'counting') {
    const err = new Error('Count lines can only be updated while session is counting');
    err.code = 'VALIDATION';
    throw err;
  }

  const lineById = new Map(count.lines.map((row) => [String(row.inventoryCountLineId), row]));

  for (const input of lines) {
    const key = String(input.inventoryCountLineId || input.lineId || '').trim();
    const row = lineById.get(key);
    if (!row) {
      const err = new Error(`Count line not found: ${key}`);
      err.code = 'LINE_NOT_FOUND';
      throw err;
    }
    if (input.countedQty != null) {
      row.countedQty = roundQty(input.countedQty);
      row.varianceQty = computeVariance(row.systemQty, row.countedQty);
    }
    if (input.notes != null) row.notes = String(input.notes).trim().slice(0, 500);
  }

  await count.save();

  await writeInventoryActivity({
    organizationId,
    recordId: count.inventoryCountId,
    userId,
    action: 'inventory_count_updated',
    message: 'Count lines updated',
    details: { inventoryCountId: count.inventoryCountId }
  });

  return count.toObject();
}

async function postCount({ organizationId, inventoryCountId, userId }) {
  const count = await InventoryCount.findOne({ organizationId, inventoryCountId });
  if (!count) {
    const err = new Error('Inventory count not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  if (count.status === 'posted') {
    return { duplicate: true, count: count.toObject() };
  }

  if (count.status !== 'counting') {
    const err = new Error('Only counting sessions can be posted');
    err.code = 'VALIDATION';
    throw err;
  }

  const varianceLines = count.lines
    .filter((line) => line.countedQty != null && roundQty(line.varianceQty) !== 0)
    .map((line) => ({
      variantId: line.variantId,
      quantityDelta: roundQty(line.varianceQty),
      unitCostSnapshot: line.unitCostSnapshot,
      lineId: line.inventoryCountLineId,
      entryType: 'count_variance',
      notes: line.notes
    }));

  let result = { duplicate: false, transaction: null, ledgerEntries: [], balances: [] };

  if (varianceLines.length) {
    result = await postInventoryTransaction({
      organizationId,
      userId,
      transactionType: 'count_variance',
      inventoryLocationId: count.inventoryLocationId,
      sourceContext: 'count',
      sourceRef: {
        moduleKey: 'inventory_counts',
        recordId: count.inventoryCountId
      },
      notes: count.notes,
      lines: varianceLines
    });
  }

  count.status = 'posted';
  count.postedAt = new Date();
  count.postedBy = userId || null;
  count.countedAt = count.countedAt || new Date();
  count.inventoryTransactionId = result.transaction?.inventoryTransactionId || null;

  for (const line of count.lines) {
    if (line.countedQty != null) {
      line.varianceQty = computeVariance(line.systemQty, line.countedQty);
    }
  }

  await count.save();

  await writeInventoryActivity({
    organizationId,
    recordId: count.inventoryCountId,
    userId,
    action: 'inventory_count_posted',
    message: 'Count variances posted',
    details: {
      inventoryCountId: count.inventoryCountId,
      inventoryTransactionId: count.inventoryTransactionId,
      varianceLineCount: varianceLines.length
    }
  });

  return {
    duplicate: result.duplicate || false,
    count: count.toObject(),
    transaction: result.transaction,
    ledgerEntries: result.ledgerEntries,
    balances: result.balances
  };
}

async function getCountById({ organizationId, inventoryCountId }) {
  return InventoryCount.findOne({ organizationId, inventoryCountId }).lean();
}

async function listCounts({ organizationId, inventoryLocationId = null, status = null, limit = 100 }) {
  const query = { organizationId };
  if (inventoryLocationId) query.inventoryLocationId = inventoryLocationId;
  if (status) query.status = status;
  return InventoryCount.find(query).sort({ createdAt: -1 }).limit(limit).lean();
}

module.exports = {
  createCount,
  startCountSession,
  updateCountLines,
  postCount,
  getCountById,
  listCounts
};
