const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const { PR_STATUS_VALUES, PR_STATUSES } = require('../constants/procurementLifecycle');

const PurchaseReturnLineSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  purchaseReturnId: { type: Schema.Types.ObjectId, ref: 'PurchaseReturn', required: true, index: true },
  receiptNoteLineId: { type: Schema.Types.ObjectId, ref: 'ReceiptNoteLine', required: true },
  variantId: { type: Schema.Types.ObjectId, ref: 'ItemVariant', required: true, index: true },
  skuSnapshot: { type: String, default: null },
  itemNameSnapshot: { type: String, default: null },
  quantityReceived: { type: Number, default: 0 },
  quantityReturned: { type: Number, required: true, min: 0 },
  unitOfMeasure: { type: String, default: null },
  unitPrice: { type: Number, default: 0 },
  returnReason: { type: String, required: true },
  taxSnapshot: { type: Schema.Types.Mixed, default: {} },
  chargeSnapshot: { type: Schema.Types.Mixed, default: {} },
  lineTotal: { type: Number, default: 0 },
  inventoryLocationId: { type: Schema.Types.ObjectId, ref: 'InventoryLocation', required: true }
}, { timestamps: true });

const PurchaseReturnSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  purchaseReturnNumber: { type: String, required: true, trim: true, index: true },
  returnDate: { type: Date, default: Date.now },
  vendorId: { type: Schema.Types.ObjectId, required: true, index: true },
  receiptNoteId: { type: Schema.Types.ObjectId, ref: 'ReceiptNote', required: true, index: true },
  purchaseOrderId: { type: Schema.Types.ObjectId, ref: 'PurchaseOrder', required: true, index: true },
  returnReason: { type: String, required: true },
  currency: { type: String, default: 'USD' },
  status: { type: String, enum: PR_STATUS_VALUES, default: PR_STATUSES.DRAFT, index: true },
  notes: { type: String, default: null },
  subtotal: { type: Number, default: 0 },
  taxTotal: { type: Number, default: 0 },
  chargesTotal: { type: Number, default: 0 },
  grandTotal: { type: Number, default: 0 },
  externalReferenceId: { type: String, default: null },
  syncStatus: { type: String, default: 'not_synced' },
  lastSyncAt: { type: Date, default: null },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  modifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  deletedAt: { type: Date, default: null, index: true }
}, { timestamps: true });

PurchaseReturnSchema.index({ organizationId: 1, purchaseReturnNumber: 1 }, { unique: true });

module.exports = {
  PurchaseReturn: wrapTenantModel(mongoose.model('PurchaseReturn', PurchaseReturnSchema)),
  PurchaseReturnLine: wrapTenantModel(mongoose.model('PurchaseReturnLine', PurchaseReturnLineSchema))
};
