const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const {
  GATEWAY_CREDENTIAL_HEALTH_STATUSES,
  GATEWAY_CREDENTIAL_HEALTH_DEFAULT,
  PAYMENT_GATEWAY_PROVIDERS
} = require('../constants/paymentGatewayLifecycle');

const { Schema } = mongoose;

const ProviderHealthSchema = new Schema(
  {
    status: {
      type: String,
      enum: GATEWAY_CREDENTIAL_HEALTH_STATUSES,
      default: GATEWAY_CREDENTIAL_HEALTH_DEFAULT
    },
    lastCheckedAt: { type: Date, default: null },
    lastCheckError: { type: String, trim: true, default: null },
    webhookReachable: { type: Boolean, default: null }
  },
  { _id: false }
);

const OrganizationPaymentGatewaySettingsSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      unique: true,
      index: true
    },

    enabledProviders: {
      type: [String],
      enum: PAYMENT_GATEWAY_PROVIDERS,
      default: ['stripe', 'manual']
    },

    stripe: {
      connectedAccountId: { type: String, trim: true, default: null },
      webhookSecret: { type: String, trim: true, default: null }
    },

    razorpay: {
      keyId: { type: String, trim: true, default: null },
      keySecret: { type: String, trim: true, default: null },
      webhookSecret: { type: String, trim: true, default: null }
    },

    manualBankTransfer: {
      beneficiaryName: { type: String, trim: true, default: null },
      bankName: { type: String, trim: true, default: null },
      accountNumber: { type: String, trim: true, default: null },
      accountNumberMasked: { type: String, trim: true, default: null },
      routingOrIfsc: { type: String, trim: true, default: null },
      instructionsTemplate: { type: String, trim: true, maxlength: 4000, default: null }
    },

    defaultProvider: {
      type: String,
      enum: PAYMENT_GATEWAY_PROVIDERS,
      default: 'stripe'
    },

    portalPayEnabled: { type: Boolean, default: true },
    paymentLinksEnabled: { type: Boolean, default: true },

    credentialHealth: {
      stripe: { type: ProviderHealthSchema, default: () => ({}) },
      razorpay: { type: ProviderHealthSchema, default: () => ({}) }
    }
  },
  { timestamps: true }
);

module.exports = wrapTenantModel(
  mongoose.model('OrganizationPaymentGatewaySettings', OrganizationPaymentGatewaySettingsSchema)
);
