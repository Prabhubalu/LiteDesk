const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const { Schema } = mongoose;

const QUOTE_LINE_TYPES = [
  'standard',
  'bundle_parent',
  'bundle_component',
  'adjustment'
];

const QuoteLineSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },

    quoteId: {
      type: Schema.Types.ObjectId,
      ref: 'Quote',
      required: true,
      index: true
    },

    quoteLineId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true
    },

    variantId: {
      type: Schema.Types.ObjectId,
      ref: 'ItemVariant',
      required: true,
      index: true
    },

    parentBundleLineId: {
      type: Schema.Types.ObjectId,
      ref: 'QuoteLine',
      default: null,
      index: true
    },

    lineType: {
      type: String,
      enum: QUOTE_LINE_TYPES,
      default: 'standard',
      index: true
    },

    lineOrder: { type: Number, default: 0 },

    quoteSectionId: {
      type: Schema.Types.ObjectId,
      ref: 'QuoteSection',
      default: null,
      index: true
    },

    /** @deprecated Use quoteSectionId — kept for migration reads only */
    lineGroupKey: { type: String, trim: true, default: null, index: true },

    quantity: { type: Number, default: 1, min: 0 },
    unitOfMeasure: { type: String, trim: true, default: null },

    // Pricing snapshots
    unitPriceSnapshot: { type: Number, default: 0 },
    listPriceSnapshot: { type: Number, default: 0 },
    pricingSourceSnapshot: { type: String, trim: true, default: null, index: true }, // 'price_book' | 'variant_fallback'
    priceBookIdSnapshot: { type: Schema.Types.ObjectId, ref: 'CatalogPriceBook', default: null, index: true },
    priceBookNameSnapshot: { type: String, trim: true, default: null },
    priceBookEntryIdSnapshot: { type: Schema.Types.ObjectId, ref: 'CatalogPriceBookEntry', default: null, index: true },
    pricingAsOfDateSnapshot: { type: Date, default: null, index: true },
    pricingEffectiveFromSnapshot: { type: Date, default: null },
    pricingEffectiveToSnapshot: { type: Date, default: null },
    pricingMinQtySnapshot: { type: Number, default: null, min: 0 },
    discountType: { type: String, trim: true, default: null },
    discountValue: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },

    taxSnapshot: { type: Schema.Types.Mixed, default: {} },
    chargeSnapshot: { type: Schema.Types.Mixed, default: { charges: [] } },

    lineSubtotal: { type: Number, default: 0 },
    lineTaxTotal: { type: Number, default: 0 },
    lineTotal: { type: Number, default: 0 },

    currencySnapshot: { type: String, trim: true, default: 'USD' },
    exchangeRateSnapshot: { type: Number, default: 1 },

    // Identity snapshots (do not depend on live catalog after save)
    skuSnapshot: { type: String, trim: true, default: null },
    itemNameSnapshot: { type: String, trim: true, default: null },
    descriptionSnapshot: { type: String, default: null },
    attributesSnapshot: { type: Schema.Types.Mixed, default: {} },
    bundleSnapshot: { type: Schema.Types.Mixed, default: {} },

    optionalLine: { type: Boolean, default: false, index: true },
    hiddenLine: { type: Boolean, default: false, index: true },
    lockedSnapshot: { type: Boolean, default: false, index: true }
  },
  { timestamps: true }
);

QuoteLineSchema.index({ organizationId: 1, quoteId: 1, lineOrder: 1 });

QuoteLineSchema.pre('validate', function ensureQuoteLineId(next) {
  if (this.quoteLineId) return next();
  // UUIDv4-ish without dependency; good enough for stable identity.
  // If we later standardize IDs, migrate safely.
  const s = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  this.quoteLineId = `${s()}${s()}-${s()}-${s()}-${s()}-${s()}${s()}${s()}`;
  return next();
});

module.exports = wrapTenantModel(mongoose.model('QuoteLine', QuoteLineSchema));

