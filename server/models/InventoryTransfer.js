const mongoose = require('mongoose');
const crypto = require('crypto');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const {
  INVENTORY_TRANSFER_STATUSES,
  INVENTORY_TRANSFER_STATUS_DEFAULT
} = require('../constants/inventoryLifecycle');

const { Schema } = mongoose;

const InventoryTransferLineSchema = new Schema(
  {
    inventoryTransferLineId: { type: String, required: true, trim: true },
    variantId: { type: Schema.Types.ObjectId, ref: 'ItemVariant', required: true },
    quantity: { type: Number, required: true, min: 0 },
    unitCostSnapshot: { type: Number, default: 0 },
    notes: { type: String, trim: true, maxlength: 500, default: null }
  },
  { _id: false }
);

const InventoryTransferSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },

    inventoryTransferId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },

    fromLocationId: { type: String, required: true, trim: true, index: true },
    toLocationId: { type: String, required: true, trim: true, index: true },

    status: {
      type: String,
      enum: INVENTORY_TRANSFER_STATUSES,
      default: INVENTORY_TRANSFER_STATUS_DEFAULT,
      index: true
    },

    lines: { type: [InventoryTransferLineSchema], default: [] },
    inventoryTransactionId: { type: String, trim: true, default: null, index: true },

    shippedAt: { type: Date, default: null },
    receivedAt: { type: Date, default: null },
    postedAt: { type: Date, default: null },
    postedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    notes: { type: String, trim: true, maxlength: 2000, default: null },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

InventoryTransferSchema.index({ organizationId: 1, createdAt: -1 });

InventoryTransferSchema.pre('validate', function assignTransferIds(next) {
  if (!this.inventoryTransferId) {
    this.inventoryTransferId = crypto.randomUUID();
  }
  for (const line of this.lines || []) {
    if (!line.inventoryTransferLineId) {
      line.inventoryTransferLineId = crypto.randomUUID();
    }
  }
  next();
});

module.exports = wrapTenantModel(mongoose.model('InventoryTransfer', InventoryTransferSchema));
