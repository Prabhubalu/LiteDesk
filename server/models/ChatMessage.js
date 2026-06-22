const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const ChatMessageSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, index: true, required: false },
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatSession', index: true, required: true },

  direction: { type: String, enum: ['inbound', 'outbound'], required: true, index: true },
  authorType: { type: String, enum: ['visitor', 'agent', 'bot', 'system'], required: true, index: true },
  authorName: { type: String, default: '' },

  body: { type: String, default: '' },

  attachments: [{
    fileName: { type: String, default: '' },
    mimeType: { type: String, default: '' },
    size: { type: Number, default: 0 },
    url: { type: String, default: '' },
    storagePath: { type: String, default: '' },
  }],

  /** Recipient received the message (visitor for outbound, agent for inbound). */
  deliveredAt: { type: Date, default: null },
  /** Recipient read the message in the chat UI. */
  readAt: { type: Date, default: null },

  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now }
});

ChatMessageSchema.pre('save', function setUpdatedAt(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = wrapTenantModel(mongoose.model('ChatMessage', ChatMessageSchema));

