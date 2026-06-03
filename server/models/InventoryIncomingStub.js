const mongoose = require('mongoose');
const crypto = require('crypto');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const {
  INVENTORY_INCOMING_STUB_STATUSES,
  INVENTORY_INCOMING_STUB_STATUS_DEFAULT
} = require('../constants/inventoryLifecycle');

const { Schema } = mongoose;

const InventoryIncomingStubSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },

    inventoryIncomingStubId: {
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
    status: {
      type: String,
      enum: INVENTORY_INCOMING_STUB_STATUSES,
      default: INVENTORY_INCOMING_STUB_STATUS_DEFAULT,
      index: true
    },

    expectedAt: { type: Date, default: null },
    notes: { type: String, trim: true, maxlength: 500, default: null },

    sourceRef: {
      moduleKey: { type: String, trim: true, default: 'purchase_orders' },
      recordId: { type: String, trim: true, default: null },
      lineId: { type: String, trim: true, default: null }
    },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

InventoryIncomingStubSchema.index({ organizationId: 1, variantId: 1, inventoryLocationId: 1, status: 1 });

InventoryIncomingStubSchema.pre('validate', function assignStubId(next) {
  if (!this.inventoryIncomingStubId) {
    this.inventoryIncomingStubId = crypto.randomUUID();
  }
  next();
});

module.exports = wrapTenantModel(mongoose.model('InventoryIncomingStub', InventoryIncomingStubSchema));
