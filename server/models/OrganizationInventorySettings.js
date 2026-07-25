const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const {
  INVENTORY_TRACKING_MODES,
  INVENTORY_TRACKING_MODE_DEFAULT,
  INVENTORY_VALUATION_METHODS,
  INVENTORY_VALUATION_METHOD_DEFAULT
} = require('../constants/inventoryLifecycle');

const { Schema } = mongoose;

const OrganizationInventorySettingsSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      unique: true,
      index: true
    },

    allowNegativeInventory: { type: Boolean, default: false },
    blockConfirmOnInsufficientStock: { type: Boolean, default: false },
    /** INV3 — off | warn | block for quote/SO line add + qty increase */
    atpLineAddPolicy: {
      type: String,
      enum: ['off', 'warn', 'block'],
      default: 'off',
      index: true
    },
    /** INV3 — off | warn | block for portal quote accept */
    atpQuoteAcceptPolicy: {
      type: String,
      enum: ['off', 'warn', 'block'],
      default: 'off',
      index: true
    },
    defaultInventoryLocationId: { type: String, trim: true, default: null },

    /** INV4 — org-default tracking + valuation */
    defaultTrackingMode: {
      type: String,
      enum: INVENTORY_TRACKING_MODES,
      default: INVENTORY_TRACKING_MODE_DEFAULT
    },
    defaultValuationMethod: {
      type: String,
      enum: INVENTORY_VALUATION_METHODS,
      default: INVENTORY_VALUATION_METHOD_DEFAULT
    },
    /** When true, ATP adds ItemInventory.incoming (procurement stub) */
    includeIncomingInAtp: { type: Boolean, default: false },

    /** Stockroom add-on activation marker (idempotent) */
    stockroomAddonActivatedAt: { type: Date, default: null },

    /** Configurable reason lists */
    adjustmentReasons: {
      type: [String],
      default: [
        'Physical Stock Count',
        'Damaged Goods',
        'Expired Goods',
        'Lost Inventory',
        'Theft',
        'Internal Consumption',
        'Sample Distribution',
        'Opening Stock Correction',
        'Data Correction',
        'System Error Correction',
        'Other'
      ]
    },
    transferReasons: {
      type: [String],
      default: [
        'Branch Replenishment',
        'Warehouse Balancing',
        'Store Replenishment',
        'Production Requirement',
        'Customer Demand',
        'Overstock Redistribution',
        'Warehouse Consolidation',
        'Internal Request',
        'Temporary Storage',
        'Other'
      ]
    }
  },
  { timestamps: true }
);

module.exports = wrapTenantModel(
  mongoose.model('OrganizationInventorySettings', OrganizationInventorySettingsSchema)
);
