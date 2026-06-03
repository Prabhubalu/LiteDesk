const mongoose = require('mongoose');
const crypto = require('crypto');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const {
  INVENTORY_SERIAL_STATUSES,
  INVENTORY_SERIAL_STATUS_DEFAULT
} = require('../constants/inventoryLifecycle');

const { Schema } = mongoose;

const InventorySerialSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },

    inventorySerialId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },

    serialNumber: { type: String, required: true, trim: true, index: true },
    variantId: {
      type: Schema.Types.ObjectId,
      ref: 'ItemVariant',
      required: true,
      index: true
    },
    inventoryLocationId: { type: String, required: true, trim: true, index: true },
    inventoryLotId: { type: String, trim: true, default: null, index: true },

    status: {
      type: String,
      enum: INVENTORY_SERIAL_STATUSES,
      default: INVENTORY_SERIAL_STATUS_DEFAULT,
      index: true
    },

    receivedLedgerEntryId: { type: String, trim: true, default: null },
    consumedLedgerEntryId: { type: String, trim: true, default: null },

    sourceRef: {
      moduleKey: { type: String, trim: true, default: null },
      recordId: { type: String, trim: true, default: null },
      lineId: { type: String, trim: true, default: null }
    }
  },
  { timestamps: true }
);

InventorySerialSchema.index({ organizationId: 1, variantId: 1, serialNumber: 1 }, { unique: true });
InventorySerialSchema.index({ organizationId: 1, status: 1, variantId: 1, inventoryLocationId: 1 });

InventorySerialSchema.pre('validate', function assignSerialId(next) {
  if (!this.inventorySerialId) {
    this.inventorySerialId = crypto.randomUUID();
  }
  next();
});

module.exports = wrapTenantModel(mongoose.model('InventorySerial', InventorySerialSchema));
