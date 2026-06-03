const mongoose = require('mongoose');
const crypto = require('crypto');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const {
  PAYMENT_GATEWAY_SESSION_STATUSES,
  PAYMENT_GATEWAY_SESSION_STATUS_DEFAULT,
  PAYMENT_LINK_PAY_TARGET_TYPES,
  PAYMENT_GATEWAY_PROVIDERS
} = require('../constants/paymentGatewayLifecycle');

const { Schema } = mongoose;

const InvoiceTargetSchema = new Schema(
  {
    invoiceId: { type: String, required: true, trim: true },
    invoiceMongoId: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true },
    amountRequested: { type: Number, required: true, min: 0.01 }
  },
  { _id: false }
);

const PaymentGatewaySessionSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },

    paymentGatewaySessionId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },

    paymentLinkId: { type: String, trim: true, default: null, index: true },
    organizationRefId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    contactId: { type: Schema.Types.ObjectId, ref: 'People', default: null },

    provider: {
      type: String,
      enum: PAYMENT_GATEWAY_PROVIDERS,
      required: true,
      index: true
    },
    providerSessionId: { type: String, trim: true, default: null, index: true },
    providerPaymentId: { type: String, trim: true, default: null, index: true },
    providerCustomerId: { type: String, trim: true, default: null },

    amount: { type: Number, required: true, min: 0.01 },
    currency: { type: String, trim: true, default: 'USD', index: true },
    payTargetType: {
      type: String,
      enum: PAYMENT_LINK_PAY_TARGET_TYPES,
      default: 'single_invoice'
    },
    invoiceTargets: { type: [InvoiceTargetSchema], default: [] },

    status: {
      type: String,
      enum: PAYMENT_GATEWAY_SESSION_STATUSES,
      default: PAYMENT_GATEWAY_SESSION_STATUS_DEFAULT,
      index: true
    },
    failureCode: { type: String, trim: true, default: null },
    failureMessage: { type: String, trim: true, default: null },

    paymentId: { type: String, trim: true, default: null, index: true },
    paymentMongoId: { type: Schema.Types.ObjectId, ref: 'Payment', default: null, index: true },

    checkoutUrl: { type: String, trim: true, default: null },
    successUrl: { type: String, trim: true, default: null },
    cancelUrl: { type: String, trim: true, default: null },

    expiresAt: { type: Date, default: null, index: true },
    completedAt: { type: Date, default: null },

    idempotencyKey: { type: String, trim: true, default: null, index: true },
    metadata: { type: Schema.Types.Mixed, default: {} },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

PaymentGatewaySessionSchema.index(
  { organizationId: 1, provider: 1, providerSessionId: 1 },
  { unique: true, sparse: true }
);
PaymentGatewaySessionSchema.index(
  { organizationId: 1, provider: 1, providerPaymentId: 1 },
  { sparse: true }
);

PaymentGatewaySessionSchema.pre('validate', function assignSessionId(next) {
  if (!this.paymentGatewaySessionId) {
    this.paymentGatewaySessionId = crypto.randomUUID();
  }
  next();
});

module.exports = wrapTenantModel(mongoose.model('PaymentGatewaySession', PaymentGatewaySessionSchema));
