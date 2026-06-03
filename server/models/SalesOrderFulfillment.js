const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const { SALES_ORDER_FULFILLMENT_EVENT_TYPES } = require('../constants/salesOrderFulfillment');

const { Schema } = mongoose;

const FulfillmentLineDeltaSchema = new Schema(
  {
    salesOrderLineId: { type: String, required: true, trim: true },
    quantityDelta: { type: Number, default: 0 },
    priorQuantityFulfilled: { type: Number, default: 0 },
    newQuantityFulfilled: { type: Number, default: 0 },
    priorQuantityCancelled: { type: Number, default: 0 },
    newQuantityCancelled: { type: Number, default: 0 },
    priorQuantityBackordered: { type: Number, default: 0 },
    newQuantityBackordered: { type: Number, default: 0 }
  },
  { _id: false }
);

const SalesOrderFulfillmentSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    salesOrderId: {
      type: Schema.Types.ObjectId,
      ref: 'SalesOrder',
      required: true,
      index: true
    },
    salesOrderFulfillmentId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    fulfillmentType: {
      type: String,
      enum: SALES_ORDER_FULFILLMENT_EVENT_TYPES,
      required: true,
      index: true
    },
    status: {
      type: String,
      trim: true,
      default: 'posted',
      index: true
    },
    fulfilledAt: { type: Date, default: Date.now, index: true },
    fulfilledBy: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    lines: { type: [FulfillmentLineDeltaSchema], default: [] },
    carrier: { type: String, trim: true, default: null },
    trackingNumber: { type: String, trim: true, default: null },
    warehouseId: { type: String, trim: true, default: null },
    externalRef: { type: String, trim: true, default: null },
    note: { type: String, trim: true, maxlength: 500, default: null },
    reversedByFulfillmentId: {
      type: Schema.Types.ObjectId,
      ref: 'SalesOrderFulfillment',
      default: null,
      index: true
    },
    reversesFulfillmentId: {
      type: String,
      trim: true,
      default: null,
      index: true
    }
  },
  { timestamps: true }
);

SalesOrderFulfillmentSchema.index({ organizationId: 1, salesOrderId: 1, createdAt: -1 });

SalesOrderFulfillmentSchema.pre('validate', function ensureFulfillmentId(next) {
  if (this.salesOrderFulfillmentId) return next();
  const s = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  this.salesOrderFulfillmentId = `${s()}${s()}-${s()}-${s()}-${s()}-${s()}${s()}${s()}`;
  return next();
});

module.exports = wrapTenantModel(mongoose.model('SalesOrderFulfillment', SalesOrderFulfillmentSchema));
