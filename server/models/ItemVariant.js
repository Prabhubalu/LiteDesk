const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { CATALOG_LIFECYCLE_STATES, CATALOG_LIFECYCLE_DEFAULT } = require('../constants/catalogLifecycle');
const { CATALOG_BARCODE_TYPES } = require('../constants/catalogBarcode');
const {
  CATALOG_BUNDLE_PRICING_MODES,
  CATALOG_BUNDLE_PRICING_DEFAULT,
  CATALOG_BUNDLE_TYPES,
  CATALOG_BUNDLE_TYPE_DEFAULT,
  CATALOG_BUNDLE_DISCOUNT_TYPES
} = require('../constants/catalogBundle');
const { INVENTORY_TRACKING_MODES } = require('../constants/inventoryLifecycle');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const ItemVariantSchema = new Schema({
  organizationId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  itemId: {
    type: Schema.Types.ObjectId,
    ref: 'Item',
    required: true,
    index: true
  },
  variant_code: {
    type: String,
    trim: true,
    index: true
  },
  barcode: {
    type: String,
    trim: true,
    index: true
  },
  barcode_type: {
    type: String,
    enum: CATALOG_BARCODE_TYPES,
    default: 'OTHER'
  },
  qr_payload: {
    type: String,
    trim: true
  },
  is_default: {
    type: Boolean,
    default: false,
    index: true
  },
  lifecycle_state: {
    type: String,
    enum: CATALOG_LIFECYCLE_STATES,
    default: CATALOG_LIFECYCLE_DEFAULT,
    index: true
  },
  unit_of_measure: {
    type: String,
    trim: true
  },
  selling_price: {
    type: Number,
    min: 0,
    default: 0
  },
  cost_price: {
    type: Number,
    min: 0,
    default: 0
  },
  currency: {
    type: String,
    default: 'USD',
    trim: true
  },
  tax_type: {
    type: String,
    enum: ['GST', 'VAT', 'None'],
    default: 'None'
  },
  tax_percentage: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  /** India GST (GTM-1) — HSN/SAC code */
  hsnSac: {
    type: String,
    trim: true
  },
  gstTaxability: {
    type: String,
    enum: ['taxable', 'exempt', 'nil_rated', 'non_gst', 'zero_rated'],
    trim: true
  },
  gstRatePercent: {
    type: Number,
    min: 0,
    max: 100
  },
  commission_rate: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  pricingMode: {
    type: String,
    enum: CATALOG_BUNDLE_PRICING_MODES,
    default: CATALOG_BUNDLE_PRICING_DEFAULT
  },
  /** fixed = sealed package; flexible = optional components configurable at sale time */
  bundleType: {
    type: String,
    enum: CATALOG_BUNDLE_TYPES,
    default: CATALOG_BUNDLE_TYPE_DEFAULT
  },
  /** Applied when pricingMode === 'discount' */
  bundleDiscountType: {
    type: String,
    enum: [...CATALOG_BUNDLE_DISCOUNT_TYPES, null],
    default: null
  },
  bundleDiscountValue: {
    type: Number,
    min: 0,
    default: null
  },
  /** Flexible: min/max count of optional components selected at configure time */
  minOptionalSelection: {
    type: Number,
    min: 0,
    default: null
  },
  maxOptionalSelection: {
    type: Number,
    min: 0,
    default: null
  },
  bundleEffectiveFrom: {
    type: Date,
    default: null
  },
  bundleEffectiveUntil: {
    type: Date,
    default: null
  },
  /** Monotonic revision — incremented on each component/rule save (lightweight versioning) */
  bundleRevision: {
    type: Number,
    min: 1,
    default: 1
  },
  /** INV4 — null inherits org defaultTrackingMode */
  inventoryTrackingMode: {
    type: String,
    enum: [...INVENTORY_TRACKING_MODES, null],
    default: null
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  modifiedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  itemGroupId: {
    type: Schema.Types.ObjectId,
    ref: 'ItemGroup',
    default: null,
    index: true
  },
  attributeValues: {
    type: Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

ItemVariantSchema.index({ organizationId: 1, itemId: 1, is_default: 1 });
ItemVariantSchema.index(
  { organizationId: 1, itemId: 1 },
  { unique: true, partialFilterExpression: { is_default: true } }
);
ItemVariantSchema.index(
  { organizationId: 1, barcode: 1 },
  { unique: true, sparse: true, partialFilterExpression: { barcode: { $type: 'string', $ne: '' } } }
);
ItemVariantSchema.index(
  { organizationId: 1, variant_code: 1 },
  { unique: true, sparse: true, partialFilterExpression: { variant_code: { $type: 'string', $ne: '' } } }
);

module.exports = wrapTenantModel(mongoose.model('ItemVariant', ItemVariantSchema));
