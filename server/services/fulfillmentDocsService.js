/**
 * Sales fulfillment commercial docs — Delivery Note / Delivery Return / Sales Return.
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const Invoice = require('../models/Invoice');
const InvoiceLine = require('../models/InvoiceLine');
const { postInventoryTransaction } = require('./inventoryTransactionService');
const { resolveInventoryLocationUuid } = require('./inventoryLocationService');
// Sales return uses ledger posts (invoice-based reverse path).

const SR_STATUSES = ['draft', 'pending_approval', 'approved', 'inventory_updated', 'closed', 'cancelled'];

const { DeliveryNote, DeliveryNoteLine } = require('../models/DeliveryNote');
const deliveryNoteService = require('./deliveryNoteService');

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

function getModel(name, schema) {
  if (mongoose.models[name]) return mongoose.models[name];
  return mongoose.model(name, schema);
}

const { DeliveryReturn, DeliveryReturnLine } = require('../models/DeliveryReturn');
const SalesReturn = wrapTenantModel(getModel('SalesReturn', SalesReturnSchema));
const SalesReturnLine = wrapTenantModel(getModel('SalesReturnLine', SalesReturnLineSchema));

function validationError(message, code = 'VALIDATION') {
  const err = new Error(message);
  err.code = code;
  return err;
}

async function nextDocNumber(organizationId, moduleKey, prefix) {
  const { allocateDocumentNumber } = require('./moduleNumberingService');
  return allocateDocumentNumber(organizationId, moduleKey, prefix, 4);
}

async function createDeliveryNote(args) {
  return deliveryNoteService.createDeliveryNoteLegacy(args);
}

async function confirmDeliveryNote(args) {
  return deliveryNoteService.confirmDeliveryNote(args);
}

async function listDeliveryNotes({ organizationId, salesOrderId = null }) {
  const result = await deliveryNoteService.listDeliveryNotes({
    organizationId,
    salesOrderId,
    limit: 50
  });
  return result.data;
}

async function getDeliveryNote(args) {
  return deliveryNoteService.getDeliveryNote(args);
}

async function createDeliveryReturn(args) {
  return require('./deliveryReturnService').createDeliveryReturnLegacy(args);
}

async function approveDeliveryReturn(args) {
  return require('./deliveryReturnService').approveDeliveryReturnLegacy(args);
}

async function listDeliveryReturns(args) {
  const result = await require('./deliveryReturnService').listDeliveryReturns(args);
  return result.data;
}

async function getSalesReturn({ organizationId, id }) {
  const sr = await SalesReturn.findOne({ _id: id, organizationId, deletedAt: null }).lean();
  if (!sr) throw validationError('Sales return not found', 'NOT_FOUND');
  const lines = await SalesReturnLine.find({ organizationId, salesReturnId: id }).lean();
  return { salesReturn: sr, lines };
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
  let inputLines = Array.isArray(payload.lines) ? payload.lines : [];
  // Generic create form only captures header fields — auto-return remaining invoice qty.
  if (!inputLines.length) {
    inputLines = invLines
      .map((l) => {
        const available = Number(l.quantity || 0) - Number(l.quantityReturned || 0);
        if (available <= 0) return null;
        return {
          invoiceLineId: l._id,
          quantityReturned: available,
          returnCondition: 'Good'
        };
      })
      .filter(Boolean);
  }
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

async function listSalesReturns({
  organizationId,
  limit = 50,
  page = 1,
  status = null,
  search = null,
  sortBy = 'createdAt',
  sortOrder = 'desc'
}) {
  const q = { organizationId, deletedAt: null };
  if (status) {
    const statuses = String(status)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (statuses.length === 1) q.status = statuses[0];
    else if (statuses.length > 1) q.status = { $in: statuses };
  }
  if (search) {
    const re = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    q.$or = [{ salesReturnNumber: re }, { overallReturnReason: re }];
  }

  const sort = { [sortBy || 'createdAt']: String(sortOrder).toLowerCase() === 'asc' ? 1 : -1 };
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(200, Math.max(1, Number(limit) || 50));
  const skip = (pageNum - 1) * limitNum;

  const [data, total] = await Promise.all([
    SalesReturn.find(q).sort(sort).skip(skip).limit(limitNum).lean(),
    SalesReturn.countDocuments(q)
  ]);

  return {
    data,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum) || 1
    }
  };
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
  getSalesReturn,
  createSalesReturn,
  approveSalesReturn,
  listSalesReturns
};
