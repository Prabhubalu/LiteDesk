const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const PRESENCE_STATUSES = ['online', 'busy', 'away', 'offline'];

const LiveChatAgentPresenceSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, index: true, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },

  status: {
    type: String,
    enum: PRESENCE_STATUSES,
    default: 'offline',
    index: true,
  },

  updatedAt: { type: Date, default: Date.now, index: true },
});

LiveChatAgentPresenceSchema.index({ organizationId: 1, userId: 1 }, { unique: true });

LiveChatAgentPresenceSchema.pre('save', function setUpdated(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = wrapTenantModel(mongoose.model('LiveChatAgentPresence', LiveChatAgentPresenceSchema));
module.exports.PRESENCE_STATUSES = PRESENCE_STATUSES;
