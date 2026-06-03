const mongoose = require('mongoose');
const crypto = require('crypto');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const {
  INVENTORY_COUNT_STATUSES,
  INVENTORY_COUNT_STATUS_DEFAULT
} = require('../constants/inventoryLifecycle');

const { Schema } = mongoose;

const InventoryCountLineSchema = new Schema(
  {
    inventoryCountLineId: { type: String, required: true, trim: true },
    variantId: { type: Schema.Types.ObjectId, ref: 'ItemVariant', required: true },
    systemQty: { type: Number, default: 0 },
    countedQty: { type: Number, default: null },
    varianceQty: { type: Number, default: 0 },
    unitCostSnapshot: { type: Number, default: 0 },
    notes: { type: String, trim: true, maxlength: 500, default: null }
  },
  { _id: false }
);

const InventoryCountSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },

    inventoryCountId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },

    inventoryLocationId: { type: String, required: true, trim: true, index: true },
    sessionTitle: { type: String, trim: true, default: null },

    status: {
      type: String,
      enum: INVENTORY_COUNT_STATUSES,
      default: INVENTORY_COUNT_STATUS_DEFAULT,
      index: true
    },

    lines: { type: [InventoryCountLineSchema], default: [] },
    inventoryTransactionId: { type: String, trim: true, default: null, index: true },

    countingStartedAt: { type: Date, default: null },
    countedAt: { type: Date, default: null },
    postedAt: { type: Date, default: null },
    postedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    notes: { type: String, trim: true, maxlength: 2000, default: null },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

InventoryCountSchema.index({ organizationId: 1, inventoryLocationId: 1, createdAt: -1 });

InventoryCountSchema.pre('validate', function assignCountIds(next) {
  if (!this.inventoryCountId) {
    this.inventoryCountId = crypto.randomUUID();
  }
  for (const line of this.lines || []) {
    if (!line.inventoryCountLineId) {
      line.inventoryCountLineId = crypto.randomUUID();
    }
  }
  next();
});

module.exports = wrapTenantModel(mongoose.model('InventoryCount', InventoryCountSchema));
