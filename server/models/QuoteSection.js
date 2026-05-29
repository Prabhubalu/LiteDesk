const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const { QUOTE_SECTION_TYPES, QUOTE_SECTION_TYPE_DEFAULT } = require('../constants/quoteSection');

const { Schema } = mongoose;

const QuoteSectionSchema = new Schema(
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

    quoteSectionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true
    },

    sectionTitle: { type: String, required: true, trim: true },
    sectionDescription: { type: String, default: null },
    sectionOrder: { type: Number, default: 0, index: true },

    sectionType: {
      type: String,
      enum: QUOTE_SECTION_TYPES,
      default: QUOTE_SECTION_TYPE_DEFAULT,
      index: true
    },

    includeInQuoteTotal: { type: Boolean, default: true, index: true },

    parentSectionId: {
      type: Schema.Types.ObjectId,
      ref: 'QuoteSection',
      default: null,
      index: true
    },

    sectionDiscountType: { type: String, trim: true, default: null },
    sectionDiscountValue: { type: Number, default: 0 },
    sectionDiscountAmount: { type: Number, default: 0 },

    sectionSubtotal: { type: Number, default: 0 },
    sectionLineDiscountTotal: { type: Number, default: 0 },
    sectionDiscountTotal: { type: Number, default: 0 },
    sectionTaxTotal: { type: Number, default: 0 },
    sectionTotal: { type: Number, default: 0 },

    showSectionTotal: { type: Boolean, default: true },
    pageBreakBefore: { type: Boolean, default: false },

    hiddenSection: { type: Boolean, default: false, index: true },
    lockedSnapshot: { type: Boolean, default: false, index: true }
  },
  { timestamps: true }
);

QuoteSectionSchema.index({ organizationId: 1, quoteId: 1, sectionOrder: 1 });

QuoteSectionSchema.pre('validate', function ensureQuoteSectionId(next) {
  if (this.quoteSectionId) return next();
  const s = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  this.quoteSectionId = `${s()}${s()}-${s()}-${s()}-${s()}-${s()}${s()}${s()}`;
  return next();
});

module.exports = wrapTenantModel(mongoose.model('QuoteSection', QuoteSectionSchema));
