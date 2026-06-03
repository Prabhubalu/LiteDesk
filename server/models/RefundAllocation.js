const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const { Schema } = mongoose;

const REFUND_ALLOCATION_STATUSES = ['active', 'void'];

const RefundAllocationSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },

    refundAllocationId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },

    refundId: { type: String, required: true, trim: true, index: true },
    refundMongoId: {
      type: Schema.Types.ObjectId,
      ref: 'Refund',
      required: true,
      index: true
    },

    paymentAllocationId: { type: String, required: true, trim: true, index: true },
    paymentId: { type: String, required: true, trim: true, index: true },

    invoiceId: { type: String, required: true, trim: true, index: true },
    invoiceMongoId: {
      type: Schema.Types.ObjectId,
      ref: 'Invoice',
      required: true,
      index: true
    },

    amountReversed: { type: Number, required: true, min: 0.01 },
    invoiceCurrency: { type: String, trim: true, default: 'USD' },

    status: {
      type: String,
      enum: REFUND_ALLOCATION_STATUSES,
      default: 'active',
      index: true
    }
  },
  { timestamps: true }
);

RefundAllocationSchema.index({ organizationId: 1, invoiceMongoId: 1, status: 1 });
RefundAllocationSchema.index({ organizationId: 1, refundMongoId: 1 });

RefundAllocationSchema.pre('validate', function ensureRefundAllocationId(next) {
  if (this.refundAllocationId) return next();
  const s = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  this.refundAllocationId = `${s()}${s()}-${s()}-${s()}-${s()}-${s()}${s()}${s()}`;
  return next();
});

module.exports = wrapTenantModel(
  mongoose.model('RefundAllocation', RefundAllocationSchema)
);
