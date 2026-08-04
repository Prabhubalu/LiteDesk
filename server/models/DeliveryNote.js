const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const {
  DN_STATUS_VALUES,
  DN_STATUSES,
  DN_SOURCE_TYPES,
  DN_DEFAULT_INVENTORY_POST_STATUS,
  DN_INVENTORY_POST_STATUSES
} = require('../constants/deliveryNoteLifecycle');

const DeliveryNoteLineSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    deliveryNoteId: {
      type: Schema.Types.ObjectId,
      ref: 'DeliveryNote',
      required: true,
      index: true
    },
    lineOrder: { type: Number, default: 1 },
    salesOrderId: { type: Schema.Types.ObjectId, ref: 'SalesOrder', default: null, index: true },
    salesOrderLineId: {
      type: Schema.Types.ObjectId,
      ref: 'SalesOrderLine',
      default: null,
      index: true
    },
    variantId: { type: Schema.Types.ObjectId, ref: 'ItemVariant', required: true, index: true },
    skuSnapshot: { type: String, default: null },
    itemNameSnapshot: { type: String, default: null },
    quantityOrdered: { type: Number, default: 0 },
    quantityPreviouslyDelivered: { type: Number, default: 0 },
    /** Ordered − previously delivered at materialization */
    quantityAvailable: { type: Number, default: 0 },
    quantityDelivered: { type: Number, required: true, min: 0 },
    /** Remaining after this DN line was booked */
    quantityPending: { type: Number, default: 0 },
    /** Cumulative customer returns against this delivered line */
    quantityReturned: { type: Number, default: 0, min: 0 },
    unitOfMeasure: { type: String, default: null },
    unitPrice: { type: Number, default: 0 },
    discountType: { type: String, default: null },
    discountValue: { type: Number, default: 0 },
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
    lineRemarks: { type: String, default: null }
  },
  { timestamps: true }
);

DeliveryNoteLineSchema.index({ organizationId: 1, deliveryNoteId: 1, lineOrder: 1 });
DeliveryNoteLineSchema.index(
  { organizationId: 1, deliveryNoteId: 1, salesOrderLineId: 1 },
  {
    unique: true,
    partialFilterExpression: { salesOrderLineId: { $type: 'objectId' } }
  }
);

const DeliveryNoteSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    deliveryNoteNumber: { type: String, required: true, trim: true, index: true },
    /** Required title (PM: Delivery Note Subject) */
    subject: { type: String, trim: true, default: '', index: true },
    deliveryDate: { type: Date, default: Date.now },
    customerId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    contactPersonId: { type: Schema.Types.ObjectId, ref: 'People', default: null },
    /** Delivery Owner — defaults to creator */
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    sourceType: {
      type: String,
      trim: true,
      default: DN_SOURCE_TYPES.DIRECT,
      enum: Object.values(DN_SOURCE_TYPES)
    },
    /** Primary / legacy single SO (first linked or sole) */
    salesOrderId: {
      type: Schema.Types.ObjectId,
      ref: 'SalesOrder',
      default: null,
      index: true
    },
    salesOrderIds: {
      type: [{ type: Schema.Types.ObjectId, ref: 'SalesOrder' }],
      default: []
    },
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', default: null, index: true },
    warehouseId: { type: Schema.Types.ObjectId, ref: 'InventoryLocation', default: null },
    deliveryMethod: { type: String, trim: true, default: null },
    carrier: { type: String, trim: true, default: null },
    trackingNumber: { type: String, trim: true, default: null },
    vehicleNumber: { type: String, trim: true, default: null },
    driverDetails: { type: String, default: null },
    dispatchDate: { type: Date, default: null },
    expectedDeliveryDate: { type: Date, default: null },
    deliveryInstructions: { type: String, default: null },
    /** @deprecated prefer shippingAddress */
    deliveryAddress: { type: Schema.Types.Mixed, default: null },
    /** @deprecated prefer contactPersonId */
    contactPerson: { type: String, default: null },
    billingAddress: { type: Schema.Types.Mixed, default: null },
    shippingAddress: { type: Schema.Types.Mixed, default: null },
    email: { type: String, default: null },
    mobile: { type: String, default: null },
    currency: { type: String, default: 'USD' },
    status: {
      type: String,
      enum: DN_STATUS_VALUES,
      default: DN_STATUSES.DRAFT,
      index: true
    },
    /**
     * Status on which inventory is deducted.
     * PM: Picked | Packed | Dispatched | Delivered (default dispatched).
     */
    inventoryPostStatus: {
      type: String,
      default: DN_DEFAULT_INVENTORY_POST_STATUS,
      enum: [...DN_INVENTORY_POST_STATUSES]
    },
    /** Printed on Delivery Note */
    customerNotes: { type: String, default: null },
    /** Internal users only */
    internalNotes: { type: String, default: null },
    /** @deprecated prefer customerNotes — kept for prior MVP rows */
    notes: { type: String, default: null },
    subtotal: { type: Number, default: 0 },
    taxTotal: { type: Number, default: 0 },
    chargesTotal: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
    inventoryPostedAt: { type: Date, default: null },
    fulfillmentEventId: { type: String, default: null },
    externalReferenceId: { type: String, default: null },
    syncStatus: { type: String, default: 'not_synced' },
    lastSyncAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    modifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedAt: { type: Date, default: null, index: true }
  },
  { timestamps: true }
);

DeliveryNoteSchema.index({ organizationId: 1, deliveryNoteNumber: 1 }, { unique: true });
DeliveryNoteSchema.index({ organizationId: 1, customerId: 1, status: 1 });

function getModel(name, schema) {
  if (mongoose.models[name]) return mongoose.models[name];
  return mongoose.model(name, schema);
}

module.exports = {
  DeliveryNote: wrapTenantModel(getModel('DeliveryNote', DeliveryNoteSchema)),
  DeliveryNoteLine: wrapTenantModel(getModel('DeliveryNoteLine', DeliveryNoteLineSchema)),
  DeliveryNoteSchema,
  DeliveryNoteLineSchema
};
