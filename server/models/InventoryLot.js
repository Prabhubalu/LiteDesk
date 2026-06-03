const mongoose = require('mongoose');
const crypto = require('crypto');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const {
  INVENTORY_LOT_STATUSES,
  INVENTORY_LOT_STATUS_DEFAULT
} = require('../constants/inventoryLifecycle');

const { Schema } = mongoose;

const InventoryLotSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },

    inventoryLotId: {
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

    lotNumber: { type: String, required: true, trim: true, index: true },
    manufacturedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null, index: true },

    status: {
      type: String,
      enum: INVENTORY_LOT_STATUSES,
      default: INVENTORY_LOT_STATUS_DEFAULT,
      index: true
    },

    notes: { type: String, trim: true, maxlength: 500, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

InventoryLotSchema.index({ organizationId: 1, variantId: 1, lotNumber: 1 }, { unique: true });

InventoryLotSchema.pre('validate', function assignLotId(next) {
  if (!this.inventoryLotId) {
    this.inventoryLotId = crypto.randomUUID();
  }
  next();
});

module.exports = wrapTenantModel(mongoose.model('InventoryLot', InventoryLotSchema));
