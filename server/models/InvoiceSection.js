const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const {
  INVOICE_SECTION_TYPES,
  INVOICE_SECTION_TYPE_DEFAULT
} = require('../constants/invoiceSection');

const { Schema } = mongoose;

const InvoiceSectionSchema = new Schema(
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

    invoiceSectionId: {
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
      enum: INVOICE_SECTION_TYPES,
      default: INVOICE_SECTION_TYPE_DEFAULT,
      index: true
    },

    includeInInvoiceTotal: { type: Boolean, default: true, index: true },

    sectionDiscountType: { type: String, trim: true, default: null },
    sectionDiscountValue: { type: Number, default: 0 },
    sectionDiscountAmount: { type: Number, default: 0 },

    sectionSubtotal: { type: Number, default: 0 },
    sectionLineDiscountTotal: { type: Number, default: 0 },
    sectionDiscountTotal: { type: Number, default: 0 },
    sectionTaxTotal: { type: Number, default: 0 },
    sectionTotal: { type: Number, default: 0 },

    showSectionTotal: { type: Boolean, default: true },
    hiddenSection: { type: Boolean, default: false, index: true },
    lockedSnapshot: { type: Boolean, default: false, index: true },

    sourceSalesOrderSectionId: { type: String, trim: true, default: null, index: true },
    sourceSalesOrderId: { type: Schema.Types.ObjectId, ref: 'SalesOrder', default: null, index: true },
    sourceQuoteSectionId: { type: String, trim: true, default: null, index: true }
  },
  { timestamps: true }
);

InvoiceSectionSchema.index({ organizationId: 1, invoiceId: 1, sectionOrder: 1 });

InvoiceSectionSchema.pre('validate', function ensureInvoiceSectionId(next) {
  if (this.invoiceSectionId) return next();
  const s = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  this.invoiceSectionId = `${s()}${s()}-${s()}-${s()}-${s()}-${s()}${s()}${s()}`;
  return next();
});

module.exports = wrapTenantModel(mongoose.model('InvoiceSection', InvoiceSectionSchema));
