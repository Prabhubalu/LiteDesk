const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const { PAYMENT_REVERSAL_TYPES } = require('../constants/paymentLifecycle');

const { Schema } = mongoose;

const PaymentReversalSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },

    paymentReversalId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },

    paymentReversalNumber: {
      type: String,
      required: true,
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

    refundId: { type: String, trim: true, default: null, index: true },
    refundMongoId: { type: Schema.Types.ObjectId, default: null },

    reversalType: {
      type: String,
      enum: PAYMENT_REVERSAL_TYPES,
      default: 'other',
      index: true
    },
    reversalReason: { type: String, required: true, trim: true, maxlength: 500 },
    reversalReasonCode: { type: String, trim: true, default: null },

    allocationReversals: [
      {
        paymentAllocationId: { type: String, required: true, trim: true },
        amountReversed: { type: Number, required: true, min: 0.01 }
      }
    ],

    status: {
      type: String,
      enum: ['completed', 'failed'],
      default: 'completed',
      index: true
    },

    reversedAt: { type: Date, default: Date.now, index: true },
    reversedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },

    sourceContext: { type: String, trim: true, default: 'manual' },
    notes: { type: String, trim: true, maxlength: 2000, default: null }
  },
  { timestamps: true }
);

PaymentReversalSchema.index({ organizationId: 1, paymentReversalNumber: 1 }, { unique: true });

PaymentReversalSchema.pre('validate', async function assignReversalIds(next) {
  try {
    if (!this.paymentReversalId) {
      const s = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
      this.paymentReversalId = `${s()}${s()}-${s()}-${s()}-${s()}-${s()}${s()}${s()}`;
    }
    if (this.paymentReversalNumber) return next();

    const Model = this.constructor;
    const count = await Model.countDocuments({ organizationId: this.organizationId });
    this.paymentReversalNumber = `PRV-${String(count + 1).padStart(4, '0')}`;
    return next();
  } catch (err) {
    return next(err);
  }
});

module.exports = wrapTenantModel(mongoose.model('PaymentReversal', PaymentReversalSchema));
