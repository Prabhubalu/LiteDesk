'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const PROVIDER_KEYS = ['twilio', 'exotel', 'plivo', 'knowlarity', 'generic_sip'];

const TelephonyProviderConfigSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    providerKey: {
      type: String,
      enum: PROVIDER_KEYS,
      required: true,
      index: true,
    },
    enabled: { type: Boolean, default: true, index: true },
    isActive: { type: Boolean, default: false, index: true },
    credentials: { type: mongoose.Schema.Types.Mixed, default: {} },
    settings: { type: mongoose.Schema.Types.Mixed, default: {} },
    webhookSecret: { type: String, trim: true, default: '' },
    externalAccountId: { type: String, trim: true, default: null },
  },
  {
    timestamps: true,
    collection: 'telephony_providers',
  }
);

TelephonyProviderConfigSchema.index({ organizationId: 1, providerKey: 1 }, { unique: true });
TelephonyProviderConfigSchema.index({ externalAccountId: 1 }, { sparse: true });

module.exports = wrapTenantModel(
  mongoose.model('TelephonyProviderConfig', TelephonyProviderConfigSchema)
);
module.exports.PROVIDER_KEYS = PROVIDER_KEYS;
