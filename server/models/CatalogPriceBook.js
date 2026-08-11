const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const CatalogPriceBookSchema = new Schema({
  organizationId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  currency: {
    type: String,
    default: 'USD',
    trim: true
  },
  isDefault: {
    type: Boolean,
    default: false,
    index: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  /** Empty = all customer types. Used for automatic book selection. */
  customerTypes: {
    type: [String],
    default: [],
  },
  /** Empty = all regions (ISO / custom codes, uppercase). */
  regionCodes: {
    type: [String],
    default: [],
  },
  /** Lower priority wins ties against broader books (1 = highest preference). */
  priority: {
    type: Number,
    default: 100,
    index: true,
  },
  effectiveFrom: {
    type: Date,
    default: null,
  },
  effectiveUntil: {
    type: Date,
    default: null,
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

CatalogPriceBookSchema.index({ organizationId: 1, name: 1 }, { unique: true });
CatalogPriceBookSchema.index({ organizationId: 1, isDefault: 1 });
CatalogPriceBookSchema.index({ organizationId: 1, isActive: 1, priority: 1 });

module.exports = wrapTenantModel(mongoose.model('CatalogPriceBook', CatalogPriceBookSchema));
