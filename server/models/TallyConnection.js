'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const { Schema } = mongoose;

const TALLY_CONNECTION_STATUSES = [
  'pending_pair',
  'paired',
  'online',
  'offline',
  'revoked',
];

/** ATIP Connection Engine health state machine. */
const TALLY_HEALTH_STATES = [
  'searching',
  'found',
  'metadata_pending',
  'ready',
  'degraded',
  'offline',
];

const TallyConnectionSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: TALLY_CONNECTION_STATUSES,
      default: 'pending_pair',
      index: true,
    },
    pairingCode: { type: String, trim: true, default: null, index: true },
    pairingCodeExpiresAt: { type: Date, default: null },
    pairingCompletedAt: { type: Date, default: null },
    agentDeviceId: { type: String, trim: true, default: null, index: true },
    agentVersion: { type: String, trim: true, default: null },
    agentHostname: { type: String, trim: true, default: null },
    heartbeatAt: { type: Date, default: null, index: true },
    lastSeenAt: { type: Date, default: null },
    /** Opaque encrypted agent secrets / tokens (ciphertext blobs). */
    encryptedSecrets: { type: Schema.Types.Mixed, default: null },
    agentTokenHash: { type: String, trim: true, default: null },
    healthState: {
      type: String,
      enum: TALLY_HEALTH_STATES,
      default: 'searching',
      index: true,
    },
    validationChecklist: { type: Schema.Types.Mixed, default: {} },
    lastCompanyFingerprint: { type: String, trim: true, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

TallyConnectionSchema.index({ organizationId: 1, status: 1 });
TallyConnectionSchema.index(
  { organizationId: 1, pairingCode: 1 },
  { sparse: true }
);

module.exports = wrapTenantModel(mongoose.model('TallyConnection', TallyConnectionSchema));
module.exports.TALLY_CONNECTION_STATUSES = TALLY_CONNECTION_STATUSES;
module.exports.TALLY_HEALTH_STATES = TALLY_HEALTH_STATES;
