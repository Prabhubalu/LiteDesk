'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const { PROVIDER_KEYS } = require('./TelephonyProviderConfig');

const SegmentSchema = new mongoose.Schema(
  {
    speaker: { type: String, trim: true, default: '' },
    text: { type: String, trim: true, default: '' },
    startMs: { type: Number, default: 0 },
    endMs: { type: Number, default: 0 },
  },
  { _id: false }
);

const TelephonyTranscriptSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    callId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TelephonyCall',
      required: true,
      index: true,
    },
    providerKey: { type: String, enum: PROVIDER_KEYS, required: true },
    language: { type: String, trim: true, default: 'en' },
    segments: { type: [SegmentSchema], default: [] },
    fullText: { type: String, default: '' },
    storageKey: { type: String, trim: true, default: null },
  },
  {
    timestamps: true,
    collection: 'telephony_transcripts',
  }
);

TelephonyTranscriptSchema.index({ organizationId: 1, callId: 1 }, { unique: true });

module.exports = wrapTenantModel(
  mongoose.model('TelephonyTranscript', TelephonyTranscriptSchema)
);
