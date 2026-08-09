'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const MODES = ['preview', 'power', 'progressive', 'predictive'];
const STATUSES = ['draft', 'running', 'paused', 'completed'];

const TelephonyCampaignSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    name: { type: String, trim: true, required: true },
    mode: { type: String, enum: MODES, default: 'preview', index: true },
    status: { type: String, enum: STATUSES, default: 'draft', index: true },
    listRef: { type: mongoose.Schema.Types.Mixed, default: null },
    maxAttempts: { type: Number, default: 3 },
    retryMinutes: { type: Number, default: 30 },
    amdEnabled: { type: Boolean, default: false },
    stats: { type: mongoose.Schema.Types.Mixed, default: {} },
    fromNumber: { type: String, trim: true, default: null },
    agentUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
    collection: 'telephony_campaigns',
  }
);

TelephonyCampaignSchema.index({ organizationId: 1, status: 1 });

module.exports = wrapTenantModel(mongoose.model('TelephonyCampaign', TelephonyCampaignSchema));
module.exports.MODES = MODES;
module.exports.STATUSES = STATUSES;
