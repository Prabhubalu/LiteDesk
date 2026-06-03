const mongoose = require('mongoose');
const crypto = require('crypto');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const {
  INVENTORY_RESERVATION_STATUSES,
  INVENTORY_RESERVATION_STATUS_DEFAULT,
  INVENTORY_RESERVATION_SOURCE_CONTEXTS
} = require('../constants/inventoryLifecycle');

const { Schema } = mongoose;

const InventoryReservationSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },

    inventoryReservationId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },

    variantId: {
      type: Schema.Types.ObjectId,
      ref: 'ItemVariant',
      required: true,
      index: true
    },
    inventoryLocationId: { type: String, required: true, trim: true, index: true },

    quantity: { type: Number, required: true, min: 0 },
    quantityConsumed: { type: Number, default: 0, min: 0 },
    unitOfMeasure: { type: String, trim: true, default: null },

    status: {
      type: String,
      enum: INVENTORY_RESERVATION_STATUSES,
      default: INVENTORY_RESERVATION_STATUS_DEFAULT,
      index: true
    },

    salesOrderId: {
      type: Schema.Types.ObjectId,
      ref: 'SalesOrder',
      required: true,
      index: true
    },
    salesOrderLineId: { type: String, required: true, trim: true, index: true },

    sourceContext: {
      type: String,
      enum: INVENTORY_RESERVATION_SOURCE_CONTEXTS,
      default: 'so_confirm',
      index: true
    },
    sourceRef: {
      moduleKey: { type: String, trim: true, default: null },
      recordId: { type: String, trim: true, default: null },
      lineId: { type: String, trim: true, default: null }
    },

    reservedAt: { type: Date, default: Date.now, index: true },
    expiresAt: { type: Date, default: null },

    consumedByLedgerEntryIds: { type: [String], default: [] },
    releasedAt: { type: Date, default: null },
    releasedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    releaseReason: { type: String, trim: true, default: null }
  },
  { timestamps: true }
);

InventoryReservationSchema.index(
  { organizationId: 1, salesOrderLineId: 1, variantId: 1, inventoryLocationId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['active', 'partially_consumed'] } }
  }
);
InventoryReservationSchema.index({ organizationId: 1, salesOrderId: 1, status: 1 });
InventoryReservationSchema.index({ organizationId: 1, variantId: 1, inventoryLocationId: 1, status: 1 });

InventoryReservationSchema.pre('validate', function assignReservationId(next) {
  if (!this.inventoryReservationId) {
    this.inventoryReservationId = crypto.randomUUID();
  }
  next();
});

module.exports = wrapTenantModel(mongoose.model('InventoryReservation', InventoryReservationSchema));
