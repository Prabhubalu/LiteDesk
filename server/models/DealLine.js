const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const { DEAL_LINE_TYPES, DEFAULT_DEAL_LINE_TYPE } = require('../constants/dealLineTypes');
const { CURRENT_DEAL_PRICING_VERSION } = require('../constants/dealPricingVersion');

const { Schema } = mongoose;

function generateDealLineId() {
  const s = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  return `${s()}${s()}-${s()}-${s()}-${s()}-${s()}${s()}${s()}`;
}

/**
 * DealLine — expected commercial intent under the Deal aggregate.
 * Snapshots mutable catalog/pricing values; never re-read live Item for historical totals.
 * Optional itemId/variantId — non-product lines (service/fee/misc) are first-class.
 */
const DealLineSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },

    dealId: {
      type: Schema.Types.ObjectId,
      ref: 'Deal',
      required: true,
      index: true
    },

    dealLineId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true
    },

    lineType: {
      type: String,
      enum: DEAL_LINE_TYPES,
      default: DEFAULT_DEAL_LINE_TYPE,
      index: true
    },

    lineOrder: { type: Number, default: 0 },

    /** Optional catalog references — not required for fee/misc/service lines */
    itemId: {
      type: Schema.Types.ObjectId,
      ref: 'Item',
      default: null,
      index: true
    },
    variantId: {
      type: Schema.Types.ObjectId,
      ref: 'ItemVariant',
      default: null,
      index: true
    },

    quantity: { type: Number, default: 1, min: 0 },

    // Identity / UoM snapshots (immutable after write for historical deals)
    skuSnapshot: { type: String, trim: true, default: null },
    nameSnapshot: { type: String, trim: true, default: null },
    descriptionSnapshot: { type: String, default: null },
    unitOfMeasureSnapshot: { type: String, trim: true, default: null },

    // Pricing snapshots
    expectedUnitPrice: { type: Number, default: 0 },
    listPriceSnapshot: { type: Number, default: 0 },
    pricingSourceSnapshot: { type: String, trim: true, default: null },
    priceBookIdSnapshot: { type: Schema.Types.ObjectId, ref: 'CatalogPriceBook', default: null },
    priceBookNameSnapshot: { type: String, trim: true, default: null },
    priceBookEntryIdSnapshot: { type: Schema.Types.ObjectId, ref: 'CatalogPriceBookEntry', default: null },
    pricingAsOfDateSnapshot: { type: Date, default: null },

    discountType: { type: String, trim: true, default: null },
    discountValue: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },

    taxSnapshot: { type: Schema.Types.Mixed, default: {} },

    lineSubtotal: { type: Number, default: 0 },
    lineTaxTotal: { type: Number, default: 0 },
    lineTotal: { type: Number, default: 0 },

    currencySnapshot: { type: String, trim: true, default: 'USD' },
    exchangeRateSnapshot: { type: Number, default: 1 },

    pricingVersion: {
      type: Number,
      default: CURRENT_DEAL_PRICING_VERSION,
      min: 1
    },

    // Aggregate trash — soft-delete / restore with parent Deal
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    modifiedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

DealLineSchema.index({ organizationId: 1, dealId: 1, deletedAt: 1, lineOrder: 1 });
DealLineSchema.index({ organizationId: 1, dealId: 1, dealLineId: 1 });

DealLineSchema.pre('validate', function ensureDealLineId(next) {
  if (this.dealLineId) return next();
  this.dealLineId = generateDealLineId();
  return next();
});

module.exports = wrapTenantModel(mongoose.model('DealLine', DealLineSchema));
module.exports.generateDealLineId = generateDealLineId;
