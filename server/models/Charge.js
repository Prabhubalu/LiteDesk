const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const {
  CHARGE_TYPE_VALUES,
  CHARGE_TYPES,
  CHARGE_SCOPE_VALUES,
  CHARGE_SCOPES,
  CHARGE_APPLICABLE_ON_VALUES,
  CHARGE_APPLICABLE_ON,
  CHARGE_STATUS_VALUES,
  CHARGE_STATUSES
} = require('../constants/chargeConstants');

const ChargeSchema = new Schema({
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
  chargeType: {
    type: String,
    enum: CHARGE_TYPE_VALUES,
    default: CHARGE_TYPES.FIXED_AMOUNT,
    required: true,
    index: true
  },
  chargeValue: {
    type: Number,
    required: true,
    min: 0
  },
  scope: {
    type: String,
    enum: CHARGE_SCOPE_VALUES,
    default: CHARGE_SCOPES.TRANSACTION,
    required: true,
    index: true
  },
  applicableOn: {
    type: String,
    enum: CHARGE_APPLICABLE_ON_VALUES,
    default: CHARGE_APPLICABLE_ON.BOTH,
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
    enum: CHARGE_STATUS_VALUES,
    default: CHARGE_STATUSES.ACTIVE,
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

ChargeSchema.index({ organizationId: 1, name: 1 }, { unique: true });
ChargeSchema.index({ organizationId: 1, code: 1 }, {
  unique: true,
  partialFilterExpression: { code: { $type: 'string', $gt: '' } }
});
ChargeSchema.index({ organizationId: 1, status: 1, applicableOn: 1 });

module.exports = wrapTenantModel(mongoose.model('Charge', ChargeSchema));
