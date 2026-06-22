const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const {
  LIVE_CHAT_ASSIGNED_BY_VALUES,
  LIVE_CHAT_ASSIGNMENT_ACTION_VALUES,
} = require('../constants/liveChatSessionAssignment');

const LiveChatSessionAssignmentEventSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    index: true,
    required: true,
  },
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatSession',
    index: true,
    required: true,
  },
  action: {
    type: String,
    enum: LIVE_CHAT_ASSIGNMENT_ACTION_VALUES,
    required: true,
    index: true,
  },
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true,
  },
  previousAgentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  performedByUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  assignedBy: {
    type: String,
    enum: LIVE_CHAT_ASSIGNED_BY_VALUES,
    default: null,
  },
  metadata: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  createdAt: { type: Date, default: Date.now, index: true },
});

LiveChatSessionAssignmentEventSchema.index({ organizationId: 1, sessionId: 1, createdAt: -1 });

module.exports = wrapTenantModel(
  mongoose.model('LiveChatSessionAssignmentEvent', LiveChatSessionAssignmentEventSchema),
);
