/**
 * INV0 — Post inventory transactions + ledger entries (stock authority writer).
 */

const InventoryTransaction = require('../models/InventoryTransaction');
const InventoryLedgerEntry = require('../models/InventoryLedgerEntry');
const ItemVariant = require('../models/ItemVariant');
const { roundQty } = require('../constants/inventoryLifecycle');
const { assertActiveLocation } = require('./inventoryLocationService');
const { isNegativeInventoryAllowed, getOrCreateSettings } = require('./inventorySettingsService');
const { recomputeItemInventory, getBalance } = require('./inventoryRollupService');
const { writeInventoryActivity } = require('./inventoryActivityService');
const {
  resolveTrackingMode,
  validateTrackingLine,
  registerSerialsOnReceipt,
  consumeSerialsOnDeduct
} = require('./inventoryTrackingService');
const {
  resolveValuationContext,
  emitCostOfGoodsCalculated
} = require('./inventoryValuationService');

function resolveEntryType(quantityDelta, fallbackType) {
  if (fallbackType) return fallbackType;
  return quantityDelta >= 0 ? 'adjustment_in' : 'adjustment_out';
}

async function assertVariantExists(organizationId, variantId) {
  const variant = await ItemVariant.findOne({ _id: variantId, organizationId }).lean();
  if (!variant) {
    const err = new Error('Item variant not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  return variant;
}

async function assertSufficientStock({
  organizationId,
  variantId,
  inventoryLocationId,
  quantityDelta,
  location,
  settings
}) {
  if (quantityDelta >= 0) return;

  const allowed = await isNegativeInventoryAllowed({ organizationId, location, settings });
  if (allowed) return;

  const balance = await getBalance({ organizationId, variantId, inventoryLocationId });
  const onHand = roundQty(balance?.onHand || 0);
  const next = roundQty(onHand + quantityDelta);

  if (next < 0) {
    const err = new Error('Insufficient stock for inventory transaction');
    err.code = 'INSUFFICIENT_STOCK';
    err.details = { onHand, quantityDelta, next };
    throw err;
  }
}

async function findExistingLedgerBySource({
  organizationId,
  sourceRef,
  entryType,
  variantId,
  inventoryLocationId
}) {
  if (!sourceRef?.recordId) return null;
  const query = {
    organizationId,
    'sourceRef.moduleKey': sourceRef.moduleKey,
    'sourceRef.recordId': sourceRef.recordId,
    entryType,
    variantId,
    inventoryLocationId,
    status: 'posted'
  };
  if (sourceRef.lineId) {
    query['sourceRef.lineId'] = sourceRef.lineId;
  }
  return InventoryLedgerEntry.findOne(query).lean();
}

async function postInventoryTransaction({
  organizationId,
  userId = null,
  transactionType,
  inventoryLocationId,
  lines = [],
  sourceContext = 'manual',
  sourceRef = null,
  notes = null,
  idempotent = true
}) {
  if (!organizationId || !inventoryLocationId || !lines.length) {
    const err = new Error('organizationId, inventoryLocationId, and lines are required');
    err.code = 'VALIDATION';
    throw err;
  }

  const location = await assertActiveLocation({ organizationId, inventoryLocationId });
  const settings = await getOrCreateSettings(organizationId);

  const normalizedLines = [];
  for (const line of lines) {
    const variant = await assertVariantExists(organizationId, line.variantId);
    const quantityDelta = roundQty(line.quantityDelta != null ? line.quantityDelta : line.quantity);
    if (quantityDelta === 0) continue;

    const entryType = resolveEntryType(quantityDelta, line.entryType);

    const lineSourceRef = {
      moduleKey: line.sourceRef?.moduleKey || sourceRef?.moduleKey || null,
      recordId: line.sourceRef?.recordId || sourceRef?.recordId || null,
      lineId:
        line.sourceRef?.lineId ||
        line.lineId ||
        sourceRef?.lineId ||
        String(line.variantId)
    };

    if (idempotent && lineSourceRef?.recordId) {
      const existing = await findExistingLedgerBySource({
        organizationId,
        sourceRef: lineSourceRef,
        entryType,
        variantId: variant._id,
        inventoryLocationId
      });
      if (existing) {
        return {
          duplicate: true,
          transaction: await InventoryTransaction.findOne({
            inventoryTransactionId: existing.inventoryTransactionId
          }).lean(),
          ledgerEntries: [existing]
        };
      }
    }

    await assertSufficientStock({
      organizationId,
      variantId: variant._id,
      inventoryLocationId,
      quantityDelta,
      location,
      settings
    });

    const trackingMode = await resolveTrackingMode({
      organizationId,
      variantId: variant._id,
      variant,
      settings
    });
    const tracking = validateTrackingLine({
      trackingMode,
      quantityDelta,
      lotId: line.lotId || line.inventoryLotId || null,
      serialNumbers: line.serialNumbers || []
    });

    const valuation = await resolveValuationContext({
      organizationId,
      variant,
      line,
      settings
    });

    normalizedLines.push({
      variantId: variant._id,
      itemId: variant.itemId,
      quantityDelta,
      entryType,
      unitCostSnapshot: valuation.unitCostSnapshot,
      valuationMethod: valuation.valuationMethod,
      costSource: valuation.costSource,
      lotId: tracking.lotId,
      serialNumbers: tracking.serialNumbers,
      unitOfMeasure: variant.unit_of_measure || null,
      notes: line.notes || null,
      sourceRef: lineSourceRef
    });
  }

  if (!normalizedLines.length) {
    const err = new Error('No non-zero inventory lines to post');
    err.code = 'VALIDATION';
    throw err;
  }

  const transaction = await InventoryTransaction.create({
    organizationId,
    transactionType,
    status: 'posted',
    inventoryLocationId,
    lines: normalizedLines.map((line) => ({
      variantId: line.variantId,
      quantity: Math.abs(line.quantityDelta),
      unitCostSnapshot: line.unitCostSnapshot
    })),
    sourceContext,
    sourceRef,
    notes,
    postedAt: new Date(),
    postedBy: userId || null
  });

  const ledgerEntries = [];

  for (const line of normalizedLines) {
    const extendedCost = roundQty(line.quantityDelta * line.unitCostSnapshot);
    const entry = await InventoryLedgerEntry.create({
      organizationId,
      variantId: line.variantId,
      itemId: line.itemId,
      inventoryLocationId,
      quantityDelta: line.quantityDelta,
      unitOfMeasure: line.unitOfMeasure,
      inventoryTransactionId: transaction.inventoryTransactionId,
      entryType: line.entryType,
      unitCostSnapshot: line.unitCostSnapshot,
      extendedCost,
      valuationMethod: line.valuationMethod,
      costSource: line.costSource,
      lotId: line.lotId,
      serialNumbers: line.serialNumbers,
      sourceContext,
      sourceRef: line.sourceRef,
      postedAt: new Date(),
      postedBy: userId || null,
      notes: line.notes || notes || null,
      status: 'posted'
    });
    ledgerEntries.push(entry);

    if (line.serialNumbers?.length && line.quantityDelta > 0) {
      await registerSerialsOnReceipt({
        organizationId,
        variantId: line.variantId,
        inventoryLocationId,
        serialNumbers: line.serialNumbers,
        inventoryLotId: line.lotId,
        ledgerEntryId: entry.inventoryLedgerEntryId,
        sourceRef: line.sourceRef
      });
    }

    if (line.serialNumbers?.length && line.quantityDelta < 0) {
      await consumeSerialsOnDeduct({
        organizationId,
        variantId: line.variantId,
        inventoryLocationId,
        serialNumbers: line.serialNumbers,
        ledgerEntryId: entry.inventoryLedgerEntryId
      });
    }

    await emitCostOfGoodsCalculated({
      organizationId,
      ledgerEntry: entry.toObject(),
      transaction: transaction.toObject(),
      userId
    });
  }

  transaction.lines = ledgerEntries.map((entry) => ({
    variantId: entry.variantId,
    quantity: Math.abs(entry.quantityDelta),
    inventoryLedgerEntryId: entry.inventoryLedgerEntryId,
    unitCostSnapshot: entry.unitCostSnapshot
  }));
  await transaction.save();

  const balances = [];
  for (const entry of ledgerEntries) {
    balances.push(
      await recomputeItemInventory({
        organizationId,
        variantId: entry.variantId,
        inventoryLocationId: entry.inventoryLocationId
      })
    );
  }

  await writeInventoryActivity({
    organizationId,
    recordId: transaction.inventoryTransactionId,
    userId,
    action: 'inventory_transaction_posted',
    message: `Inventory transaction ${transaction.transactionType} posted`,
    details: {
      inventoryTransactionId: transaction.inventoryTransactionId,
      transactionType: transaction.transactionType,
      lineCount: ledgerEntries.length
    }
  });

  return {
    duplicate: false,
    transaction: transaction.toObject(),
    ledgerEntries: ledgerEntries.map((e) => e.toObject()),
    balances
  };
}

async function listLedgerEntries({ organizationId, variantId = null, inventoryLocationId = null, limit = 100 }) {
  const query = { organizationId, status: 'posted' };
  if (variantId) query.variantId = variantId;
  if (inventoryLocationId) query.inventoryLocationId = inventoryLocationId;
  return InventoryLedgerEntry.find(query).sort({ postedAt: -1 }).limit(limit).lean();
}

/**
 * INV2 — Inter-location transfer: paired transfer_out / transfer_in ledger legs.
 * Ledger is append-only; one InventoryTransaction (type transfer) spans both locations.
 */
async function postInventoryTransferTransaction({
  organizationId,
  userId = null,
  fromLocationId,
  toLocationId,
  lines = [],
  sourceRef = null,
  notes = null,
  idempotent = true
}) {
  if (!organizationId || !fromLocationId || !toLocationId || !lines.length) {
    const err = new Error('organizationId, fromLocationId, toLocationId, and lines are required');
    err.code = 'VALIDATION';
    throw err;
  }

  if (String(fromLocationId) === String(toLocationId)) {
    const err = new Error('Transfer source and destination must differ');
    err.code = 'VALIDATION';
    throw err;
  }

  const fromLocation = await assertActiveLocation({ organizationId, inventoryLocationId: fromLocationId });
  const toLocation = await assertActiveLocation({ organizationId, inventoryLocationId: toLocationId });
  const settings = await getOrCreateSettings(organizationId);

  const normalizedLines = [];
  for (const line of lines) {
    const variant = await assertVariantExists(organizationId, line.variantId);
    const qty = roundQty(line.quantity);
    if (qty <= 0) continue;

    const lineSourceRef = {
      moduleKey: sourceRef?.moduleKey || 'inventory_transfers',
      recordId: sourceRef?.recordId || null,
      lineId: line.lineId || sourceRef?.lineId || String(variant._id)
    };

    if (idempotent && lineSourceRef.recordId) {
      const existingOut = await findExistingLedgerBySource({
        organizationId,
        sourceRef: lineSourceRef,
        entryType: 'transfer_out',
        variantId: variant._id,
        inventoryLocationId: fromLocationId
      });
      if (existingOut) {
        return {
          duplicate: true,
          transaction: await InventoryTransaction.findOne({
            inventoryTransactionId: existingOut.inventoryTransactionId
          }).lean(),
          ledgerEntries: await InventoryLedgerEntry.find({
            organizationId,
            inventoryTransactionId: existingOut.inventoryTransactionId,
            status: 'posted'
          }).lean()
        };
      }
    }

    await assertSufficientStock({
      organizationId,
      variantId: variant._id,
      inventoryLocationId: fromLocationId,
      quantityDelta: -qty,
      location: fromLocation,
      settings
    });

    normalizedLines.push({
      variantId: variant._id,
      itemId: variant.itemId,
      quantity: qty,
      unitCostSnapshot: roundQty(line.unitCostSnapshot != null ? line.unitCostSnapshot : variant.cost_price || 0),
      unitOfMeasure: variant.unit_of_measure || null,
      sourceRef: lineSourceRef,
      notes: line.notes || null
    });
  }

  if (!normalizedLines.length) {
    const err = new Error('No non-zero transfer lines to post');
    err.code = 'VALIDATION';
    throw err;
  }

  const transaction = await InventoryTransaction.create({
    organizationId,
    transactionType: 'transfer',
    status: 'posted',
    inventoryLocationId: fromLocationId,
    inventoryLocationIdTo: toLocationId,
    lines: normalizedLines.map((line) => ({
      variantId: line.variantId,
      quantity: line.quantity,
      unitCostSnapshot: line.unitCostSnapshot
    })),
    sourceContext: 'transfer',
    sourceRef,
    notes,
    postedAt: new Date(),
    postedBy: userId || null
  });

  const ledgerEntries = [];

  for (const line of normalizedLines) {
    const extendedCost = roundQty(-line.quantity * line.unitCostSnapshot);
    const outEntry = await InventoryLedgerEntry.create({
      organizationId,
      variantId: line.variantId,
      itemId: line.itemId,
      inventoryLocationId: fromLocationId,
      quantityDelta: -line.quantity,
      unitOfMeasure: line.unitOfMeasure,
      inventoryTransactionId: transaction.inventoryTransactionId,
      entryType: 'transfer_out',
      unitCostSnapshot: line.unitCostSnapshot,
      extendedCost,
      sourceContext: 'transfer',
      sourceRef: line.sourceRef,
      postedAt: new Date(),
      postedBy: userId || null,
      notes: line.notes || notes || null,
      status: 'posted'
    });
    ledgerEntries.push(outEntry);

    const inExtendedCost = roundQty(line.quantity * line.unitCostSnapshot);
    const inEntry = await InventoryLedgerEntry.create({
      organizationId,
      variantId: line.variantId,
      itemId: line.itemId,
      inventoryLocationId: toLocationId,
      quantityDelta: line.quantity,
      unitOfMeasure: line.unitOfMeasure,
      inventoryTransactionId: transaction.inventoryTransactionId,
      entryType: 'transfer_in',
      unitCostSnapshot: line.unitCostSnapshot,
      extendedCost: inExtendedCost,
      sourceContext: 'transfer',
      sourceRef: line.sourceRef,
      postedAt: new Date(),
      postedBy: userId || null,
      notes: line.notes || notes || null,
      status: 'posted'
    });
    ledgerEntries.push(inEntry);
  }

  transaction.lines = normalizedLines.map((line, index) => ({
    variantId: line.variantId,
    quantity: line.quantity,
    inventoryLedgerEntryId: ledgerEntries[index * 2]?.inventoryLedgerEntryId || null,
    unitCostSnapshot: line.unitCostSnapshot
  }));
  await transaction.save();

  const balances = [];
  for (const entry of ledgerEntries) {
    balances.push(
      await recomputeItemInventory({
        organizationId,
        variantId: entry.variantId,
        inventoryLocationId: entry.inventoryLocationId
      })
    );
  }

  await writeInventoryActivity({
    organizationId,
    recordId: transaction.inventoryTransactionId,
    userId,
    action: 'inventory_transfer_posted',
    message: 'Inventory transfer posted',
    details: {
      inventoryTransactionId: transaction.inventoryTransactionId,
      fromLocationId,
      toLocationId,
      lineCount: normalizedLines.length
    }
  });

  return {
    duplicate: false,
    transaction: transaction.toObject(),
    ledgerEntries: ledgerEntries.map((e) => e.toObject()),
    balances
  };
}

module.exports = {
  postInventoryTransaction,
  postInventoryTransferTransaction,
  listLedgerEntries,
  findExistingLedgerBySource
};
