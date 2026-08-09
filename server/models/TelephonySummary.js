'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const TelephonySummarySchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    callId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TelephonyCall',
      required: true,
      index: true,
    },
    summary: { type: String, default: '' },
    intent: { type: String, trim: true, default: null },
    actionItems: [{ type: String, trim: true }],
    sentiment: { type: String, trim: true, default: null },
    coachingScore: { type: Number, default: null },
    talkRatio: { type: Number, default: null },
    complianceFlags: [{ type: String, trim: true }],
  },
  {
    timestamps: true,
    collection: 'telephony_summaries',
  }
);

TelephonySummarySchema.index({ organizationId: 1, callId: 1 }, { unique: true });

module.exports = wrapTenantModel(mongoose.model('TelephonySummary', TelephonySummarySchema));
