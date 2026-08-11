'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const { PROVIDER_KEYS } = require('./TelephonyProviderConfig');

const DIRECTIONS = ['inbound', 'outbound'];
const CALL_STATUSES = [
  'ringing',
  'queued',
  'in-progress',
  'completed',
  'busy',
  'no-answer',
  'failed',
  'canceled',
  'missed',
];

const TelephonyCallSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    providerKey: { type: String, enum: PROVIDER_KEYS, required: true, index: true },
    providerCallSid: { type: String, trim: true, default: null, index: true },
    direction: { type: String, enum: DIRECTIONS, required: true, index: true },
    status: { type: String, enum: CALL_STATUSES, default: 'ringing', index: true },
    from: { type: String, trim: true, default: '' },
    to: { type: String, trim: true, default: '' },
    agentUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    durationSeconds: { type: Number, default: null },
    startedAt: { type: Date, default: null },
    answeredAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    disposition: { type: String, trim: true, default: null },
    linkedPersonId: { type: mongoose.Schema.Types.ObjectId, ref: 'People', default: null, index: true },
    linkedLeadId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    linkedOrganizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      default: null,
      index: true,
    },
    linkedDealId: { type: mongoose.Schema.Types.ObjectId, ref: 'Deal', default: null, index: true },
    linkedCaseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Case', default: null, index: true },
    queueId: { type: mongoose.Schema.Types.ObjectId, ref: 'TelephonyQueue', default: null },
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'TelephonyCampaign', default: null },
    recordingId: { type: mongoose.Schema.Types.ObjectId, ref: 'TelephonyRecording', default: null },
    transcriptId: { type: mongoose.Schema.Types.ObjectId, ref: 'TelephonyTranscript', default: null },
    summaryId: { type: mongoose.Schema.Types.ObjectId, ref: 'TelephonySummary', default: null },
    sentiment: { type: String, trim: true, default: null },
    tags: [{ type: String, trim: true }],
    providerMeta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    collection: 'telephony_calls',
  }
);

TelephonyCallSchema.index(
  { organizationId: 1, providerCallSid: 1 },
  { unique: true, sparse: true }
);
TelephonyCallSchema.index({ organizationId: 1, createdAt: -1 });
TelephonyCallSchema.index({ organizationId: 1, agentUserId: 1 });

module.exports = wrapTenantModel(mongoose.model('TelephonyCall', TelephonyCallSchema));
module.exports.DIRECTIONS = DIRECTIONS;
module.exports.CALL_STATUSES = CALL_STATUSES;
