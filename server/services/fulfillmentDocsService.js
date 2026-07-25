/**
 * Sales fulfillment commercial docs — Delivery Note / Delivery Return / Sales Return.
 */

const ModuleSequence = require('../models/ModuleSequence');
const mongoose = require('mongoose');
const { Schema } = mongoose;
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const SalesOrder = require('../models/SalesOrder');
const SalesOrderLine = require('../models/SalesOrderLine');
const Invoice = require('../models/Invoice');
const InvoiceLine = require('../models/InvoiceLine');
const { postInventoryTransaction } = require('./inventoryTransactionService');
const { resolveInventoryLocationUuid } = require('./inventoryLocationService');
const { consumeReservation } = require('./inventoryReservationService');
const { assertNoFulfillmentIssueForSoLine } = require('./inventoryStockIssueGuardService');
// SalesOrderFulfillment bridge uses ledger posts + quantityFulfilled updates (Phase 3 MVP).

const DN_STATUSES = ['draft', 'ready_for_dispatch', 'dispatched', 'partially_delivered', 'delivered', 'closed', 'cancelled'];
const DR_STATUSES = ['draft', 'pending_approval', 'approved', 'inventory_updated', 'closed', 'cancelled'];
const SR_STATUSES = ['draft', 'pending_approval', 'approved', 'inventory_updated', 'closed', 'cancelled'];

const DeliveryNoteLineSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
  deliveryNoteId: { type: Schema.Types.ObjectId, ref: 'DeliveryNote', required: true, index: true },
  salesOrderLineId: { type: Schema.Types.ObjectId, ref: 'SalesOrderLine', required: true },
  variantId: { type: Schema.Types.ObjectId, ref: 'ItemVariant', required: true },
  skuSnapshot: String,
  itemNameSnapshot: String,
  quantityOrdered: { type: Number, default: 0 },
  quantityDelivered: { type: Number, required: true, min: 0 },
  quantityPending: { type: Number, default: 0 },
  unitOfMeasure: String,
  inventoryLocationId: { type: Schema.Types.ObjectId, ref: 'InventoryLocation', required: true },
  lineRemarks: String
}, { timestamps: true });

const DeliveryNoteSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
  deliveryNoteNumber: { type: String, required: true, index: true },
  deliveryDate: { type: Date, default: Date.now },
  customerId: { type: Schema.Types.ObjectId, required: true, index: true },
  salesOrderId: { type: Schema.Types.ObjectId, ref: 'SalesOrder', required: true, index: true },
  invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', default: null },
  deliveryMethod: String,
  vehicleNumber: String,
  trackingNumber: String,
  deliveryAddress: { type: Schema.Types.Mixed, default: null },
  contactPerson: String,
  status: { type: String, enum: DN_STATUSES, default: 'draft', index: true },
  notes: String,
  fulfillmentEventId: { type: String, default: null },
  externalReferenceId: String,
  syncStatus: { type: String, default: 'not_synced' },
  lastSyncAt: Date,
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  modifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  deletedAt: { type: Date, default: null, index: true }
}, { timestamps: true });
DeliveryNoteSchema.index({ organizationId: 1, deliveryNoteNumber: 1 }, { unique: true });

const DeliveryReturnLineSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
  deliveryReturnId: { type: Schema.Types.ObjectId, ref: 'DeliveryReturn', required: true, index: true },
  deliveryNoteLineId: { type: Schema.Types.ObjectId, ref: 'DeliveryNoteLine', required: true },
  variantId: { type: Schema.Types.ObjectId, ref: 'ItemVariant', required: true },
  quantityDelivered: Number,
  quantityReturned: { type: Number, required: true, min: 0 },
  returnReason: { type: String, required: true },
  returnCondition: { type: String, required: true },
  inventoryLocationId: { type: Schema.Types.ObjectId, ref: 'InventoryLocation', required: true },
  remarks: String,
  skuSnapshot: String,
  itemNameSnapshot: String,
  unitOfMeasure: String
}, { timestamps: true });

const DeliveryReturnSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
  deliveryReturnNumber: { type: String, required: true, index: true },
  returnDate: { type: Date, default: Date.now },
  customerId: { type: Schema.Types.ObjectId, required: true },
  deliveryNoteId: { type: Schema.Types.ObjectId, ref: 'DeliveryNote', required: true, index: true },
  salesOrderId: { type: Schema.Types.ObjectId, ref: 'SalesOrder', required: true },
  returnReason: { type: String, required: true },
  returnLocationId: { type: Schema.Types.ObjectId, ref: 'InventoryLocation', required: true },
  status: { type: String, enum: DR_STATUSES, default: 'draft', index: true },
  notes: String,
  externalReferenceId: String,
  syncStatus: { type: String, default: 'not_synced' },
  lastSyncAt: Date,
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  modifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  deletedAt: { type: Date, default: null, index: true }
}, { timestamps: true });
DeliveryReturnSchema.index({ organizationId: 1, deliveryReturnNumber: 1 }, { unique: true });

const SalesReturnLineSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
  salesReturnId: { type: Schema.Types.ObjectId, ref: 'SalesReturn', required: true, index: true },
  invoiceLineId: { type: Schema.Types.ObjectId, ref: 'InvoiceLine', required: true },
  variantId: { type: Schema.Types.ObjectId, ref: 'ItemVariant', required: true },
  quantityInvoiced: Number,
  quantityPreviouslyReturned: { type: Number, default: 0 },
  quantityReturned: { type: Number, required: true, min: 0 },
  unitPrice: Number,
  taxSnapshot: { type: Schema.Types.Mixed, default: {} },
  chargeSnapshot: { type: Schema.Types.Mixed, default: {} },
  returnReason: { type: String, required: true },
  returnCondition: { type: String, required: true },
  inventoryLocationId: { type: Schema.Types.ObjectId, ref: 'InventoryLocation', required: true },
  lineTotal: Number,
  skuSnapshot: String,
  itemNameSnapshot: String,
  unitOfMeasure: String,
  remarks: String
}, { timestamps: true });

const SalesReturnSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
  salesReturnNumber: { type: String, required: true, index: true },
  returnDate: { type: Date, default: Date.now },
  customerId: { type: Schema.Types.ObjectId, required: true },
  invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true, index: true },
  deliveryNoteId: { type: Schema.Types.ObjectId, ref: 'DeliveryNote', default: null },
  salesOrderId: { type: Schema.Types.ObjectId, ref: 'SalesOrder', default: null },
  returnLocationId: { type: Schema.Types.ObjectId, ref: 'InventoryLocation', required: true },
  overallReturnReason: { type: String, required: true },
  returnType: { type: String, default: 'refund' },
  status: { type: String, enum: SR_STATUSES, default: 'draft', index: true },
  notes: String,
  subtotal: { type: Number, default: 0 },
  taxTotal: { type: Number, default: 0 },
  chargesTotal: { type: Number, default: 0 },
  grandTotal: { type: Number, default: 0 },
  externalReferenceId: String,
  syncStatus: { type: String, default: 'not_synced' },
  lastSyncAt: Date,
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  modifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  deletedAt: { type: Date, default: null, index: true }
}, { timestamps: true });
SalesReturnSchema.index({ organizationId: 1, salesReturnNumber: 1 }, { unique: true });

const DeliveryNote = wrapTenantModel(mongoose.model('DeliveryNote', DeliveryNoteSchema));
const DeliveryNoteLine = wrapTenantModel(mongoose.model('DeliveryNoteLine', DeliveryNoteLineSchema));
const DeliveryReturn = wrapTenantModel(mongoose.model('DeliveryReturn', DeliveryReturnSchema));
const DeliveryReturnLine = wrapTenantModel(mongoose.model('DeliveryReturnLine', DeliveryReturnLineSchema));
const SalesReturn = wrapTenantModel(mongoose.model('SalesReturn', SalesReturnSchema));
const SalesReturnLine = wrapTenantModel(mongoose.model('SalesReturnLine', SalesReturnLineSchema));

function validationError(message, code = 'VALIDATION') {
  const err = new Error(message);
  err.code = code;
  return err;
}

async function nextDocNumber(organizationId, moduleKey, prefix) {
  const seq = await ModuleSequence.findOneAndUpdate(
    { organizationId, moduleKey, periodKey: '' },
    { $inc: { nextValue: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return `${prefix}-${String(Number(seq.nextValue) || 1).padStart(4, '0')}`;
}

async function createDeliveryNote({ organizationId, userId, payload }) {
  const salesOrderId = payload.salesOrderId;
  if (!salesOrderId) throw validationError('salesOrderId is required');
  const order = await SalesOrder.findOne({ _id: salesOrderId, organizationId }).lean();
  if (!order) throw validationError('Sales order not found', 'NOT_FOUND');
  const soLines = await SalesOrderLine.find({ organizationId, salesOrderId }).lean();
  const deliveryNoteNumber = await nextDocNumber(organizationId, 'delivery_notes', 'DN');

  const dn = await DeliveryNote.create({
    organizationId,
    deliveryNoteNumber,
    deliveryDate: payload.deliveryDate || new Date(),
    customerId: order.customerId || payload.customerId,
    salesOrderId,
    invoiceId: payload.invoiceId || null,
    deliveryMethod: payload.deliveryMethod || null,
    vehicleNumber: payload.vehicleNumber || null,
    trackingNumber: payload.trackingNumber || null,
    deliveryAddress: payload.deliveryAddress || order.shipToAddressSnapshot || null,
    contactPerson: payload.contactPerson || null,
    status: 'draft',
    notes: payload.notes || null,
    createdBy: userId,
    modifiedBy: userId
  });

  const inputLines = Array.isArray(payload.lines) ? payload.lines : [];
  const docs = [];
  for (const soLine of soLines) {
    const ordered = Number(soLine.quantity) || 0;
    const fulfilled = Number(soLine.quantityFulfilled || soLine.quantityDelivered || 0);
    const pending = Math.max(0, ordered - fulfilled);
    if (pending <= 0) continue;
    const override = inputLines.find((l) => String(l.salesOrderLineId) === String(soLine._id));
    const delivered = Number(override?.quantityDelivered ?? pending);
    if (delivered <= 0) continue;
    if (delivered > pending) throw validationError('Cannot deliver more than pending quantity');
    if (!override?.inventoryLocationId && !payload.inventoryLocationId) {
      throw validationError('inventoryLocationId is required');
    }
    docs.push({
      organizationId,
      deliveryNoteId: dn._id,
      salesOrderLineId: soLine._id,
      variantId: soLine.variantId,
      skuSnapshot: soLine.skuSnapshot,
      itemNameSnapshot: soLine.itemNameSnapshot,
      quantityOrdered: ordered,
      quantityDelivered: delivered,
      quantityPending: pending - delivered,
      unitOfMeasure: soLine.unitOfMeasure,
      inventoryLocationId: override?.inventoryLocationId || payload.inventoryLocationId,
      lineRemarks: override?.lineRemarks || null
    });
  }
  if (!docs.length) throw validationError('No deliverable lines');
  await DeliveryNoteLine.insertMany(docs);
  const lines = await DeliveryNoteLine.find({ organizationId, deliveryNoteId: dn._id }).lean();
  return { deliveryNote: dn.toObject(), lines };
}

async function confirmDeliveryNote({ organizationId, id, userId }) {
  const dn = await DeliveryNote.findOne({ _id: id, organizationId, deletedAt: null });
  if (!dn) throw validationError('Delivery note not found', 'NOT_FOUND');
  if (!['draft', 'ready_for_dispatch'].includes(dn.status)) {
    throw validationError('Delivery note cannot be confirmed');
  }
  const lines = await DeliveryNoteLine.find({ organizationId, deliveryNoteId: id });

  for (const line of lines) {
    await assertNoFulfillmentIssueForSoLine({
      organizationId,
      salesOrderLineId: line.salesOrderLineId
    });
  }

  // Ledger post (fulfillment bridge — quantityFulfilled updated for SO balance)
  const byLoc = new Map();
  for (const line of lines) {
    const locUuid = await resolveInventoryLocationUuid({
      organizationId,
      locationRef: line.inventoryLocationId
    });
    if (!byLoc.has(locUuid)) byLoc.set(locUuid, []);
    byLoc.get(locUuid).push({
      variantId: line.variantId,
      quantityDelta: -Number(line.quantityDelivered),
      entryType: 'fulfillment_deduct',
      lineId: String(line._id),
      sourceRef: { moduleKey: 'delivery_notes', recordId: String(dn._id), lineId: String(line._id) },
      _salesOrderLineId: line.salesOrderLineId,
      _qty: Number(line.quantityDelivered)
    });
  }
  for (const [loc, invLines] of byLoc) {
    const result = await postInventoryTransaction({
      organizationId,
      userId,
      transactionType: 'shipment',
      inventoryLocationId: loc,
      lines: invLines.map(({ _salesOrderLineId, _qty, ...rest }) => rest),
      sourceContext: 'delivery_note',
      sourceRef: { moduleKey: 'delivery_notes', recordId: String(dn._id), lineId: null },
      idempotent: true
    });

    if (!result.duplicate) {
      for (let i = 0; i < invLines.length; i += 1) {
        const meta = invLines[i];
        const ledgerEntryId = result.ledgerEntries?.[i]?.inventoryLedgerEntryId || null;
        await consumeReservation({
          organizationId,
          salesOrderLineId: meta._salesOrderLineId,
          variantId: meta.variantId,
          inventoryLocationId: loc,
          quantity: meta._qty,
          userId,
          ledgerEntryId
        });
      }
    }
  }
  for (const line of lines) {
    await SalesOrderLine.updateOne(
      { _id: line.salesOrderLineId, organizationId },
      { $inc: { quantityFulfilled: Number(line.quantityDelivered) } }
    );
  }

  dn.status = 'dispatched';
  dn.modifiedBy = userId;
  await dn.save();
  const outLines = await DeliveryNoteLine.find({ organizationId, deliveryNoteId: id }).lean();
  const deliveryNote = dn.toObject();

  try {
    const { enqueueAfterDnConfirm } = require('./connectors/tally/tallyOutboxHooks');
    await enqueueAfterDnConfirm({ organizationId, deliveryNote });
  } catch (_err) {
    // Non-blocking: Tally outbox must not break DN confirm
  }

  return { deliveryNote, lines: outLines };
}

async function listDeliveryNotes({ organizationId, salesOrderId = null }) {
  const q = { organizationId, deletedAt: null };
  if (salesOrderId) q.salesOrderId = salesOrderId;
  return DeliveryNote.find(q).sort({ createdAt: -1 }).limit(50).lean();
}

async function getDeliveryNote({ organizationId, id }) {
  const deliveryNote = await DeliveryNote.findOne({ _id: id, organizationId, deletedAt: null }).lean();
  if (!deliveryNote) throw validationError('Delivery note not found', 'NOT_FOUND');
  const lines = await DeliveryNoteLine.find({ organizationId, deliveryNoteId: id }).lean();
  return { deliveryNote, lines };
}

async function createDeliveryReturn({ organizationId, userId, payload }) {
  const deliveryNoteId = payload.deliveryNoteId;
  if (!deliveryNoteId) throw validationError('deliveryNoteId is required');
  const { deliveryNote, lines: dnLines } = await getDeliveryNote({ organizationId, id: deliveryNoteId });
  if (!payload.returnReason) throw validationError('returnReason is required');
  if (!payload.returnLocationId) throw validationError('returnLocationId is required');
  const deliveryReturnNumber = await nextDocNumber(organizationId, 'delivery_returns', 'DR');
  const inputLines = Array.isArray(payload.lines) ? payload.lines : [];
  if (!inputLines.length) throw validationError('At least one line is required');

  const dr = await DeliveryReturn.create({
    organizationId,
    deliveryReturnNumber,
    returnDate: payload.returnDate || new Date(),
    customerId: deliveryNote.customerId,
    deliveryNoteId,
    salesOrderId: deliveryNote.salesOrderId,
    returnReason: payload.returnReason,
    returnLocationId: payload.returnLocationId,
    status: 'draft',
    notes: payload.notes || null,
    createdBy: userId,
    modifiedBy: userId
  });

  const docs = [];
  for (const row of inputLines) {
    const dnLine = dnLines.find((l) => String(l._id) === String(row.deliveryNoteLineId));
    if (!dnLine) throw validationError('Invalid deliveryNoteLineId');
    const qty = Number(row.quantityReturned);
    if (qty <= 0 || qty > Number(dnLine.quantityDelivered)) {
      throw validationError('Invalid return quantity');
    }
    docs.push({
      organizationId,
      deliveryReturnId: dr._id,
      deliveryNoteLineId: dnLine._id,
      variantId: dnLine.variantId,
      quantityDelivered: dnLine.quantityDelivered,
      quantityReturned: qty,
      returnReason: row.returnReason || payload.returnReason,
      returnCondition: row.returnCondition || 'Good',
      inventoryLocationId: row.inventoryLocationId || payload.returnLocationId,
      remarks: row.remarks || null,
      skuSnapshot: dnLine.skuSnapshot,
      itemNameSnapshot: dnLine.itemNameSnapshot,
      unitOfMeasure: dnLine.unitOfMeasure
    });
  }
  await DeliveryReturnLine.insertMany(docs);
  const lines = await DeliveryReturnLine.find({ organizationId, deliveryReturnId: dr._id }).lean();
  return { deliveryReturn: dr.toObject(), lines };
}

async function approveDeliveryReturn({ organizationId, id, userId }) {
  const dr = await DeliveryReturn.findOne({ _id: id, organizationId, deletedAt: null });
  if (!dr) throw validationError('Delivery return not found', 'NOT_FOUND');
  if (!['draft', 'pending_approval'].includes(dr.status)) throw validationError('Cannot approve');
  const lines = await DeliveryReturnLine.find({ organizationId, deliveryReturnId: id });
  const restoreLines = lines
    .filter((l) => String(l.returnCondition || '').toLowerCase() === 'good')
    .map((l) => ({
      variantId: l.variantId,
      quantityDelta: Number(l.quantityReturned),
      entryType: 'fulfillment_restore',
      lineId: String(l._id),
      sourceRef: { moduleKey: 'delivery_returns', recordId: String(dr._id), lineId: String(l._id) }
    }));
  if (restoreLines.length) {
    const locUuid = await resolveInventoryLocationUuid({
      organizationId,
      locationRef: dr.returnLocationId
    });
    await postInventoryTransaction({
      organizationId,
      userId,
      transactionType: 'return',
      inventoryLocationId: locUuid,
      lines: restoreLines,
      sourceContext: 'delivery_return',
      sourceRef: { moduleKey: 'delivery_returns', recordId: String(dr._id), lineId: null },
      idempotent: true
    });
  }
  dr.status = 'inventory_updated';
  dr.modifiedBy = userId;
  await dr.save();
  const outLines = await DeliveryReturnLine.find({ organizationId, deliveryReturnId: id }).lean();
  return { deliveryReturn: dr.toObject(), lines: outLines };
}

async function createSalesReturn({ organizationId, userId, payload }) {
  const invoiceId = payload.invoiceId;
  if (!invoiceId) throw validationError('invoiceId is required');
  const invoice = await Invoice.findOne({ _id: invoiceId, organizationId }).lean();
  if (!invoice) throw validationError('Invoice not found', 'NOT_FOUND');
  const invLines = await InvoiceLine.find({ organizationId, invoiceId }).lean();
  if (!payload.overallReturnReason) throw validationError('overallReturnReason is required');
  if (!payload.returnLocationId) throw validationError('returnLocationId is required');

  const salesReturnNumber = await nextDocNumber(organizationId, 'sales_returns', 'SR');
  const inputLines = Array.isArray(payload.lines) ? payload.lines : [];
  if (!inputLines.length) throw validationError('At least one line is required');

  let subtotal = 0;
  const docs = [];
  for (const row of inputLines) {
    const invLine = invLines.find((l) => String(l._id) === String(row.invoiceLineId));
    if (!invLine) throw validationError('Invalid invoiceLineId');
    const qty = Number(row.quantityReturned);
    const available = Number(invLine.quantity) - Number(invLine.quantityReturned || 0);
    if (qty <= 0 || qty > available) throw validationError('Invalid return quantity');
    const lineTotal = qty * Number(invLine.unitPriceSnapshot || 0);
    subtotal += lineTotal;
    docs.push({
      organizationId,
      invoiceLineId: invLine._id,
      variantId: invLine.variantId,
      quantityInvoiced: invLine.quantity,
      quantityPreviouslyReturned: invLine.quantityReturned || 0,
      quantityReturned: qty,
      unitPrice: invLine.unitPriceSnapshot,
      taxSnapshot: invLine.taxSnapshot || {},
      chargeSnapshot: invLine.chargeSnapshot || {},
      returnReason: row.returnReason || payload.overallReturnReason,
      returnCondition: row.returnCondition || 'Good',
      inventoryLocationId: row.inventoryLocationId || payload.returnLocationId,
      lineTotal,
      skuSnapshot: invLine.skuSnapshot,
      itemNameSnapshot: invLine.itemNameSnapshot,
      unitOfMeasure: invLine.unitOfMeasure,
      remarks: row.remarks || null
    });
  }

  const sr = await SalesReturn.create({
    organizationId,
    salesReturnNumber,
    returnDate: payload.returnDate || new Date(),
    customerId: invoice.customerId || payload.customerId,
    invoiceId,
    deliveryNoteId: payload.deliveryNoteId || null,
    salesOrderId: invoice.sourceSalesOrderIds?.[0] || payload.salesOrderId || null,
    returnLocationId: payload.returnLocationId,
    overallReturnReason: payload.overallReturnReason,
    returnType: payload.returnType || 'refund',
    status: 'draft',
    notes: payload.notes || null,
    subtotal,
    taxTotal: 0,
    chargesTotal: 0,
    grandTotal: subtotal,
    createdBy: userId,
    modifiedBy: userId
  });
  for (const d of docs) d.salesReturnId = sr._id;
  await SalesReturnLine.insertMany(docs);
  const lines = await SalesReturnLine.find({ organizationId, salesReturnId: sr._id }).lean();
  return { salesReturn: sr.toObject(), lines };
}

async function approveSalesReturn({ organizationId, id, userId }) {
  const sr = await SalesReturn.findOne({ _id: id, organizationId, deletedAt: null });
  if (!sr) throw validationError('Sales return not found', 'NOT_FOUND');
  if (!['draft', 'pending_approval'].includes(sr.status)) throw validationError('Cannot approve');
  const lines = await SalesReturnLine.find({ organizationId, salesReturnId: id });
  const restore = lines
    .filter((l) => String(l.returnCondition || '').toLowerCase() === 'good')
    .map((l) => ({
      variantId: l.variantId,
      quantityDelta: Number(l.quantityReturned),
      entryType: 'fulfillment_restore',
      lineId: String(l._id),
      sourceRef: { moduleKey: 'sales_returns', recordId: String(sr._id), lineId: String(l._id) }
    }));
  if (restore.length) {
    const locUuid = await resolveInventoryLocationUuid({
      organizationId,
      locationRef: sr.returnLocationId
    });
    await postInventoryTransaction({
      organizationId,
      userId,
      transactionType: 'return',
      inventoryLocationId: locUuid,
      lines: restore,
      sourceContext: 'sales_return',
      sourceRef: { moduleKey: 'sales_returns', recordId: String(sr._id), lineId: null },
      idempotent: true
    });
  }
  for (const line of lines) {
    await InvoiceLine.updateOne(
      { _id: line.invoiceLineId, organizationId },
      { $inc: { quantityReturned: Number(line.quantityReturned) } }
    );
  }
  sr.status = 'inventory_updated';
  sr.modifiedBy = userId;
  await sr.save();
  const outLines = await SalesReturnLine.find({ organizationId, salesReturnId: id }).lean();
  return { salesReturn: sr.toObject(), lines: outLines };
}

async function listDeliveryReturns({ organizationId }) {
  return DeliveryReturn.find({ organizationId, deletedAt: null }).sort({ createdAt: -1 }).limit(50).lean();
}

async function listSalesReturns({ organizationId }) {
  return SalesReturn.find({ organizationId, deletedAt: null }).sort({ createdAt: -1 }).limit(50).lean();
}

module.exports = {
  DeliveryNote,
  DeliveryNoteLine,
  DeliveryReturn,
  DeliveryReturnLine,
  SalesReturn,
  SalesReturnLine,
  createDeliveryNote,
  confirmDeliveryNote,
  listDeliveryNotes,
  getDeliveryNote,
  createDeliveryReturn,
  approveDeliveryReturn,
  listDeliveryReturns,
  createSalesReturn,
  approveSalesReturn,
  listSalesReturns
};
