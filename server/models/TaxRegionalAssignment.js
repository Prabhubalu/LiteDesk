const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const {
  TAX_REGION_LEVEL_VALUES,
  TAX_REGION_LEVELS,
  TAX_STATUS_VALUES,
  TAX_STATUSES
} = require('../constants/taxConstants');

/**
 * MVP regional tax suggestion — assignment, not a full rule engine.
 */
const TaxRegionalAssignmentSchema = new Schema({
  organizationId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  level: {
    type: String,
    enum: TAX_REGION_LEVEL_VALUES,
    default: TAX_REGION_LEVELS.COUNTRY,
    required: true,
    index: true
  },
  countryCode: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    maxlength: 3
  },
  stateCode: {
    type: String,
    trim: true,
    uppercase: true,
    maxlength: 16,
    default: null
  },
  region: {
    type: String,
    trim: true,
    maxlength: 120,
    default: null
  },
  taxIds: [{ type: Schema.Types.ObjectId, ref: 'Tax' }],
  taxGroupIds: [{ type: Schema.Types.ObjectId, ref: 'TaxGroup' }],
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

TaxRegionalAssignmentSchema.index(
  { organizationId: 1, countryCode: 1, stateCode: 1, region: 1, level: 1 },
  { unique: true }
);

module.exports = wrapTenantModel(
  mongoose.model('TaxRegionalAssignment', TaxRegionalAssignmentSchema)
);
