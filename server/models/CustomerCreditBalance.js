const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const {
  CUSTOMER_CREDIT_BALANCE_STATUSES,
  CUSTOMER_CREDIT_BALANCE_STATUS_DEFAULT
} = require('../constants/customerCreditLifecycle');

const { Schema } = mongoose;

const CustomerCreditBalanceSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },

    customerCreditBalanceId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },

    organizationRefId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    contactId: { type: Schema.Types.ObjectId, ref: 'People', default: null, index: true },

    sourcePaymentId: { type: String, trim: true, default: null, index: true },
    sourcePaymentMongoId: { type: Schema.Types.ObjectId, ref: 'Payment', default: null, index: true },

    amount: { type: Number, required: true, min: 0.01 },
    amountRemaining: { type: Number, required: true, min: 0 },
    amountAppliedTotal: { type: Number, default: 0, min: 0 },
    currency: { type: String, trim: true, default: 'USD', index: true },

    status: {
      type: String,
      enum: CUSTOMER_CREDIT_BALANCE_STATUSES,
      default: CUSTOMER_CREDIT_BALANCE_STATUS_DEFAULT,
      index: true
    },

    expiresAt: { type: Date, default: null, index: true },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    modifiedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

CustomerCreditBalanceSchema.index(
  { organizationId: 1, sourcePaymentMongoId: 1 },
  { unique: true, sparse: true }
);
CustomerCreditBalanceSchema.index({ organizationId: 1, organizationRefId: 1, currency: 1, status: 1 });

CustomerCreditBalanceSchema.pre('validate', function ensureCreditBalanceId(next) {
  if (this.customerCreditBalanceId) return next();
  const s = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  this.customerCreditBalanceId = `${s()}${s()}-${s()}-${s()}-${s()}-${s()}${s()}${s()}`;
  return next();
});

module.exports = wrapTenantModel(
  mongoose.model('CustomerCreditBalance', CustomerCreditBalanceSchema)
);
