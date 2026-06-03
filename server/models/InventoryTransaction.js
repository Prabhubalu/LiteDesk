const mongoose = require('mongoose');
const crypto = require('crypto');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const {
  INVENTORY_TRANSACTION_TYPES_ALL,
  INVENTORY_TRANSACTION_STATUSES,
  INVENTORY_TRANSACTION_STATUS_DEFAULT
} = require('../constants/inventoryLifecycle');

const { Schema } = mongoose;

const InventoryTransactionLineSchema = new Schema(
  {
    variantId: { type: Schema.Types.ObjectId, ref: 'ItemVariant', required: true },
    quantity: { type: Number, required: true },
    inventoryLedgerEntryId: { type: String, trim: true, default: null },
    unitCostSnapshot: { type: Number, default: 0 }
  },
  { _id: false }
);

const InventoryTransactionSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },

    inventoryTransactionId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },

    transactionType: {
      type: String,
      enum: INVENTORY_TRANSACTION_TYPES_ALL,
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: INVENTORY_TRANSACTION_STATUSES,
      default: INVENTORY_TRANSACTION_STATUS_DEFAULT,
      index: true
    },

    inventoryLocationId: { type: String, required: true, trim: true, index: true },
    inventoryLocationIdTo: { type: String, trim: true, default: null },

    lines: { type: [InventoryTransactionLineSchema], default: [] },

    sourceContext: { type: String, trim: true, default: null, index: true },
    sourceRef: {
      moduleKey: { type: String, trim: true, default: null },
      recordId: { type: String, trim: true, default: null },
      lineId: { type: String, trim: true, default: null }
    },

    postedAt: { type: Date, default: null, index: true },
    postedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    failureCode: { type: String, trim: true, default: null },
    failureMessage: { type: String, trim: true, default: null },
    notes: { type: String, trim: true, maxlength: 2000, default: null }
  },
  { timestamps: true }
);

InventoryTransactionSchema.index({ organizationId: 1, createdAt: -1 });

InventoryTransactionSchema.pre('validate', function assignTransactionId(next) {
  if (!this.inventoryTransactionId) {
    this.inventoryTransactionId = crypto.randomUUID();
  }
  next();
});

module.exports = wrapTenantModel(mongoose.model('InventoryTransaction', InventoryTransactionSchema));
