const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const ChatMessageSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, index: true, required: false },
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatSession', index: true, required: true },

  direction: { type: String, enum: ['inbound', 'outbound'], required: true, index: true },
  authorType: { type: String, enum: ['visitor', 'agent', 'system'], required: true, index: true },
  authorName: { type: String, default: '' },

  body: { type: String, default: '' },

  createdAt: { type: Date, default: Date.now, index: true }
});

module.exports = wrapTenantModel(mongoose.model('ChatMessage', ChatMessageSchema));

