const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const { INVOICE_LINE_TYPES } = require('../constants/invoiceLineTypes');

const { Schema } = mongoose;

const InvoiceLineSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },

    invoiceId: {
      type: Schema.Types.ObjectId,
      ref: 'Invoice',
      required: true,
      index: true
    },

    invoiceLineId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true
    },

    invoiceSectionId: {
      type: Schema.Types.ObjectId,
      ref: 'InvoiceSection',
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
      ref: 'InvoiceLine',
      default: null,
      index: true
    },

    lineType: {
      type: String,
      enum: INVOICE_LINE_TYPES,
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
    chargeSnapshot: { type: Schema.Types.Mixed, default: { charges: [] } },
    quantityReturned: { type: Number, default: 0, min: 0 },

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

    sourceSalesOrderLineId: { type: String, trim: true, default: null, index: true },
    sourceSalesOrderId: { type: Schema.Types.ObjectId, ref: 'SalesOrder', default: null, index: true },
    sourceSalesOrderSectionId: { type: String, trim: true, default: null, index: true },
    sourceQuoteLineId: { type: String, trim: true, default: null, index: true },
    sourceQuoteId: { type: Schema.Types.ObjectId, ref: 'Quote', default: null, index: true },
    salesOrderInvoiceAllocationId: { type: String, trim: true, default: null, index: true },
    sourceInvoiceLineId: { type: String, trim: true, default: null, index: true },
    sourceSalesOrderInvoiceAllocationId: { type: String, trim: true, default: null, index: true },

    quantityCredited: { type: Number, default: 0, min: 0 },
    quantityWrittenOff: { type: Number, default: 0, min: 0 },
    amountWrittenOff: { type: Number, default: 0, min: 0 },

    lockedSnapshot: { type: Boolean, default: false, index: true }
  },
  { timestamps: true }
);

InvoiceLineSchema.index({ organizationId: 1, invoiceId: 1, lineOrder: 1 });
InvoiceLineSchema.index({ organizationId: 1, sourceSalesOrderId: 1, sourceSalesOrderLineId: 1 });

InvoiceLineSchema.pre('validate', function ensureInvoiceLineId(next) {
  if (this.invoiceLineId) return next();
  const s = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  this.invoiceLineId = `${s()}${s()}-${s()}-${s()}-${s()}-${s()}${s()}${s()}`;
  return next();
});

module.exports = wrapTenantModel(mongoose.model('InvoiceLine', InvoiceLineSchema));
