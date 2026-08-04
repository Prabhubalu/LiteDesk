const test = require('node:test');
const assert = require('node:assert/strict');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

const ItemInventory = require('../../models/ItemInventory');
const InventoryLedgerEntry = require('../../models/InventoryLedgerEntry');
const InventoryReservation = require('../../models/InventoryReservation');
const SalesOrderLine = require('../../models/SalesOrderLine');
const OrganizationInventorySettings = require('../../models/OrganizationInventorySettings');
const ItemVariant = require('../../models/ItemVariant');
const {
  DEFAULT_MAIN_WAREHOUSE_CODE,
  roundQty
} = require('../../constants/inventoryLifecycle');
const { ensureMainWarehouse } = require('../../services/inventoryLocationService');
const {
  createAdjustment,
  postAdjustment
} = require('../../services/inventoryAdjustmentService');
const { rebuildAllBalances, detectRollupDrift } = require('../../services/inventoryBalanceRebuildService');
const { createTransfer, postTransfer } = require('../../services/inventoryTransferService');
const {
  createCount,
  startCountSession,
  updateCountLines,
  postCount
} = require('../../services/inventoryCountService');
const { sumLedgerOnHand } = require('../../services/inventoryRollupService');
const { confirmSalesOrder, cancelSalesOrder } = require('../../services/salesOrderManualService');
const { postSalesOrderFulfillment } = require('../../services/salesOrderFulfillmentService');
const { getAtpForVariant } = require('../../services/inventoryAtpService');
const {
  seedInventoryContext,
  seedSalesOnlyContext,
  createTestSalesOrderWithLine,
  createSecondaryLocation
} = require('./helpers/inventoryTestHelper');

let mongoServer;

test.before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

test.after(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

test('ensureMainWarehouse creates MAIN default location per org', async () => {
  const { tenant } = await seedInventoryContext();
  const location = await ensureMainWarehouse(tenant._id);
  assert.equal(location.locationCode, DEFAULT_MAIN_WAREHOUSE_CODE);
  assert.equal(location.isDefault, true);

  const again = await ensureMainWarehouse(tenant._id);
  assert.equal(again.inventoryLocationId, location.inventoryLocationId);
});

test('opening balance posts ledger entry and ItemInventory rollup', async () => {
  const { tenant, variant, userId } = await seedInventoryContext();
  const location = await ensureMainWarehouse(tenant._id);

  const adjustment = await createAdjustment({
    organizationId: tenant._id,
    userId,
    inventoryLocationId: location.inventoryLocationId,
    reasonCode: 'opening_balance',
    lines: [{ variantId: variant._id, quantityDelta: 25, unitCostSnapshot: 12 }]
  });

  const result = await postAdjustment({
    organizationId: tenant._id,
    inventoryAdjustmentId: adjustment.inventoryAdjustmentId,
    userId
  });

  assert.equal(result.duplicate, false);
  assert.equal(result.balances[0].onHand, 25);

  const ledgerCount = await InventoryLedgerEntry.countDocuments({
    organizationId: tenant._id,
    status: 'posted'
  });
  assert.equal(ledgerCount, 1);

  const balance = await ItemInventory.findOne({
    organizationId: tenant._id,
    variantId: variant._id,
    inventoryLocationId: location.inventoryLocationId
  }).lean();
  assert.equal(Number(balance.onHand), 25);
  assert.equal(Number(balance.available), 25);
});

test('correction uses append-only ledger — second adjustment entry', async () => {
  const { tenant, variant, userId } = await seedInventoryContext();
  const location = await ensureMainWarehouse(tenant._id);

  const opening = await createAdjustment({
    organizationId: tenant._id,
    userId,
    inventoryLocationId: location.inventoryLocationId,
    reasonCode: 'opening_balance',
    lines: [{ variantId: variant._id, quantityDelta: 10 }]
  });

  await postAdjustment({
    organizationId: tenant._id,
    inventoryAdjustmentId: opening.inventoryAdjustmentId,
    userId
  });

  const correction = await createAdjustment({
    organizationId: tenant._id,
    userId,
    inventoryLocationId: location.inventoryLocationId,
    reasonCode: 'correction',
    lines: [{ variantId: variant._id, quantityDelta: -3 }]
  });

  await postAdjustment({
    organizationId: tenant._id,
    inventoryAdjustmentId: correction.inventoryAdjustmentId,
    userId
  });

  const ledgerCount = await InventoryLedgerEntry.countDocuments({
    organizationId: tenant._id,
    status: 'posted'
  });
  assert.equal(ledgerCount, 2);

  const { onHand } = await sumLedgerOnHand({
    organizationId: tenant._id,
    variantId: variant._id,
    inventoryLocationId: location.inventoryLocationId
  });
  assert.equal(onHand, 7);
});

test('negative stock blocked by default', async () => {
  const { tenant, variant, userId } = await seedInventoryContext();
  const location = await ensureMainWarehouse(tenant._id);

  const adjustment = await createAdjustment({
    organizationId: tenant._id,
    userId,
    inventoryLocationId: location.inventoryLocationId,
    reasonCode: 'correction',
    lines: [{ variantId: variant._id, quantityDelta: -5 }]
  });

  await assert.rejects(
    () =>
      postAdjustment({
        organizationId: tenant._id,
        inventoryAdjustmentId: adjustment.inventoryAdjustmentId,
        userId
      }),
    (err) => err.code === 'INSUFFICIENT_STOCK'
  );
});

test('org allowNegativeInventory permits negative on-hand', async () => {
  const { tenant, variant, userId } = await seedInventoryContext();
  const location = await ensureMainWarehouse(tenant._id);

  await OrganizationInventorySettings.updateOne(
    { organizationId: tenant._id },
    { $set: { allowNegativeInventory: true } },
    { upsert: true }
  );

  const adjustment = await createAdjustment({
    organizationId: tenant._id,
    userId,
    inventoryLocationId: location.inventoryLocationId,
    reasonCode: 'correction',
    lines: [{ variantId: variant._id, quantityDelta: -2 }]
  });

  const result = await postAdjustment({
    organizationId: tenant._id,
    inventoryAdjustmentId: adjustment.inventoryAdjustmentId,
    userId
  });

  assert.equal(result.balances[0].onHand, -2);
});

test('duplicate adjustment post is idempotent', async () => {
  const { tenant, variant, userId } = await seedInventoryContext();
  const location = await ensureMainWarehouse(tenant._id);

  const adjustment = await createAdjustment({
    organizationId: tenant._id,
    userId,
    inventoryLocationId: location.inventoryLocationId,
    reasonCode: 'opening_balance',
    lines: [{ variantId: variant._id, quantityDelta: 15 }]
  });

  const first = await postAdjustment({
    organizationId: tenant._id,
    inventoryAdjustmentId: adjustment.inventoryAdjustmentId,
    userId
  });
  const second = await postAdjustment({
    organizationId: tenant._id,
    inventoryAdjustmentId: adjustment.inventoryAdjustmentId,
    userId
  });

  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true);

  const ledgerCount = await InventoryLedgerEntry.countDocuments({
    organizationId: tenant._id
  });
  assert.equal(ledgerCount, 1);
});

test('rebuild balances recomputes from ledger authority', async () => {
  const { tenant, variant, userId } = await seedInventoryContext();
  const location = await ensureMainWarehouse(tenant._id);

  const opening = await createAdjustment({
    organizationId: tenant._id,
    userId,
    inventoryLocationId: location.inventoryLocationId,
    reasonCode: 'opening_balance',
    lines: [{ variantId: variant._id, quantityDelta: 42 }]
  });

  await postAdjustment({
    organizationId: tenant._id,
    inventoryAdjustmentId: opening.inventoryAdjustmentId,
    userId
  });

  await ItemInventory.updateOne(
    {
      organizationId: tenant._id,
      variantId: variant._id,
      inventoryLocationId: location.inventoryLocationId
    },
    { $set: { onHand: 999, available: 999 } }
  );

  const rebuild = await rebuildAllBalances({ organizationId: tenant._id, userId });
  assert.ok(rebuild.count >= 1);
  assert.equal(rebuild.ledgerUntouched, true);

  const balance = await ItemInventory.findOne({
    organizationId: tenant._id,
    variantId: variant._id,
    inventoryLocationId: location.inventoryLocationId
  }).lean();
  assert.equal(roundQty(balance.onHand), 42);
});

test('roundQty supports fractional units', () => {
  assert.equal(roundQty(1.23456), 1.2346);
});

test('SO confirm reserves stock and reduces ATP', async () => {
  const { tenant, variant, userId } = await seedInventoryContext();
  const location = await ensureMainWarehouse(tenant._id);

  const opening = await createAdjustment({
    organizationId: tenant._id,
    userId,
    inventoryLocationId: location.inventoryLocationId,
    reasonCode: 'opening_balance',
    lines: [{ variantId: variant._id, quantityDelta: 20 }]
  });
  await postAdjustment({
    organizationId: tenant._id,
    inventoryAdjustmentId: opening.inventoryAdjustmentId,
    userId
  });

  const { order, line } = await createTestSalesOrderWithLine({
    organizationId: tenant._id,
    userId,
    variantId: variant._id,
    quantity: 8
  });

  await confirmSalesOrder({
    organizationId: tenant._id,
    salesOrderRef: order.salesOrderId,
    userId
  });

  const reservation = await InventoryReservation.findOne({
    organizationId: tenant._id,
    salesOrderLineId: line.salesOrderLineId,
    status: 'active'
  }).lean();
  assert.ok(reservation);
  assert.equal(Number(reservation.quantity), 8);

  const atp = await getAtpForVariant({
    organizationId: tenant._id,
    variantId: variant._id,
    inventoryLocationId: location.inventoryLocationId
  });
  assert.equal(atp.onHand, 20);
  assert.equal(atp.reserved, 8);
  assert.equal(atp.available, 12);
});

test('partial reservation + backorder on confirm when ATP insufficient', async () => {
  const { tenant, variant, userId } = await seedInventoryContext();
  const location = await ensureMainWarehouse(tenant._id);

  const opening = await createAdjustment({
    organizationId: tenant._id,
    userId,
    inventoryLocationId: location.inventoryLocationId,
    reasonCode: 'opening_balance',
    lines: [{ variantId: variant._id, quantityDelta: 5 }]
  });
  await postAdjustment({
    organizationId: tenant._id,
    inventoryAdjustmentId: opening.inventoryAdjustmentId,
    userId
  });

  const { order, line } = await createTestSalesOrderWithLine({
    organizationId: tenant._id,
    userId,
    variantId: variant._id,
    quantity: 12
  });

  await confirmSalesOrder({
    organizationId: tenant._id,
    salesOrderRef: order.salesOrderId,
    userId
  });

  const reservation = await InventoryReservation.findOne({
    organizationId: tenant._id,
    salesOrderLineId: line.salesOrderLineId
  }).lean();
  assert.equal(Number(reservation.quantity), 5);

  const refreshedLine = await SalesOrderLine.findOne({ _id: line._id }).lean();
  assert.equal(Number(refreshedLine.quantityBackordered), 7);
});

test('SO cancel releases reservations', async () => {
  const { tenant, variant, userId } = await seedInventoryContext();
  const location = await ensureMainWarehouse(tenant._id);

  const opening = await createAdjustment({
    organizationId: tenant._id,
    userId,
    inventoryLocationId: location.inventoryLocationId,
    reasonCode: 'opening_balance',
    lines: [{ variantId: variant._id, quantityDelta: 10 }]
  });
  await postAdjustment({
    organizationId: tenant._id,
    inventoryAdjustmentId: opening.inventoryAdjustmentId,
    userId
  });

  const { order, line } = await createTestSalesOrderWithLine({
    organizationId: tenant._id,
    userId,
    variantId: variant._id,
    quantity: 4
  });

  await confirmSalesOrder({
    organizationId: tenant._id,
    salesOrderRef: order.salesOrderId,
    userId
  });

  await cancelSalesOrder({
    organizationId: tenant._id,
    salesOrderRef: order.salesOrderId,
    userId
  });

  const reservation = await InventoryReservation.findOne({
    organizationId: tenant._id,
    salesOrderLineId: line.salesOrderLineId
  }).lean();
  assert.equal(reservation.status, 'cancelled');

  const atp = await getAtpForVariant({
    organizationId: tenant._id,
    variantId: variant._id,
    inventoryLocationId: location.inventoryLocationId
  });
  assert.equal(atp.reserved, 0);
  assert.equal(atp.available, 10);
});

test('fulfillment deducts ledger, consumes reservation, idempotent on retry', async () => {
  const { tenant, variant, userId } = await seedInventoryContext();
  const location = await ensureMainWarehouse(tenant._id);

  const opening = await createAdjustment({
    organizationId: tenant._id,
    userId,
    inventoryLocationId: location.inventoryLocationId,
    reasonCode: 'opening_balance',
    lines: [{ variantId: variant._id, quantityDelta: 15 }]
  });
  await postAdjustment({
    organizationId: tenant._id,
    inventoryAdjustmentId: opening.inventoryAdjustmentId,
    userId
  });

  const { order, line } = await createTestSalesOrderWithLine({
    organizationId: tenant._id,
    userId,
    variantId: variant._id,
    quantity: 6
  });

  await confirmSalesOrder({
    organizationId: tenant._id,
    salesOrderRef: order.salesOrderId,
    userId
  });

  const first = await postSalesOrderFulfillment({
    organizationId: tenant._id,
    salesOrderRef: order.salesOrderId,
    userId,
    body: {
      fulfillmentType: 'ship',
      lines: [{ salesOrderLineId: line.salesOrderLineId, quantityDelta: 3 }]
    }
  });

  const ledgerCountAfterFirst = await InventoryLedgerEntry.countDocuments({
    organizationId: tenant._id,
    entryType: 'fulfillment_deduct',
    status: 'posted'
  });
  assert.equal(ledgerCountAfterFirst, 1);

  const balance = await ItemInventory.findOne({
    organizationId: tenant._id,
    variantId: variant._id,
    inventoryLocationId: location.inventoryLocationId
  }).lean();
  assert.equal(Number(balance.onHand), 12);
  assert.equal(Number(balance.reserved), 3);

  const reservation = await InventoryReservation.findOne({
    organizationId: tenant._id,
    salesOrderLineId: line.salesOrderLineId
  }).lean();
  assert.equal(reservation.status, 'partially_consumed');
  assert.equal(Number(reservation.quantityConsumed), 3);

  assert.ok(first.fulfillment?.salesOrderFulfillmentId);
});

test('fulfillment blocked when insufficient on-hand', async () => {
  const { tenant, variant, userId } = await seedInventoryContext();
  const location = await ensureMainWarehouse(tenant._id);

  const opening = await createAdjustment({
    organizationId: tenant._id,
    userId,
    inventoryLocationId: location.inventoryLocationId,
    reasonCode: 'opening_balance',
    lines: [{ variantId: variant._id, quantityDelta: 2 }]
  });
  await postAdjustment({
    organizationId: tenant._id,
    inventoryAdjustmentId: opening.inventoryAdjustmentId,
    userId
  });

  const { order, line } = await createTestSalesOrderWithLine({
    organizationId: tenant._id,
    userId,
    variantId: variant._id,
    quantity: 5
  });

  await confirmSalesOrder({
    organizationId: tenant._id,
    salesOrderRef: order.salesOrderId,
    userId
  });

  await assert.rejects(
    () =>
      postSalesOrderFulfillment({
        organizationId: tenant._id,
        salesOrderRef: order.salesOrderId,
        userId,
        body: {
          fulfillmentType: 'ship',
          lines: [{ salesOrderLineId: line.salesOrderLineId, quantityDelta: 5 }]
        }
      }),
    (err) => err.code === 'INSUFFICIENT_STOCK'
  );

  const refreshedLine = await SalesOrderLine.findOne({ _id: line._id }).lean();
  assert.equal(Number(refreshedLine.quantityFulfilled), 0);
});

test('transfer posts paired ledger legs across locations', async () => {
  const { tenant, variant, userId } = await seedInventoryContext();
  const main = await ensureMainWarehouse(tenant._id);
  const secondary = await createSecondaryLocation({ organizationId: tenant._id, userId });

  const opening = await createAdjustment({
    organizationId: tenant._id,
    userId,
    inventoryLocationId: main.inventoryLocationId,
    reasonCode: 'opening_balance',
    lines: [{ variantId: variant._id, quantityDelta: 30 }]
  });
  await postAdjustment({
    organizationId: tenant._id,
    inventoryAdjustmentId: opening.inventoryAdjustmentId,
    userId
  });

  const transfer = await createTransfer({
    organizationId: tenant._id,
    userId,
    fromLocationId: main.inventoryLocationId,
    toLocationId: secondary.inventoryLocationId,
    lines: [{ variantId: variant._id, quantity: 12 }]
  });

  await postTransfer({
    organizationId: tenant._id,
    inventoryTransferId: transfer.inventoryTransferId,
    userId
  });

  const mainBalance = await ItemInventory.findOne({
    organizationId: tenant._id,
    variantId: variant._id,
    inventoryLocationId: main.inventoryLocationId
  }).lean();
  const secBalance = await ItemInventory.findOne({
    organizationId: tenant._id,
    variantId: variant._id,
    inventoryLocationId: secondary.inventoryLocationId
  }).lean();

  assert.equal(Number(mainBalance.onHand), 18);
  assert.equal(Number(secBalance.onHand), 12);

  const transferLegs = await InventoryLedgerEntry.countDocuments({
    organizationId: tenant._id,
    entryType: { $in: ['transfer_out', 'transfer_in'] },
    status: 'posted'
  });
  assert.equal(transferLegs, 2);
});

test('count session posts variance only', async () => {
  const { tenant, variant, userId } = await seedInventoryContext();
  const location = await ensureMainWarehouse(tenant._id);

  const opening = await createAdjustment({
    organizationId: tenant._id,
    userId,
    inventoryLocationId: location.inventoryLocationId,
    reasonCode: 'opening_balance',
    lines: [{ variantId: variant._id, quantityDelta: 50 }]
  });
  await postAdjustment({
    organizationId: tenant._id,
    inventoryAdjustmentId: opening.inventoryAdjustmentId,
    userId
  });

  const count = await createCount({
    organizationId: tenant._id,
    userId,
    inventoryLocationId: location.inventoryLocationId,
    lines: [{ variantId: variant._id }]
  });

  const started = await startCountSession({
    organizationId: tenant._id,
    inventoryCountId: count.inventoryCountId,
    userId
  });
  assert.equal(started.status, 'counting');
  assert.equal(Number(started.lines[0].systemQty), 50);

  const lineId = started.lines[0].inventoryCountLineId;
  await updateCountLines({
    organizationId: tenant._id,
    inventoryCountId: count.inventoryCountId,
    lines: [{ inventoryCountLineId: lineId, countedQty: 47 }]
  });

  await postCount({
    organizationId: tenant._id,
    inventoryCountId: count.inventoryCountId,
    userId
  });

  const balance = await ItemInventory.findOne({
    organizationId: tenant._id,
    variantId: variant._id,
    inventoryLocationId: location.inventoryLocationId
  }).lean();
  assert.equal(Number(balance.onHand), 47);

  const varianceEntries = await InventoryLedgerEntry.countDocuments({
    organizationId: tenant._id,
    entryType: 'count_variance',
    status: 'posted'
  });
  assert.equal(varianceEntries, 1);
});

test('detectRollupDrift is read-only and rebuild clears drift', async () => {
  const { tenant, variant, userId } = await seedInventoryContext();
  const location = await ensureMainWarehouse(tenant._id);

  const opening = await createAdjustment({
    organizationId: tenant._id,
    userId,
    inventoryLocationId: location.inventoryLocationId,
    reasonCode: 'opening_balance',
    lines: [{ variantId: variant._id, quantityDelta: 11 }]
  });
  await postAdjustment({
    organizationId: tenant._id,
    inventoryAdjustmentId: opening.inventoryAdjustmentId,
    userId
  });

  await ItemInventory.updateOne(
    {
      organizationId: tenant._id,
      variantId: variant._id,
      inventoryLocationId: location.inventoryLocationId
    },
    { $set: { onHand: 999, available: 999 } }
  );

  const ledgerBefore = await InventoryLedgerEntry.countDocuments({ organizationId: tenant._id });
  const driftBefore = await detectRollupDrift({ organizationId: tenant._id });
  assert.ok(driftBefore.length >= 1);

  const rebuild = await rebuildAllBalances({ organizationId: tenant._id, userId });
  assert.equal(rebuild.ledgerUntouched, true);
  assert.ok(rebuild.driftAfter.length === 0);

  const ledgerAfter = await InventoryLedgerEntry.countDocuments({ organizationId: tenant._id });
  assert.equal(ledgerBefore, ledgerAfter);
});

test('ATP guard off policy allows insufficient line add check', async () => {
  const { tenant, variant, userId } = await seedInventoryContext();
  const location = await ensureMainWarehouse(tenant._id);

  await OrganizationInventorySettings.updateOne(
    { organizationId: tenant._id },
    { $set: { atpLineAddPolicy: 'off' } },
    { upsert: true }
  );

  const { guardQuoteLineQuantity } = require('../../services/inventoryAtpGuardService');
  const Quote = require('../../models/Quote');

  const quote = await Quote.create({
    organizationId: tenant._id,
    quoteTitle: 'ATP Guard Test',
    status: 'Draft',
    currency: 'USD',
    assignedTo: userId,
    createdBy: userId
  });

  const result = await guardQuoteLineQuantity({
    organizationId: tenant._id,
    quoteId: quote._id,
    variantId: variant._id,
    quantity: 999,
    userId
  });
  assert.equal(result.policy, 'off');
  assert.equal(result.sufficient, true);
});

test('ATP guard block policy rejects insufficient quantity', async () => {
  const { tenant, variant, userId } = await seedInventoryContext();
  const location = await ensureMainWarehouse(tenant._id);

  const opening = await createAdjustment({
    organizationId: tenant._id,
    userId,
    inventoryLocationId: location.inventoryLocationId,
    reasonCode: 'opening_balance',
    lines: [{ variantId: variant._id, quantityDelta: 5 }]
  });
  await postAdjustment({
    organizationId: tenant._id,
    inventoryAdjustmentId: opening.inventoryAdjustmentId,
    userId
  });

  await OrganizationInventorySettings.updateOne(
    { organizationId: tenant._id },
    { $set: { atpLineAddPolicy: 'block' } },
    { upsert: true }
  );

  const { guardQuoteLineQuantity } = require('../../services/inventoryAtpGuardService');
  const Quote = require('../../models/Quote');
  const quote = await Quote.create({
    organizationId: tenant._id,
    quoteTitle: 'Block Test',
    status: 'Draft',
    currency: 'USD',
    assignedTo: userId,
    createdBy: userId
  });

  await assert.rejects(
    () =>
      guardQuoteLineQuantity({
        organizationId: tenant._id,
        quoteId: quote._id,
        variantId: variant._id,
        quantity: 10,
        userId
      }),
    (err) => err.code === 'INSUFFICIENT_ATP' && err.canProceed === false
  );
});

test('ATP guard warn policy allows forceProceed', async () => {
  const { tenant, variant, userId } = await seedInventoryContext();
  const location = await ensureMainWarehouse(tenant._id);

  await OrganizationInventorySettings.updateOne(
    { organizationId: tenant._id },
    { $set: { atpLineAddPolicy: 'warn' } },
    { upsert: true }
  );

  const { guardQuoteLineQuantity } = require('../../services/inventoryAtpGuardService');
  const Quote = require('../../models/Quote');
  const quote = await Quote.create({
    organizationId: tenant._id,
    quoteTitle: 'Warn Test',
    status: 'Draft',
    currency: 'USD',
    assignedTo: userId,
    createdBy: userId
  });

  await assert.rejects(
    () =>
      guardQuoteLineQuantity({
        organizationId: tenant._id,
        quoteId: quote._id,
        variantId: variant._id,
        quantity: 50,
        userId
      }),
    (err) => err.code === 'INSUFFICIENT_ATP' && err.canProceed === true
  );

  const forced = await guardQuoteLineQuantity({
    organizationId: tenant._id,
    quoteId: quote._id,
    variantId: variant._id,
    quantity: 50,
    userId,
    forceProceed: true
  });
  assert.equal(forced.proceededDespiteWarning, true);
});

test('quote accept guard blocks when policy is block', async () => {
  const { tenant, variant, userId } = await seedInventoryContext();
  const location = await ensureMainWarehouse(tenant._id);

  await OrganizationInventorySettings.updateOne(
    { organizationId: tenant._id },
    { $set: { atpQuoteAcceptPolicy: 'block' } },
    { upsert: true }
  );

  const { guardQuoteAcceptance } = require('../../services/inventoryAtpGuardService');
  const acceptedLines = [
    { variantId: variant._id, quantity: 100, lineType: 'standard', hiddenLine: false }
  ];

  await assert.rejects(
    () =>
      guardQuoteAcceptance({
        organizationId: tenant._id,
        acceptedLines
      }),
    (err) => err.code === 'INSUFFICIENT_ATP'
  );
});

test('resolveTrackingMode uses variant override over org default', async () => {
  const { tenant, variant } = await seedInventoryContext();
  const { resolveTrackingMode } = require('../../services/inventoryTrackingService');

  await OrganizationInventorySettings.updateOne(
    { organizationId: tenant._id },
    { $set: { defaultTrackingMode: 'none' } },
    { upsert: true }
  );

  await ItemVariant.updateOne(
    { _id: variant._id },
    { $set: { inventoryTrackingMode: 'serial' } }
  );

  const mode = await resolveTrackingMode({
    organizationId: tenant._id,
    variantId: variant._id
  });
  assert.equal(mode, 'serial');
});

test('serial mode blocks fulfillment without serialNumbers', async () => {
  const { tenant, variant, userId } = await seedInventoryContext();
  const location = await ensureMainWarehouse(tenant._id);

  await ItemVariant.updateOne({ _id: variant._id }, { $set: { inventoryTrackingMode: 'serial' } });

  const { postInventoryTransaction } = require('../../services/inventoryTransactionService');
  await postInventoryTransaction({
    organizationId: tenant._id,
    userId,
    transactionType: 'opening_balance',
    inventoryLocationId: location.inventoryLocationId,
    sourceContext: 'opening_balance',
    sourceRef: { moduleKey: 'test', recordId: 'serial-seed-1' },
    lines: [
      {
        variantId: variant._id,
        quantityDelta: 2,
        entryType: 'opening_balance',
        serialNumbers: ['SN-001', 'SN-002']
      }
    ]
  });

  const { order, line } = await createTestSalesOrderWithLine({
    organizationId: tenant._id,
    userId,
    variantId: variant._id,
    quantity: 2,
    status: 'Confirmed'
  });

  await assert.rejects(
    () =>
      postSalesOrderFulfillment({
        organizationId: tenant._id,
        salesOrderRef: order.salesOrderId,
        userId,
        body: {
          fulfillmentType: 'ship',
          lines: [{ salesOrderLineId: line.salesOrderLineId, quantityDelta: 1 }]
        }
      }),
    (err) => err.code === 'SERIAL_COUNT_MISMATCH'
  );
});

test('serial mode fulfillment consumes serial registry', async () => {
  const { tenant, variant, userId } = await seedInventoryContext();
  const location = await ensureMainWarehouse(tenant._id);

  await ItemVariant.updateOne({ _id: variant._id }, { $set: { inventoryTrackingMode: 'serial' } });

  const { postInventoryTransaction } = require('../../services/inventoryTransactionService');
  await postInventoryTransaction({
    organizationId: tenant._id,
    userId,
    transactionType: 'opening_balance',
    inventoryLocationId: location.inventoryLocationId,
    sourceContext: 'opening_balance',
    sourceRef: { moduleKey: 'test', recordId: 'serial-seed-2' },
    lines: [
      {
        variantId: variant._id,
        quantityDelta: 2,
        entryType: 'opening_balance',
        serialNumbers: ['SN-A', 'SN-B']
      }
    ]
  });

  const InventorySerial = require('../../models/InventorySerial');
  assert.equal(
    await InventorySerial.countDocuments({
      organizationId: tenant._id,
      status: 'available'
    }),
    2
  );

  const { order, line } = await createTestSalesOrderWithLine({
    organizationId: tenant._id,
    userId,
    variantId: variant._id,
    quantity: 2,
    status: 'Confirmed'
  });

  await postSalesOrderFulfillment({
    organizationId: tenant._id,
    salesOrderRef: order.salesOrderId,
    userId,
    body: {
      fulfillmentType: 'ship',
      lines: [
        {
          salesOrderLineId: line.salesOrderLineId,
          quantityDelta: 1,
          serialNumbers: ['SN-A']
        }
      ]
    }
  });

  const consumed = await InventorySerial.findOne({
    organizationId: tenant._id,
    serialNumber: 'SN-A'
  }).lean();
  assert.equal(consumed.status, 'consumed');
});

test('lot mode requires lotId on deduct', async () => {
  const { tenant, variant, userId } = await seedInventoryContext();
  const location = await ensureMainWarehouse(tenant._id);

  await ItemVariant.updateOne({ _id: variant._id }, { $set: { inventoryTrackingMode: 'lot' } });

  const opening = await createAdjustment({
    organizationId: tenant._id,
    userId,
    inventoryLocationId: location.inventoryLocationId,
    reasonCode: 'opening_balance',
    lines: [{ variantId: variant._id, quantityDelta: 5 }]
  });
  await postAdjustment({
    organizationId: tenant._id,
    inventoryAdjustmentId: opening.inventoryAdjustmentId,
    userId
  });

  const { postInventoryTransaction } = require('../../services/inventoryTransactionService');
  const { createLot } = require('../../services/inventoryTrackingService');
  const lot = await createLot({
    organizationId: tenant._id,
    variantId: variant._id,
    inventoryLocationId: location.inventoryLocationId,
    lotNumber: 'LOT-1',
    userId
  });

  await assert.rejects(
    () =>
      postInventoryTransaction({
        organizationId: tenant._id,
        userId,
        transactionType: 'adjustment',
        inventoryLocationId: location.inventoryLocationId,
        sourceContext: 'manual',
        sourceRef: { moduleKey: 'test', recordId: 'lot-deduct-missing' },
        lines: [{ variantId: variant._id, quantityDelta: -1, entryType: 'adjustment_out' }]
      }),
    (err) => err.code === 'LOT_REQUIRED'
  );

  const ok = await postInventoryTransaction({
    organizationId: tenant._id,
    userId,
    transactionType: 'adjustment',
    inventoryLocationId: location.inventoryLocationId,
    sourceContext: 'manual',
    sourceRef: { moduleKey: 'test', recordId: 'lot-deduct-ok' },
    lines: [
      {
        variantId: variant._id,
        quantityDelta: -1,
        entryType: 'adjustment_out',
        lotId: lot.inventoryLotId
      }
    ]
  });
  assert.equal(ok.duplicate, false);
});

test('shipment deduct emits inventory.cost_of_goods_calculated activity', async () => {
  const { tenant, variant, userId } = await seedInventoryContext();
  const location = await ensureMainWarehouse(tenant._id);
  const RecordActivity = require('../../models/RecordActivity');

  const opening = await createAdjustment({
    organizationId: tenant._id,
    userId,
    inventoryLocationId: location.inventoryLocationId,
    reasonCode: 'opening_balance',
    lines: [{ variantId: variant._id, quantityDelta: 10, unitCostSnapshot: 7 }]
  });
  await postAdjustment({
    organizationId: tenant._id,
    inventoryAdjustmentId: opening.inventoryAdjustmentId,
    userId
  });

  const { order, line } = await createTestSalesOrderWithLine({
    organizationId: tenant._id,
    userId,
    variantId: variant._id,
    quantity: 3,
    status: 'Confirmed'
  });

  await postSalesOrderFulfillment({
    organizationId: tenant._id,
    salesOrderRef: order.salesOrderId,
    userId,
    body: {
      fulfillmentType: 'ship',
      lines: [{ salesOrderLineId: line.salesOrderLineId, quantityDelta: 2 }]
    }
  });

  const activity = await RecordActivity.findOne({
    organizationId: tenant._id,
    moduleKey: 'inventory',
    action: 'inventory.cost_of_goods_calculated'
  }).lean();
  assert.ok(activity);
  assert.equal(activity.details.quantityDelta, -2);
});

test('incoming stub updates ItemInventory.incoming rollup', async () => {
  const { tenant, variant, userId } = await seedInventoryContext();
  const location = await ensureMainWarehouse(tenant._id);
  const { createIncomingStub } = require('../../services/inventoryIncomingService');

  await createIncomingStub({
    organizationId: tenant._id,
    variantId: variant._id,
    inventoryLocationId: location.inventoryLocationId,
    quantity: 12,
    userId
  });

  const balance = await ItemInventory.findOne({
    organizationId: tenant._id,
    variantId: variant._id,
    inventoryLocationId: location.inventoryLocationId
  }).lean();
  assert.equal(Number(balance.incoming), 12);
});

test('ATP includes incoming when org includeIncomingInAtp is true', async () => {
  const { tenant, variant, userId } = await seedInventoryContext();
  const location = await ensureMainWarehouse(tenant._id);
  const { createIncomingStub } = require('../../services/inventoryIncomingService');

  await OrganizationInventorySettings.updateOne(
    { organizationId: tenant._id },
    { $set: { includeIncomingInAtp: true } },
    { upsert: true }
  );

  await createIncomingStub({
    organizationId: tenant._id,
    variantId: variant._id,
    inventoryLocationId: location.inventoryLocationId,
    quantity: 8,
    userId
  });

  const atp = await getAtpForVariant({
    organizationId: tenant._id,
    variantId: variant._id,
    inventoryLocationId: location.inventoryLocationId
  });
  assert.equal(atp.atpIncludesIncoming, true);
  assert.equal(atp.incoming, 8);
  assert.equal(atp.available, 8);
});

test('receive incoming stub posts receipt and clears incoming rollup', async () => {
  const { tenant, variant, userId } = await seedInventoryContext();
  const location = await ensureMainWarehouse(tenant._id);
  const { createIncomingStub, receiveIncomingStub } = require('../../services/inventoryIncomingService');

  const stub = await createIncomingStub({
    organizationId: tenant._id,
    variantId: variant._id,
    inventoryLocationId: location.inventoryLocationId,
    quantity: 5,
    userId
  });

  const result = await receiveIncomingStub({
    organizationId: tenant._id,
    inventoryIncomingStubId: stub.inventoryIncomingStubId,
    userId
  });
  assert.equal(result.stub.status, 'received');
  assert.equal(result.receipt.duplicate, false);

  const balance = await ItemInventory.findOne({
    organizationId: tenant._id,
    variantId: variant._id,
    inventoryLocationId: location.inventoryLocationId
  }).lean();
  assert.equal(Number(balance.incoming), 0);
  assert.equal(Number(balance.onHand), 5);
});

test('sales-only tenant skips SO confirm reservation and ATP guard no-ops', async () => {
  const { tenant, variant, userId } = await seedSalesOnlyContext();
  const { order, line } = await createTestSalesOrderWithLine({
    organizationId: tenant._id,
    userId,
    variantId: variant._id,
    quantity: 6
  });

  await confirmSalesOrder({
    organizationId: tenant._id,
    salesOrderRef: order.salesOrderId,
    userId
  });

  const reservationCount = await InventoryReservation.countDocuments({
    organizationId: tenant._id,
    salesOrderLineId: line.salesOrderLineId
  });
  assert.equal(reservationCount, 0);

  const { guardQuoteLineQuantity } = require('../../services/inventoryAtpGuardService');
  const Quote = require('../../models/Quote');
  const quote = await Quote.create({
    organizationId: tenant._id,
    quoteTitle: 'Sales-only ATP',
    status: 'Draft',
    currency: 'USD',
    assignedTo: userId,
    createdBy: userId
  });

  const atpResult = await guardQuoteLineQuantity({
    organizationId: tenant._id,
    quoteId: quote._id,
    variantId: variant._id,
    quantity: 9999,
    userId
  });
  assert.equal(atpResult.sufficient, true);
  assert.equal(atpResult.inventoryDisabled, true);
});
