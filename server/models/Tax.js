const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const {
  TAX_TYPE_VALUES,
  TAX_TYPES,
  TAX_SCOPE_VALUES,
  TAX_SCOPES,
  TAX_APPLICABLE_ON_VALUES,
  TAX_APPLICABLE_ON,
  TAX_STATUS_VALUES,
  TAX_STATUSES
} = require('../constants/taxConstants');

/**
 * Reusable tax definition (commercial authority — not inventory ledger).
 * Extensible: inclusive/compound/effective dates can attach without breaking MVP fields.
 */
const TaxSchema = new Schema({
  organizationId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 120
  },
  code: {
    type: String,
    trim: true,
    maxlength: 64,
    default: null
  },
  description: {
    type: String,
    trim: true,
    maxlength: 2000,
    default: null
  },
  taxType: {
    type: String,
    enum: TAX_TYPE_VALUES,
    default: TAX_TYPES.PERCENTAGE,
    required: true,
    index: true
  },
  taxValue: {
    type: Number,
    required: true,
    min: 0
  },
  scope: {
    type: String,
    enum: TAX_SCOPE_VALUES,
    default: TAX_SCOPES.ITEM,
    required: true,
    index: true
  },
  applicableOn: {
    type: String,
    enum: TAX_APPLICABLE_ON_VALUES,
    default: TAX_APPLICABLE_ON.BOTH,
    required: true,
    index: true
  },
  isDefault: {
    type: Boolean,
    default: false,
    index: true
  },
  status: {
    type: String,
    enum: TAX_STATUS_VALUES,
    default: TAX_STATUSES.ACTIVE,
    required: true,
    index: true
  },
  /** Reserved for inclusive/exclusive without schema break */
  isInclusive: {
    type: Boolean,
    default: false
  },
  /** Reserved: compound / tax-on-tax stack order (null = independent) */
  compoundPriority: {
    type: Number,
    default: null
  },
  effectiveFrom: {
    type: Date,
    default: null
  },
  effectiveTo: {
    type: Date,
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
  }
}, {
  timestamps: true
});

TaxSchema.index({ organizationId: 1, name: 1 }, { unique: true });
TaxSchema.index({ organizationId: 1, code: 1 }, {
  unique: true,
  partialFilterExpression: { code: { $type: 'string', $gt: '' } }
});
TaxSchema.index({ organizationId: 1, status: 1, applicableOn: 1 });
TaxSchema.index({ organizationId: 1, isDefault: 1, status: 1 });

module.exports = wrapTenantModel(mongoose.model('Tax', TaxSchema));
