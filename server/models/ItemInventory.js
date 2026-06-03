const mongoose = require('mongoose');
const crypto = require('crypto');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const { Schema } = mongoose;

const ItemInventorySchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },

    itemInventoryId: {
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
    itemId: { type: Schema.Types.ObjectId, ref: 'Item', default: null, index: true },
    inventoryLocationId: { type: String, required: true, trim: true, index: true },

    onHand: { type: Number, default: 0 },
    reserved: { type: Number, default: 0 },
    incoming: { type: Number, default: 0 },
    safetyStock: { type: Number, default: 0 },
    available: { type: Number, default: 0 },

    unitOfMeasure: { type: String, trim: true, default: null },
    lastLedgerEntryAt: { type: Date, default: null },
    lastCountedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

ItemInventorySchema.index({ organizationId: 1, variantId: 1, inventoryLocationId: 1 }, { unique: true });

ItemInventorySchema.pre('validate', function assignItemInventoryId(next) {
  if (!this.itemInventoryId) {
    this.itemInventoryId = crypto.randomUUID();
  }
  next();
});

module.exports = wrapTenantModel(mongoose.model('ItemInventory', ItemInventorySchema));
