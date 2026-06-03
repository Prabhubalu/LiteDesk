/**
 * INV4 — Lot/serial tracking mode resolution and enforcement.
 */

const ItemVariant = require('../models/ItemVariant');
const InventoryLot = require('../models/InventoryLot');
const InventorySerial = require('../models/InventorySerial');
const {
  roundQty,
  INVENTORY_TRACKING_MODE_DEFAULT
} = require('../constants/inventoryLifecycle');
const { getOrCreateSettings } = require('./inventorySettingsService');

async function resolveTrackingMode({ organizationId, variantId, variant = null, settings = null }) {
  const resolvedVariant =
    variant ||
    (await ItemVariant.findOne({ _id: variantId, organizationId })
      .select('inventoryTrackingMode')
      .lean());
  if (resolvedVariant?.inventoryTrackingMode) {
    return resolvedVariant.inventoryTrackingMode;
  }
  const resolvedSettings = settings || (await getOrCreateSettings(organizationId));
  return resolvedSettings.defaultTrackingMode || INVENTORY_TRACKING_MODE_DEFAULT;
}

function validateTrackingLine({ trackingMode, quantityDelta, lotId = null, serialNumbers = [] }) {
  const qty = roundQty(quantityDelta);
  if (qty === 0 || trackingMode === 'none') {
    return { lotId: lotId || null, serialNumbers: serialNumbers || [] };
  }

  const serials = (serialNumbers || []).map((s) => String(s).trim()).filter(Boolean);

  if (trackingMode === 'lot' && qty < 0 && !lotId) {
    const err = new Error('lotId is required for lot-tracked inventory deductions');
    err.code = 'LOT_REQUIRED';
    throw err;
  }

  if (trackingMode === 'serial') {
    const absQty = roundQty(Math.abs(qty));
    if (serials.length !== absQty) {
      const err = new Error('serialNumbers length must equal absolute quantity for serial-tracked lines');
      err.code = 'SERIAL_COUNT_MISMATCH';
      err.details = { expected: absQty, received: serials.length };
      throw err;
    }
  }

  return { lotId: lotId || null, serialNumbers: serials };
}

async function createLot({
  organizationId,
  variantId,
  inventoryLocationId,
  lotNumber,
  manufacturedAt = null,
  expiresAt = null,
  notes = null,
  userId = null
}) {
  const normalizedLotNumber = String(lotNumber || '').trim();
  if (!normalizedLotNumber) {
    const err = new Error('lotNumber is required');
    err.code = 'VALIDATION';
    throw err;
  }

  const existing = await InventoryLot.findOne({
    organizationId,
    variantId,
    lotNumber: normalizedLotNumber
  }).lean();
  if (existing) return existing;

  const lot = await InventoryLot.create({
    organizationId,
    variantId,
    inventoryLocationId,
    lotNumber: normalizedLotNumber,
    manufacturedAt,
    expiresAt,
    notes,
    createdBy: userId || null
  });
  return lot.toObject();
}

async function listLots({ organizationId, variantId = null, inventoryLocationId = null, limit = 100 }) {
  const query = { organizationId, status: 'active' };
  if (variantId) query.variantId = variantId;
  if (inventoryLocationId) query.inventoryLocationId = inventoryLocationId;
  return InventoryLot.find(query).sort({ createdAt: -1 }).limit(limit).lean();
}

async function registerSerialsOnReceipt({
  organizationId,
  variantId,
  inventoryLocationId,
  serialNumbers = [],
  inventoryLotId = null,
  ledgerEntryId = null,
  sourceRef = null
}) {
  const created = [];
  for (const serialNumber of serialNumbers) {
    const row = await InventorySerial.create({
      organizationId,
      serialNumber,
      variantId,
      inventoryLocationId,
      inventoryLotId,
      status: 'available',
      receivedLedgerEntryId: ledgerEntryId,
      sourceRef: sourceRef || {}
    });
    created.push(row.toObject());
  }
  return created;
}

async function consumeSerialsOnDeduct({
  organizationId,
  variantId,
  inventoryLocationId,
  serialNumbers = [],
  ledgerEntryId = null
}) {
  const consumed = [];
  for (const serialNumber of serialNumbers) {
    const serial = await InventorySerial.findOne({
      organizationId,
      variantId,
      serialNumber,
      inventoryLocationId,
      status: 'available'
    });
    if (!serial) {
      const err = new Error(`Serial ${serialNumber} is not available for consumption`);
      err.code = 'SERIAL_NOT_AVAILABLE';
      err.details = { serialNumber };
      throw err;
    }
    serial.status = 'consumed';
    serial.consumedLedgerEntryId = ledgerEntryId;
    await serial.save();
    consumed.push(serial.toObject());
  }
  return consumed;
}

async function listSerials({
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
  return InventorySerial.find(query).sort({ createdAt: -1 }).limit(limit).lean();
}

module.exports = {
  resolveTrackingMode,
  validateTrackingLine,
  createLot,
  listLots,
  registerSerialsOnReceipt,
  consumeSerialsOnDeduct,
  listSerials
};
