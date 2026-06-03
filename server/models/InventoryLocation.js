const mongoose = require('mongoose');
const crypto = require('crypto');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const {
  INVENTORY_LOCATION_TYPES,
  INVENTORY_LOCATION_STATUSES,
  INVENTORY_LOCATION_STATUS_DEFAULT,
  DEFAULT_MAIN_WAREHOUSE_CODE
} = require('../constants/inventoryLifecycle');

const { Schema } = mongoose;

const InventoryLocationSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },

    inventoryLocationId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },

    locationCode: { type: String, required: true, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    locationType: {
      type: String,
      enum: INVENTORY_LOCATION_TYPES,
      default: 'warehouse',
      index: true
    },
    status: {
      type: String,
      enum: INVENTORY_LOCATION_STATUSES,
      default: INVENTORY_LOCATION_STATUS_DEFAULT,
      index: true
    },

    parentLocationId: { type: String, trim: true, default: null, index: true },
    isDefault: { type: Boolean, default: false, index: true },
    allowNegative: { type: Boolean, default: false },

    addressSnapshot: { type: Schema.Types.Mixed, default: null },
    externalRef: { type: String, trim: true, default: null },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    modifiedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

InventoryLocationSchema.index({ organizationId: 1, locationCode: 1 }, { unique: true });
InventoryLocationSchema.index(
  { organizationId: 1, isDefault: 1 },
  { unique: true, partialFilterExpression: { isDefault: true } }
);

InventoryLocationSchema.pre('validate', function assignLocationId(next) {
  if (!this.inventoryLocationId) {
    this.inventoryLocationId = crypto.randomUUID();
  }
  if (this.isDefault == null && this.locationCode === DEFAULT_MAIN_WAREHOUSE_CODE) {
    this.isDefault = true;
  }
  next();
});

module.exports = wrapTenantModel(mongoose.model('InventoryLocation', InventoryLocationSchema));
