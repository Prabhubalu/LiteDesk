const mongoose = require('mongoose');
const crypto = require('crypto');
const Schema = mongoose.Schema;
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const PURCHASE_BILL_STATUSES = ['draft', 'pending_approval', 'posted', 'void', 'cancelled'];

const PurchaseBillLineSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  purchaseBillId: { type: Schema.Types.ObjectId, ref: 'PurchaseBill', required: true, index: true },
  purchaseBillLineId: { type: String, required: true, unique: true, trim: true, index: true },
  purchaseOrderLineId: { type: Schema.Types.ObjectId, ref: 'PurchaseOrderLine', default: null },
  receiptNoteLineId: { type: Schema.Types.ObjectId, ref: 'ReceiptNoteLine', default: null },
  variantId: { type: Schema.Types.ObjectId, ref: 'ItemVariant', default: null, index: true },
  skuSnapshot: { type: String, default: null },
  itemNameSnapshot: { type: String, default: null },
  description: { type: String, default: null },
  quantity: { type: Number, default: 0 },
  unitOfMeasure: { type: String, default: null },
  unitPrice: { type: Number, default: 0 },
  discountType: { type: String, trim: true, default: null },
  discountValue: { type: Number, default: 0 },
  discountAmount: { type: Number, default: 0 },
  taxSnapshot: { type: Schema.Types.Mixed, default: {} },
  chargeSnapshot: { type: Schema.Types.Mixed, default: {} },
  lineSubtotal: { type: Number, default: 0 },
  lineTaxTotal: { type: Number, default: 0 },
  lineTotal: { type: Number, default: 0 },
  lineOrder: { type: Number, default: 0 },
  remarks: { type: String, default: null }
}, { timestamps: true });

PurchaseBillLineSchema.pre('validate', function assignLineId(next) {
  if (!this.purchaseBillLineId) {
    this.purchaseBillLineId = crypto.randomUUID();
  }
  return next();
});

const PurchaseBillSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  purchaseBillId: { type: String, required: true, unique: true, trim: true, index: true },
  purchaseBillNumber: { type: String, required: true, trim: true, index: true },
  billDate: { type: Date, default: Date.now, index: true },
  dueDate: { type: Date, default: null },
  vendorId: { type: Schema.Types.ObjectId, required: true, index: true },
  purchaseOrderId: { type: Schema.Types.ObjectId, ref: 'PurchaseOrder', default: null, index: true },
  receiptNoteId: { type: Schema.Types.ObjectId, ref: 'ReceiptNote', default: null, index: true },
  status: {
    type: String,
    enum: PURCHASE_BILL_STATUSES,
    default: 'draft',
    index: true
  },
  currency: { type: String, trim: true, default: 'INR', index: true },
  exchangeRateSnapshot: { type: Number, default: 1 },
  placeOfSupply: { type: String, trim: true, default: null },
  partyGstin: { type: String, trim: true, default: null },
  taxDocumentSnapshot: { type: Schema.Types.Mixed, default: {} },
  transactionTaxSnapshot: { type: Schema.Types.Mixed, default: { taxes: [] } },
  chargeDocumentSnapshot: { type: Schema.Types.Mixed, default: { charges: [] } },
  subtotal: { type: Number, default: 0 },
  taxTotal: { type: Number, default: 0 },
  chargesTotal: { type: Number, default: 0 },
  discountTotal: { type: Number, default: 0 },
  adjustmentTotal: { type: Number, default: 0 },
  grandTotal: { type: Number, default: 0 },
  amountPaid: { type: Number, default: 0 },
  amountDue: { type: Number, default: 0 },
  postedAt: { type: Date, default: null, index: true },
  voidedAt: { type: Date, default: null },
  notes: { type: String, default: null },
  externalReferenceId: { type: String, trim: true, default: null, index: true },
  syncStatus: { type: String, trim: true, default: 'not_synced', index: true },
  lastSyncAt: { type: Date, default: null },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  modifiedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  deletedAt: { type: Date, default: null, index: true }
}, { timestamps: true });

PurchaseBillSchema.index({ organizationId: 1, purchaseBillNumber: 1 }, { unique: true });
PurchaseBillSchema.index(
  { organizationId: 1, externalReferenceId: 1 },
  {
    unique: true,
    partialFilterExpression: { externalReferenceId: { $type: 'string', $ne: '' } }
  }
);

PurchaseBillSchema.pre('validate', function assignPurchaseBillId(next) {
  if (!this.purchaseBillId) {
    this.purchaseBillId = crypto.randomUUID();
  }
  return next();
});

module.exports = {
  PurchaseBill: wrapTenantModel(mongoose.model('PurchaseBill', PurchaseBillSchema)),
  PurchaseBillLine: wrapTenantModel(mongoose.model('PurchaseBillLine', PurchaseBillLineSchema)),
  PURCHASE_BILL_STATUSES
};
