const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const { MAX_SESSION_NOTE_LENGTH } = require('../constants/liveChatSessionIdentity');

const LiveChatSessionNoteSchema = new mongoose.Schema({
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
  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
    required: true,
  },
  body: { type: String, required: true, trim: true, maxlength: MAX_SESSION_NOTE_LENGTH },
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now },
});

LiveChatSessionNoteSchema.index({ organizationId: 1, sessionId: 1, createdAt: -1 });

LiveChatSessionNoteSchema.pre('save', function setUpdated(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = wrapTenantModel(mongoose.model('LiveChatSessionNote', LiveChatSessionNoteSchema));
