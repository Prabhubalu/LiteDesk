const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const {
  SALES_ORDER_SECTION_TYPES,
  SALES_ORDER_SECTION_TYPE_DEFAULT
} = require('../constants/salesOrderSection');

const { Schema } = mongoose;

const SalesOrderSectionSchema = new Schema(
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

    salesOrderSectionId: {
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
      enum: SALES_ORDER_SECTION_TYPES,
      default: SALES_ORDER_SECTION_TYPE_DEFAULT,
      index: true
    },

    includeInOrderTotal: { type: Boolean, default: true, index: true },

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

    sectionAcceptanceType: {
      type: String,
      trim: true,
      default: 'full'
    },

    sourceQuoteSectionId: { type: String, trim: true, default: null, index: true },
    sourceQuoteId: { type: Schema.Types.ObjectId, ref: 'Quote', default: null, index: true },
    sourceRevisionNumber: { type: Number, default: null, min: 1 }
  },
  { timestamps: true }
);

SalesOrderSectionSchema.index({ organizationId: 1, salesOrderId: 1, sectionOrder: 1 });

SalesOrderSectionSchema.pre('validate', function ensureSalesOrderSectionId(next) {
  if (this.salesOrderSectionId) return next();
  const s = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  this.salesOrderSectionId = `${s()}${s()}-${s()}-${s()}-${s()}-${s()}${s()}${s()}`;
  return next();
});

module.exports = wrapTenantModel(mongoose.model('SalesOrderSection', SalesOrderSectionSchema));
