const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const { PO_STATUS_VALUES, PO_STATUSES } = require('../constants/procurementLifecycle');

const DELIVERY_METHODS = Object.freeze([
  'supplier_delivery',
  'courier',
  'transport',
  'pickup'
]);

const PurchaseOrderLineSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  purchaseOrderId: { type: Schema.Types.ObjectId, ref: 'PurchaseOrder', required: true, index: true },
  lineOrder: { type: Number, default: 1 },
  variantId: { type: Schema.Types.ObjectId, ref: 'ItemVariant', required: true, index: true },
  skuSnapshot: { type: String, trim: true, default: null },
  itemNameSnapshot: { type: String, trim: true, default: null },
  descriptionSnapshot: { type: String, default: null },
  /** Supplier SKU snapshot from vendor catalog at order time */
  vendorItemCode: { type: String, trim: true, default: null },
  /** Supplier description snapshot from vendor catalog */
  vendorItemName: { type: String, trim: true, default: null },
  /** Catalog MOQ at order time (advisory) */
  minOrderQty: { type: Number, default: null, min: 0 },
  quantityOrdered: { type: Number, required: true, min: 0 },
  quantityReceived: { type: Number, default: 0, min: 0 },
  quantityPending: { type: Number, default: 0, min: 0 },
  /** Units returned to vendor via Purchase Returns (completed) */
  quantityReturned: { type: Number, default: 0, min: 0 },
  unitOfMeasure: { type: String, trim: true, default: null },
  unitPrice: { type: Number, default: 0 },
  discountType: { type: String, default: null },
  discountValue: { type: Number, default: 0 },
  taxSnapshot: { type: Schema.Types.Mixed, default: { taxes: [] } },
  chargeSnapshot: { type: Schema.Types.Mixed, default: { charges: [] } },
  lineSubtotal: { type: Number, default: 0 },
  lineTaxTotal: { type: Number, default: 0 },
  lineTotal: { type: Number, default: 0 },
  expectedDeliveryDate: { type: Date, default: null }
}, { timestamps: true });

PurchaseOrderLineSchema.index({ organizationId: 1, purchaseOrderId: 1, lineOrder: 1 });

const PurchaseOrderSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  poNumber: { type: String, required: true, trim: true, index: true },
  /** Required title (PM: Purchase Order Subject) */
  subject: { type: String, trim: true, default: '', index: true },
  poDate: { type: Date, default: Date.now },
  vendorId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  vendorContactId: { type: Schema.Types.ObjectId, ref: 'People', default: null },
  vendorReferenceNumber: { type: String, trim: true, default: null },
  currency: { type: String, trim: true, default: 'USD' },
  exchangeRate: { type: Number, default: 1 },
  paymentTerms: { type: String, trim: true, default: null },
  expectedDeliveryDate: { type: Date, default: null },
  /** Purchase Owner — defaults to creator */
  buyerId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  status: { type: String, enum: PO_STATUS_VALUES, default: PO_STATUSES.DRAFT, index: true },
  /** Printed on PO (vendor-facing) */
  notes: { type: String, default: null },
  /** Internal receiving notes only */
  internalNotes: { type: String, default: null },
  termsAndConditions: { type: String, default: null },
  /** Default warehouse for receipt */
  deliveryWarehouseId: { type: Schema.Types.ObjectId, ref: 'InventoryLocation', default: null },
  deliveryMethod: { type: String, trim: true, default: null },
  shippingTerms: { type: String, trim: true, default: null },
  deliveryInstructions: { type: String, default: null },
  subtotal: { type: Number, default: 0 },
  /** Overall document discount: 'percent' | 'amount' | null */
  overallDiscountType: { type: String, trim: true, default: null },
  overallDiscountValue: { type: Number, default: 0 },
  overallDiscountTotal: { type: Number, default: 0 },
  /** Pre-tax after discount + before taxes (document-level) */
  preTaxTotal: { type: Number, default: 0 },
  taxTotal: { type: Number, default: 0 },
  chargesTotal: { type: Number, default: 0 },
  /** Manual (+/-) adjustment after tax */
  adjustmentTotal: { type: Number, default: 0 },
  grandTotal: { type: Number, default: 0 },
  /** Transaction-level tax snapshot (ids + values applied on document) */
  transactionTaxSnapshot: { type: Schema.Types.Mixed, default: { taxes: [] } },
  taxDocumentSnapshot: { type: Schema.Types.Mixed, default: {} },
  chargeDocumentSnapshot: { type: Schema.Types.Mixed, default: { charges: [] } },
  externalReferenceId: { type: String, trim: true, default: null, index: true },
  syncStatus: { type: String, trim: true, default: 'not_synced', index: true },
  lastSyncAt: { type: Date, default: null },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  modifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  deletedAt: { type: Date, default: null, index: true }
}, { timestamps: true });

PurchaseOrderSchema.index({ organizationId: 1, poNumber: 1 }, { unique: true });

module.exports = {
  PurchaseOrder: wrapTenantModel(mongoose.model('PurchaseOrder', PurchaseOrderSchema)),
  PurchaseOrderLine: wrapTenantModel(mongoose.model('PurchaseOrderLine', PurchaseOrderLineSchema)),
  DELIVERY_METHODS
};
