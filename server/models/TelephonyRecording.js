'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const { PROVIDER_KEYS } = require('./TelephonyProviderConfig');

const ENCRYPTION_STATUSES = ['encrypted', 'pending'];

const TelephonyRecordingSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    callId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TelephonyCall',
      required: true,
      index: true,
    },
    providerKey: { type: String, enum: PROVIDER_KEYS, required: true },
    providerRecordingSid: { type: String, trim: true, default: null, index: true },
    storageKey: { type: String, trim: true, default: null },
    durationSeconds: { type: Number, default: null },
    encryptionStatus: { type: String, enum: ENCRYPTION_STATUSES, default: 'pending' },
    retentionUntil: { type: Date, default: null },
    mimeType: { type: String, trim: true, default: 'audio/mpeg' },
    sizeBytes: { type: Number, default: null },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  {
    collection: 'telephony_recordings',
  }
);

TelephonyRecordingSchema.index({ organizationId: 1, callId: 1 });

module.exports = wrapTenantModel(
  mongoose.model('TelephonyRecording', TelephonyRecordingSchema)
);
module.exports.ENCRYPTION_STATUSES = ENCRYPTION_STATUSES;
