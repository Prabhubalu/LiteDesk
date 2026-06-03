const mongoose = require('mongoose');
const crypto = require('crypto');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const {
  INVENTORY_LEDGER_ENTRY_TYPES,
  INVENTORY_LEDGER_ENTRY_STATUSES,
  INVENTORY_LEDGER_STATUS_DEFAULT
} = require('../constants/inventoryLifecycle');

const { Schema } = mongoose;

const InventoryLedgerEntrySchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },

    inventoryLedgerEntryId: {
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

    quantityDelta: { type: Number, required: true },
    unitOfMeasure: { type: String, trim: true, default: null },

    inventoryTransactionId: { type: String, required: true, trim: true, index: true },
    entryType: { type: String, enum: INVENTORY_LEDGER_ENTRY_TYPES, required: true, index: true },

    unitCostSnapshot: { type: Number, default: 0 },
    extendedCost: { type: Number, default: 0 },
    valuationMethod: { type: String, trim: true, default: 'standard' },
    costSource: { type: String, trim: true, default: 'catalog_cost' },

    lotId: { type: String, trim: true, default: null },
    serialNumbers: { type: [String], default: [] },

    sourceContext: { type: String, trim: true, default: 'manual', index: true },
    sourceRef: {
      moduleKey: { type: String, trim: true, default: null },
      recordId: { type: String, trim: true, default: null },
      lineId: { type: String, trim: true, default: null }
    },

    status: {
      type: String,
      enum: INVENTORY_LEDGER_ENTRY_STATUSES,
      default: INVENTORY_LEDGER_STATUS_DEFAULT,
      index: true
    },
    reversesEntryId: { type: String, trim: true, default: null, index: true },
    reversedByEntryId: { type: String, trim: true, default: null },

    postedAt: { type: Date, default: Date.now, index: true },
    postedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    notes: { type: String, trim: true, maxlength: 2000, default: null }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

InventoryLedgerEntrySchema.index({ organizationId: 1, variantId: 1, inventoryLocationId: 1, postedAt: -1 });
InventoryLedgerEntrySchema.index({ organizationId: 1, inventoryTransactionId: 1 });
InventoryLedgerEntrySchema.index(
  {
    organizationId: 1,
    'sourceRef.moduleKey': 1,
    'sourceRef.recordId': 1,
    entryType: 1,
    variantId: 1,
    inventoryLocationId: 1
  },
  { unique: true, partialFilterExpression: { 'sourceRef.recordId': { $type: 'string', $ne: '' } } }
);

InventoryLedgerEntrySchema.pre('validate', function assignLedgerEntryId(next) {
  if (!this.inventoryLedgerEntryId) {
    this.inventoryLedgerEntryId = crypto.randomUUID();
  }
  next();
});

module.exports = wrapTenantModel(mongoose.model('InventoryLedgerEntry', InventoryLedgerEntrySchema));
