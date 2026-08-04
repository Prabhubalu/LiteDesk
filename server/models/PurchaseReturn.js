const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const { PR_STATUS_VALUES, PR_STATUSES } = require('../constants/procurementLifecycle');

const PR_RETURN_TYPES = Object.freeze([
  'goods_return',
  'replacement',
  'warranty_return',
  'quality_rejection',
  'supplier_recall'
]);

const PurchaseReturnLineSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  purchaseReturnId: { type: Schema.Types.ObjectId, ref: 'PurchaseReturn', required: true, index: true },
  lineOrder: { type: Number, default: 1 },
  receiptNoteId: { type: Schema.Types.ObjectId, ref: 'ReceiptNote', required: true, index: true },
  receiptNoteLineId: { type: Schema.Types.ObjectId, ref: 'ReceiptNoteLine', required: true, index: true },
  purchaseOrderId: { type: Schema.Types.ObjectId, ref: 'PurchaseOrder', default: null, index: true },
  purchaseOrderLineId: { type: Schema.Types.ObjectId, ref: 'PurchaseOrderLine', default: null },
  variantId: { type: Schema.Types.ObjectId, ref: 'ItemVariant', required: true, index: true },
  skuSnapshot: { type: String, default: null },
  itemNameSnapshot: { type: String, default: null },
  vendorItemCode: { type: String, trim: true, default: null },
  vendorItemName: { type: String, trim: true, default: null },
  quantityReceived: { type: Number, default: 0 },
  /** Accepted − already returned on RN at line materialization time */
  quantityReturnable: { type: Number, default: 0 },
  quantityReturned: { type: Number, required: true, min: 0 },
  unitOfMeasure: { type: String, default: null },
  unitPrice: { type: Number, default: 0 },
  discountType: { type: String, default: null },
  discountValue: { type: Number, default: 0 },
  returnReason: { type: String, required: true },
  taxSnapshot: { type: Schema.Types.Mixed, default: {} },
  chargeSnapshot: { type: Schema.Types.Mixed, default: {} },
  lineSubtotal: { type: Number, default: 0 },
  lineTaxTotal: { type: Number, default: 0 },
  lineTotal: { type: Number, default: 0 },
  inventoryLocationId: { type: Schema.Types.ObjectId, ref: 'InventoryLocation', required: true }
}, { timestamps: true });

PurchaseReturnLineSchema.index({ organizationId: 1, purchaseReturnId: 1, lineOrder: 1 });
PurchaseReturnLineSchema.index(
  { organizationId: 1, purchaseReturnId: 1, receiptNoteLineId: 1 },
  { unique: true }
);

const PurchaseReturnSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  purchaseReturnNumber: { type: String, required: true, trim: true, index: true },
  /** Required title (PM: Purchase Return Subject) */
  subject: { type: String, trim: true, default: '', index: true },
  returnDate: { type: Date, default: Date.now },
  vendorId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  vendorContactId: { type: Schema.Types.ObjectId, ref: 'People', default: null },
  /** Record owner — defaults to creator */
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  /** Primary/legacy single sources (optional when multi-source lines) */
  receiptNoteId: { type: Schema.Types.ObjectId, ref: 'ReceiptNote', default: null, index: true },
  purchaseOrderId: { type: Schema.Types.ObjectId, ref: 'PurchaseOrder', default: null, index: true },
  /** Goods Return | Replacement | Warranty | Quality Rejection | Supplier Recall */
  returnType: {
    type: String,
    trim: true,
    default: 'goods_return',
    enum: PR_RETURN_TYPES
  },
  returnReason: { type: String, default: null },
  supplierReference: { type: String, trim: true, default: null },
  returnWarehouseId: { type: Schema.Types.ObjectId, ref: 'InventoryLocation', default: null },
  currency: { type: String, default: 'USD' },
  status: { type: String, enum: PR_STATUS_VALUES, default: PR_STATUSES.DRAFT, index: true },
  /** Printed on Purchase Return (vendor-facing) */
  vendorNotes: { type: String, default: null },
  /** Internal users only */
  internalNotes: { type: String, default: null },
  /** @deprecated prefer vendorNotes — kept for prior rows */
  notes: { type: String, default: null },
  subtotal: { type: Number, default: 0 },
  taxTotal: { type: Number, default: 0 },
  chargesTotal: { type: Number, default: 0 },
  grandTotal: { type: Number, default: 0 },
  /** Set once inventory posted for Returned */
  inventoryPostedAt: { type: Date, default: null },
  externalReferenceId: { type: String, default: null },
  syncStatus: { type: String, default: 'not_synced' },
  lastSyncAt: { type: Date, default: null },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  modifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  deletedAt: { type: Date, default: null, index: true }
}, { timestamps: true });

PurchaseReturnSchema.index({ organizationId: 1, purchaseReturnNumber: 1 }, { unique: true });
PurchaseReturnSchema.index({ organizationId: 1, vendorId: 1, status: 1 });

module.exports = {
  PurchaseReturn: wrapTenantModel(mongoose.model('PurchaseReturn', PurchaseReturnSchema)),
  PurchaseReturnLine: wrapTenantModel(mongoose.model('PurchaseReturnLine', PurchaseReturnLineSchema)),
  PR_RETURN_TYPES
};
