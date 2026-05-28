const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const CatalogPriceBookEntrySchema = new Schema({
  organizationId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  priceBookId: {
    type: Schema.Types.ObjectId,
    ref: 'CatalogPriceBook',
    required: true,
    index: true
  },
  variantId: {
    type: Schema.Types.ObjectId,
    ref: 'ItemVariant',
    required: true,
    index: true
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    trim: true
  },
  effectiveFrom: {
    type: Date,
    default: null
  },
  effectiveTo: {
    type: Date,
    default: null
  },
  minQty: {
    type: Number,
    default: 1,
    min: 1
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  modifiedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

CatalogPriceBookEntrySchema.index({ organizationId: 1, priceBookId: 1, variantId: 1 });
CatalogPriceBookEntrySchema.index({ organizationId: 1, variantId: 1, priceBookId: 1 });

module.exports = wrapTenantModel(mongoose.model('CatalogPriceBookEntry', CatalogPriceBookEntrySchema));
