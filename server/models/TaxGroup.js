const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const { TAX_STATUS_VALUES, TAX_STATUSES } = require('../constants/taxConstants');

const TaxGroupSchema = new Schema({
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
  description: {
    type: String,
    trim: true,
    maxlength: 2000,
    default: null
  },
  taxIds: [{
    type: Schema.Types.ObjectId,
    ref: 'Tax'
  }],
  status: {
    type: String,
    enum: TAX_STATUS_VALUES,
    default: TAX_STATUSES.ACTIVE,
    required: true,
    index: true
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

TaxGroupSchema.index({ organizationId: 1, name: 1 }, { unique: true });
TaxGroupSchema.index({ organizationId: 1, status: 1 });

module.exports = wrapTenantModel(mongoose.model('TaxGroup', TaxGroupSchema));
