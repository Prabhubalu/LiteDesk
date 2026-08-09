'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const { PROVIDER_KEYS } = require('./TelephonyProviderConfig');

const TelephonyWebhookReceiptSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    providerKey: { type: String, enum: PROVIDER_KEYS, required: true },
    providerEventId: { type: String, trim: true, required: true },
    eventType: { type: String, trim: true, default: '' },
    processedAt: { type: Date, default: Date.now },
  },
  {
    collection: 'telephony_webhook_receipts',
  }
);

TelephonyWebhookReceiptSchema.index(
  { organizationId: 1, providerKey: 1, providerEventId: 1 },
  { unique: true }
);

module.exports = wrapTenantModel(
  mongoose.model('TelephonyWebhookReceipt', TelephonyWebhookReceiptSchema)
);
