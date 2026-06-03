const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const { REFUND_REASONS } = require('../constants/refundReasons');
const { PAYMENT_INSTRUMENT_METHODS } = require('../constants/paymentLifecycle');

const { Schema } = mongoose;

const REFUND_STATUSES = ['pending', 'completed', 'failed', 'void'];

const RefundSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },

    refundId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },

    refundNumber: {
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

    paymentReversalId: { type: String, trim: true, default: null, index: true },
    paymentReversalMongoId: { type: Schema.Types.ObjectId, ref: 'PaymentReversal', default: null },

    organizationRefId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    contactId: { type: Schema.Types.ObjectId, ref: 'People', default: null, index: true },

    amount: { type: Number, required: true, min: 0.01 },
    unallocatedPortion: { type: Number, default: 0, min: 0 },
    allocationPortion: { type: Number, default: 0, min: 0 },

    refundCurrency: { type: String, trim: true, default: 'USD', index: true },
    exchangeRateSnapshot: { type: Schema.Types.Mixed, default: null },

    refundDate: { type: Date, required: true, index: true },
    refundMethod: {
      type: String,
      enum: PAYMENT_INSTRUMENT_METHODS,
      default: 'other'
    },
    referenceNumber: { type: String, trim: true, default: null },

    reason: {
      type: String,
      enum: REFUND_REASONS,
      required: true,
      index: true
    },
    reasonNote: { type: String, trim: true, maxlength: 500, default: null },

    status: {
      type: String,
      enum: REFUND_STATUSES,
      default: 'pending',
      index: true
    },

    recordedAt: { type: Date, default: null, index: true },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },

    sourceContext: { type: String, trim: true, default: 'manual', index: true },
    sourceRef: { type: Schema.Types.Mixed, default: null },

    notes: { type: String, trim: true, maxlength: 2000, default: null },
    idempotencyKey: { type: String, trim: true, default: null, index: true },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    modifiedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

RefundSchema.index({ organizationId: 1, refundNumber: 1 }, { unique: true });
RefundSchema.index({ organizationId: 1, paymentMongoId: 1, status: 1 });

RefundSchema.pre('validate', async function assignRefundIds(next) {
  try {
    if (!this.refundId) {
      const s = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
      this.refundId = `${s()}${s()}-${s()}-${s()}-${s()}-${s()}${s()}${s()}`;
    }
    if (this.refundNumber) return next();

    const Model = this.constructor;
    const count = await Model.countDocuments({ organizationId: this.organizationId });
    this.refundNumber = `REF-${String(count + 1).padStart(4, '0')}`;
    return next();
  } catch (err) {
    return next(err);
  }
});

module.exports = wrapTenantModel(mongoose.model('Refund', RefundSchema));
