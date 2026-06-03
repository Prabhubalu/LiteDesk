const mongoose = require('mongoose');
const crypto = require('crypto');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const {
  INVENTORY_ADJUSTMENT_STATUSES,
  INVENTORY_ADJUSTMENT_STATUS_DEFAULT,
  INVENTORY_ADJUSTMENT_REASONS
} = require('../constants/inventoryLifecycle');

const { Schema } = mongoose;

const InventoryAdjustmentLineSchema = new Schema(
  {
    variantId: { type: Schema.Types.ObjectId, ref: 'ItemVariant', required: true },
    quantityDelta: { type: Number, required: true },
    unitCostSnapshot: { type: Number, default: 0 },
    notes: { type: String, trim: true, maxlength: 500, default: null }
  },
  { _id: false }
);

const InventoryAdjustmentSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },

    inventoryAdjustmentId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },

    inventoryLocationId: { type: String, required: true, trim: true, index: true },
    reasonCode: {
      type: String,
      enum: INVENTORY_ADJUSTMENT_REASONS,
      default: 'correction',
      index: true
    },
    status: {
      type: String,
      enum: INVENTORY_ADJUSTMENT_STATUSES,
      default: INVENTORY_ADJUSTMENT_STATUS_DEFAULT,
      index: true
    },

    lines: { type: [InventoryAdjustmentLineSchema], default: [] },
    inventoryTransactionId: { type: String, trim: true, default: null, index: true },

    postedAt: { type: Date, default: null },
    postedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    notes: { type: String, trim: true, maxlength: 2000, default: null },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

InventoryAdjustmentSchema.index({ organizationId: 1, createdAt: -1 });

InventoryAdjustmentSchema.pre('validate', function assignAdjustmentId(next) {
  if (!this.inventoryAdjustmentId) {
    this.inventoryAdjustmentId = crypto.randomUUID();
  }
  next();
});

module.exports = wrapTenantModel(mongoose.model('InventoryAdjustment', InventoryAdjustmentSchema));
