'use strict';

/**
 * Master-DB registry for Tally agent pairing / auth (not tenant-wrapped).
 * Lets the Windows agent complete pairing and heartbeat without a user JWT.
 */

const mongoose = require('mongoose');

const { Schema } = mongoose;

const TallyAgentBridgeSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    /** Tenant DB TallyConnection._id as string */
    connectionId: { type: String, trim: true, default: null, index: true },
    status: {
      type: String,
      enum: ['pending_pair', 'paired', 'online', 'offline', 'revoked'],
      default: 'pending_pair',
      index: true,
    },
    pairingCode: { type: String, trim: true, uppercase: true, default: null },
    pairingCodeExpiresAt: { type: Date, default: null },
    agentDeviceId: { type: String, trim: true, default: null, index: true },
    agentTokenHash: { type: String, trim: true, default: null, index: true },
    agentHostname: { type: String, trim: true, default: null },
    agentVersion: { type: String, trim: true, default: null },
    lastSeenAt: { type: Date, default: null },
  },
  { timestamps: true }
);

TallyAgentBridgeSchema.index(
  { pairingCode: 1 },
  { unique: true, partialFilterExpression: { pairingCode: { $type: 'string' } } }
);

module.exports = mongoose.model('TallyAgentBridge', TallyAgentBridgeSchema);
