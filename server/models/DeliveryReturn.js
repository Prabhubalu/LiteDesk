const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const {
  DR_STATUS_VALUES,
  DR_STATUSES,
  DR_RETURN_TYPES,
  DR_SOURCE_TYPES
} = require('../constants/deliveryReturnLifecycle');

const DeliveryReturnLineSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    deliveryReturnId: {
      type: Schema.Types.ObjectId,
      ref: 'DeliveryReturn',
      required: true,
      index: true
    },
    lineOrder: { type: Number, default: 1 },
    deliveryNoteId: {
      type: Schema.Types.ObjectId,
      ref: 'DeliveryNote',
      required: true,
      index: true
    },
    deliveryNoteLineId: {
      type: Schema.Types.ObjectId,
      ref: 'DeliveryNoteLine',
      required: true,
      index: true
    },
    salesOrderId: { type: Schema.Types.ObjectId, ref: 'SalesOrder', default: null, index: true },
    salesOrderLineId: { type: Schema.Types.ObjectId, ref: 'SalesOrderLine', default: null },
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', default: null, index: true },
    invoiceLineId: { type: Schema.Types.ObjectId, ref: 'InvoiceLine', default: null },
    variantId: { type: Schema.Types.ObjectId, ref: 'ItemVariant', required: true, index: true },
    skuSnapshot: { type: String, default: null },
    itemNameSnapshot: { type: String, default: null },
    quantityDelivered: { type: Number, default: 0 },
    /** Delivered − already returned on DN at line materialization time */
    quantityReturnable: { type: Number, default: 0 },
    quantityReturned: { type: Number, required: true, min: 0 },
    unitOfMeasure: { type: String, default: null },
    unitPrice: { type: Number, default: 0 },
    discountType: { type: String, default: null },
    discountValue: { type: Number, default: 0 },
    returnReason: { type: String, required: true },
    /** Condition: good | damaged | scrap — good lines restock to available inventory */
    returnCondition: { type: String, default: 'good' },
    taxSnapshot: { type: Schema.Types.Mixed, default: {} },
    chargeSnapshot: { type: Schema.Types.Mixed, default: {} },
    lineSubtotal: { type: Number, default: 0 },
    lineTaxTotal: { type: Number, default: 0 },
    lineTotal: { type: Number, default: 0 },
    inventoryLocationId: {
      type: Schema.Types.ObjectId,
      ref: 'InventoryLocation',
      required: true
    },
    remarks: { type: String, default: null }
  },
  { timestamps: true }
);

DeliveryReturnLineSchema.index({ organizationId: 1, deliveryReturnId: 1, lineOrder: 1 });
DeliveryReturnLineSchema.index(
  { organizationId: 1, deliveryReturnId: 1, deliveryNoteLineId: 1 },
  { unique: true }
);

const DeliveryReturnSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    deliveryReturnNumber: { type: String, required: true, trim: true, index: true },
    /** Required title (PM: Delivery Return Subject) */
    subject: { type: String, trim: true, default: '', index: true },
    returnDate: { type: Date, default: Date.now },
    customerId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    contactPersonId: { type: Schema.Types.ObjectId, ref: 'People', default: null },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    sourceType: {
      type: String,
      trim: true,
      default: DR_SOURCE_TYPES.DELIVERY_NOTE,
      enum: Object.values(DR_SOURCE_TYPES)
    },
    /** Primary/legacy single sources (optional when multi-source lines) */
    deliveryNoteId: {
      type: Schema.Types.ObjectId,
      ref: 'DeliveryNote',
      default: null,
      index: true
    },
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', default: null, index: true },
    salesOrderId: { type: Schema.Types.ObjectId, ref: 'SalesOrder', default: null, index: true },
    returnType: {
      type: String,
      trim: true,
      default: 'customer_return',
      enum: DR_RETURN_TYPES
    },
    returnReason: { type: String, default: null },
    customerReference: { type: String, trim: true, default: null },
    returnWarehouseId: { type: Schema.Types.ObjectId, ref: 'InventoryLocation', default: null },
    billingAddress: { type: Schema.Types.Mixed, default: null },
    shippingAddress: { type: Schema.Types.Mixed, default: null },
    email: { type: String, default: null },
    mobile: { type: String, default: null },
    currency: { type: String, default: 'USD' },
    status: { type: String, enum: DR_STATUS_VALUES, default: DR_STATUSES.DRAFT, index: true },
    /**
     * Status on which inventory is increased for good-condition lines.
     * PM: Received | Inspected | Restocked (default restocked).
     */
    inventoryPostStatus: {
      type: String,
      default: DR_STATUSES.RESTOCKED,
      enum: [DR_STATUSES.RECEIVED, DR_STATUSES.INSPECTED, DR_STATUSES.RESTOCKED]
    },
    /** Printed on Delivery Return (customer-facing) */
    customerNotes: { type: String, default: null },
    /** Internal users only */
    internalNotes: { type: String, default: null },
    /** @deprecated prefer customerNotes — kept for prior stub rows */
    notes: { type: String, default: null },
    subtotal: { type: Number, default: 0 },
    taxTotal: { type: Number, default: 0 },
    chargesTotal: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
    inventoryPostedAt: { type: Date, default: null },
    externalReferenceId: { type: String, default: null },
    syncStatus: { type: String, default: 'not_synced' },
    lastSyncAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    modifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedAt: { type: Date, default: null, index: true }
  },
  { timestamps: true }
);

DeliveryReturnSchema.index({ organizationId: 1, deliveryReturnNumber: 1 }, { unique: true });
DeliveryReturnSchema.index({ organizationId: 1, customerId: 1, status: 1 });

function getModel(name, schema) {
  if (mongoose.models[name]) return mongoose.models[name];
  return mongoose.model(name, schema);
}

module.exports = {
  DeliveryReturn: wrapTenantModel(getModel('DeliveryReturn', DeliveryReturnSchema)),
  DeliveryReturnLine: wrapTenantModel(getModel('DeliveryReturnLine', DeliveryReturnLineSchema)),
  DeliveryReturnLineSchema,
  DeliveryReturnSchema,
  DR_RETURN_TYPES
};
