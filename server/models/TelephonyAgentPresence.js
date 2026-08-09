'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const PRESENCE_STATUSES = ['idle', 'busy', 'offline', 'on_break', 'acw', 'training', 'meeting'];

const TelephonyAgentPresenceSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: {
      type: String,
      enum: PRESENCE_STATUSES,
      default: 'offline',
      index: true,
    },
    lastStatusAt: { type: Date, default: Date.now, index: true },
    currentCallId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TelephonyCall',
      default: null,
    },
  },
  {
    collection: 'telephony_agent_presence',
  }
);

TelephonyAgentPresenceSchema.index({ organizationId: 1, userId: 1 }, { unique: true });

TelephonyAgentPresenceSchema.pre('save', function setLastStatus(next) {
  if (this.isModified('status')) {
    this.lastStatusAt = new Date();
  }
  next();
});

module.exports = wrapTenantModel(
  mongoose.model('TelephonyAgentPresence', TelephonyAgentPresenceSchema)
);
module.exports.PRESENCE_STATUSES = PRESENCE_STATUSES;
