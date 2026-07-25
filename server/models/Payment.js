const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const {
  PAYMENT_STATUSES,
  PAYMENT_STATUS_DEFAULT,
  PAYMENT_PURPOSES,
  PAYMENT_PURPOSE_DEFAULT,
  PAYMENT_INSTRUMENT_METHODS
} = require('../constants/paymentLifecycle');

const { Schema } = mongoose;

const PaymentInstrumentSnapshotSchema = new Schema(
  {
    method: {
      type: String,
      enum: PAYMENT_INSTRUMENT_METHODS,
      default: 'other'
    },
    referenceNumber: { type: String, trim: true, default: null },
    bankName: { type: String, trim: true, default: null },
    maskedAccount: { type: String, trim: true, default: null },
    provider: { type: String, trim: true, default: 'manual' }
  },
  { _id: false }
);

const PaymentSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },

    paymentId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },

    paymentNumber: {
      type: String,
      required: true,
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

    amount: { type: Number, required: true, min: 0.01 },
    paymentCurrency: { type: String, trim: true, default: 'USD', index: true },
    exchangeRateSnapshot: { type: Number, default: 1 },
    paymentDate: { type: Date, required: true, index: true },
    valueDate: { type: Date, default: null },

    paymentPurpose: {
      type: String,
      enum: PAYMENT_PURPOSES,
      default: PAYMENT_PURPOSE_DEFAULT,
      index: true
    },

    paymentInstrumentSnapshot: {
      type: PaymentInstrumentSnapshotSchema,
      default: () => ({})
    },
    /** Gateway / PSP reference (Razorpay, Stripe, bank UTR, etc.) — not Tally */
    externalReference: { type: String, trim: true, default: null, index: true },

    // External sync triad (Tally / accounting connectors) — distinct from gateway externalReference
    externalReferenceId: { type: String, trim: true, default: null, index: true },
    syncStatus: { type: String, trim: true, default: 'not_synced', index: true },
    lastSyncAt: { type: Date, default: null },

    amountAllocated: { type: Number, default: 0 },
    amountUnallocated: { type: Number, default: 0 },
    amountRefunded: { type: Number, default: 0 },

    status: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: PAYMENT_STATUS_DEFAULT,
      index: true
    },

    recordedAt: { type: Date, default: null, index: true },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },

    sourceContext: { type: String, trim: true, default: 'manual', index: true },
    sourceRef: { type: Schema.Types.Mixed, default: null },

    notes: { type: String, trim: true, maxlength: 2000, default: null },
    customFields: { type: Schema.Types.Mixed, default: {} },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    modifiedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },

    deletedAt: { type: Date, default: null, index: true }
  },
  { timestamps: true }
);

PaymentSchema.index({ organizationId: 1, paymentNumber: 1 }, { unique: true });
PaymentSchema.index({ organizationId: 1, organizationRefId: 1, paymentDate: -1 });
PaymentSchema.index(
  { organizationId: 1, externalReference: 1 },
  {
    unique: true,
    partialFilterExpression: { externalReference: { $type: 'string', $ne: '' } }
  }
);

PaymentSchema.pre('validate', async function assignPaymentIds(next) {
  try {
    if (!this.paymentId) {
      const s = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
      this.paymentId = `${s()}${s()}-${s()}-${s()}-${s()}-${s()}${s()}${s()}`;
    }
    if (this.paymentNumber) return next();

    const { allocate } = require('../services/moduleNumberingService');
    const result = await allocate({
      organizationId: this.organizationId,
      moduleKey: 'payments',
    });
    if (result?.recordId) {
      this.paymentNumber = result.recordId;
      return next();
    }
    const PaymentModel = this.constructor;
    const count = await PaymentModel.countDocuments({ organizationId: this.organizationId });
    this.paymentNumber = `PAY-${String(count + 1).padStart(4, '0')}`;
    return next();
  } catch (err) {
    return next(err);
  }
});

module.exports = wrapTenantModel(mongoose.model('Payment', PaymentSchema));
