const mongoose = require('mongoose');
const crypto = require('crypto');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const {
  PAYMENT_GATEWAY_EVENT_PROCESSING_STATUSES,
  PAYMENT_GATEWAY_EVENT_PROCESSING_DEFAULT,
  PAYMENT_GATEWAY_PROVIDERS
} = require('../constants/paymentGatewayLifecycle');

const { Schema } = mongoose;

const PaymentGatewayEventSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },

    paymentGatewayEventId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },

    provider: {
      type: String,
      enum: PAYMENT_GATEWAY_PROVIDERS,
      required: true,
      index: true
    },
    providerEventId: { type: String, required: true, trim: true, index: true },
    eventType: { type: String, required: true, trim: true, index: true },

    payload: { type: Schema.Types.Mixed, required: true },
    signatureValid: { type: Boolean, default: false },
    receivedAt: { type: Date, default: Date.now, index: true },
    receivedFromIp: { type: String, trim: true, default: null },

    processingStatus: {
      type: String,
      enum: PAYMENT_GATEWAY_EVENT_PROCESSING_STATUSES,
      default: PAYMENT_GATEWAY_EVENT_PROCESSING_DEFAULT,
      index: true
    },
    processingError: { type: Schema.Types.Mixed, default: null },
    processedAt: { type: Date, default: null },

    paymentGatewaySessionId: { type: String, trim: true, default: null, index: true },
    paymentLinkId: { type: String, trim: true, default: null, index: true },
    paymentId: { type: String, trim: true, default: null, index: true },

    idempotencyKey: { type: String, trim: true, default: null, index: true }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

PaymentGatewayEventSchema.index(
  { organizationId: 1, provider: 1, providerEventId: 1 },
  { unique: true }
);

PaymentGatewayEventSchema.pre('validate', function assignEventId(next) {
  if (!this.paymentGatewayEventId) {
    this.paymentGatewayEventId = crypto.randomUUID();
  }
  if (!this.idempotencyKey) {
    this.idempotencyKey = `${this.provider}:${this.providerEventId}`;
  }
  next();
});

module.exports = wrapTenantModel(mongoose.model('PaymentGatewayEvent', PaymentGatewayEventSchema));
