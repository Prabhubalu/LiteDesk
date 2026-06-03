const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const { SALES_ORDER_LINE_TYPES } = require('../constants/salesOrderLineTypes');
const {
  SALES_ORDER_LINE_FULFILLMENT_STATUSES,
  SALES_ORDER_LINE_FULFILLMENT_DEFAULT
} = require('../constants/salesOrderFulfillment');

const { Schema } = mongoose;

const SalesOrderLineSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },

    salesOrderId: {
      type: Schema.Types.ObjectId,
      ref: 'SalesOrder',
      required: true,
      index: true
    },

    salesOrderLineId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true
    },

    salesOrderSectionId: {
      type: Schema.Types.ObjectId,
      ref: 'SalesOrderSection',
      default: null,
      index: true
    },

    variantId: {
      type: Schema.Types.ObjectId,
      ref: 'ItemVariant',
      required: true,
      index: true
    },

    parentBundleLineId: {
      type: Schema.Types.ObjectId,
      ref: 'SalesOrderLine',
      default: null,
      index: true
    },

    lineType: {
      type: String,
      enum: SALES_ORDER_LINE_TYPES,
      default: 'standard',
      index: true
    },

    lineOrder: { type: Number, default: 0 },

    quantity: { type: Number, default: 1, min: 0 },
    unitOfMeasure: { type: String, trim: true, default: null },

    unitPriceSnapshot: { type: Number, default: 0 },
    listPriceSnapshot: { type: Number, default: 0 },
    pricingSourceSnapshot: { type: String, trim: true, default: null, index: true },
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

    skuSnapshot: { type: String, trim: true, default: null },
    itemNameSnapshot: { type: String, trim: true, default: null },
    descriptionSnapshot: { type: String, default: null },
    attributesSnapshot: { type: Schema.Types.Mixed, default: {} },
    bundleSnapshot: { type: Schema.Types.Mixed, default: null },

    optionalLine: { type: Boolean, default: false },
    hiddenLine: { type: Boolean, default: false },

    fulfillmentStatus: {
      type: String,
      enum: SALES_ORDER_LINE_FULFILLMENT_STATUSES,
      default: SALES_ORDER_LINE_FULFILLMENT_DEFAULT,
      index: true
    },
    quantityFulfilled: { type: Number, default: 0, min: 0 },
    quantityCancelled: { type: Number, default: 0, min: 0 },
    quantityBackordered: { type: Number, default: 0, min: 0 },
    quantityInvoiced: { type: Number, default: 0, min: 0 },

    sourceQuoteLineId: { type: String, trim: true, default: null, index: true },
    sourceQuoteSectionId: { type: String, trim: true, default: null, index: true },
    sourceQuoteId: { type: Schema.Types.ObjectId, ref: 'Quote', default: null, index: true },
    sourceRevisionNumber: { type: Number, default: null, min: 1 },
    quoteConversionLinkId: {
      type: Schema.Types.ObjectId,
      ref: 'QuoteConversionLink',
      default: null,
      index: true
    },

    lockedSnapshot: { type: Boolean, default: false, index: true }
  },
  { timestamps: true }
);

SalesOrderLineSchema.index(
  { organizationId: 1, salesOrderId: 1, sourceQuoteLineId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      sourceQuoteLineId: { $type: 'string' }
    }
  }
);
SalesOrderLineSchema.index({ organizationId: 1, sourceQuoteId: 1, sourceQuoteLineId: 1 });
SalesOrderLineSchema.index({ organizationId: 1, salesOrderId: 1, lineOrder: 1 });

SalesOrderLineSchema.pre('validate', function ensureSalesOrderLineId(next) {
  if (this.salesOrderLineId) return next();
  const s = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  this.salesOrderLineId = `${s()}${s()}-${s()}-${s()}-${s()}-${s()}${s()}${s()}`;
  return next();
});

module.exports = wrapTenantModel(mongoose.model('SalesOrderLine', SalesOrderLineSchema));
