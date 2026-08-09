'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const TelephonyCampaignLogSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TelephonyCampaign',
      required: true,
      index: true,
    },
    phoneNumber: { type: String, trim: true, required: true },
    attempt: { type: Number, default: 1 },
    outcome: { type: String, trim: true, default: null },
    callId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TelephonyCall',
      default: null,
    },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  {
    collection: 'telephony_campaign_logs',
  }
);

TelephonyCampaignLogSchema.index({ organizationId: 1, campaignId: 1, createdAt: -1 });

module.exports = wrapTenantModel(
  mongoose.model('TelephonyCampaignLog', TelephonyCampaignLogSchema)
);
