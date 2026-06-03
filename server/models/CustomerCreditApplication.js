const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const {
  CUSTOMER_CREDIT_APPLICATION_STATUSES,
  CUSTOMER_CREDIT_APPLICATION_STATUS_DEFAULT
} = require('../constants/customerCreditLifecycle');

const { Schema } = mongoose;

const CustomerCreditApplicationSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },

    customerCreditApplicationId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },

    customerCreditBalanceId: { type: String, required: true, trim: true, index: true },
    customerCreditBalanceMongoId: {
      type: Schema.Types.ObjectId,
      ref: 'CustomerCreditBalance',
      required: true,
      index: true
    },

    invoiceId: { type: String, required: true, trim: true, index: true },
    invoiceMongoId: {
      type: Schema.Types.ObjectId,
      ref: 'Invoice',
      required: true,
      index: true
    },

    amountApplied: { type: Number, required: true, min: 0.01 },
    invoiceCurrency: { type: String, trim: true, default: 'USD' },

    status: {
      type: String,
      enum: CUSTOMER_CREDIT_APPLICATION_STATUSES,
      default: CUSTOMER_CREDIT_APPLICATION_STATUS_DEFAULT,
      index: true
    },

    appliedAt: { type: Date, default: Date.now, index: true },
    appliedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },

    reversedAt: { type: Date, default: null },
    reversedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reversalReason: { type: String, trim: true, maxlength: 500, default: null }
  },
  { timestamps: true }
);

CustomerCreditApplicationSchema.index({ organizationId: 1, invoiceMongoId: 1, status: 1 });
CustomerCreditApplicationSchema.index({ organizationId: 1, customerCreditBalanceMongoId: 1, status: 1 });

CustomerCreditApplicationSchema.pre('validate', function ensureApplicationId(next) {
  if (this.customerCreditApplicationId) return next();
  const s = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  this.customerCreditApplicationId = `${s()}${s()}-${s()}-${s()}-${s()}-${s()}${s()}${s()}`;
  return next();
});

module.exports = wrapTenantModel(
  mongoose.model('CustomerCreditApplication', CustomerCreditApplicationSchema)
);
