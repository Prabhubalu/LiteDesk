const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const {
  PAYMENT_ALLOCATION_STATUSES,
  PAYMENT_ALLOCATION_STATUS_DEFAULT
} = require('../constants/paymentLifecycle');

const { Schema } = mongoose;

const PaymentAllocationSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },

    paymentAllocationId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },

    paymentId: { type: String, required: true, trim: true, index: true },
    paymentMongoId: {
      type: Schema.Types.ObjectId,
      ref: 'Payment',
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
    invoiceLineId: { type: String, trim: true, default: null, index: true },

    amountApplied: { type: Number, required: true, min: 0.01 },
    invoiceCurrency: { type: String, trim: true, default: 'USD' },
    paymentCurrency: { type: String, trim: true, default: 'USD' },
    exchangeRateSnapshot: { type: Schema.Types.Mixed, default: null },

    status: {
      type: String,
      enum: PAYMENT_ALLOCATION_STATUSES,
      default: PAYMENT_ALLOCATION_STATUS_DEFAULT,
      index: true
    },

    appliedAt: { type: Date, default: Date.now, index: true },
    appliedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },

    reversedAt: { type: Date, default: null },
    reversedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reversalReason: { type: String, trim: true, maxlength: 500, default: null },
    paymentReversalId: { type: String, trim: true, default: null, index: true },

    idempotencyKey: { type: String, trim: true, default: null, index: true }
  },
  { timestamps: true }
);

PaymentAllocationSchema.index({ organizationId: 1, paymentId: 1, status: 1 });
PaymentAllocationSchema.index({ organizationId: 1, invoiceId: 1, status: 1 });

PaymentAllocationSchema.pre('validate', function ensureAllocationId(next) {
  if (this.paymentAllocationId) return next();
  const s = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  this.paymentAllocationId = `${s()}${s()}-${s()}-${s()}-${s()}-${s()}${s()}${s()}`;
  return next();
});

module.exports = wrapTenantModel(
  mongoose.model('PaymentAllocation', PaymentAllocationSchema)
);
