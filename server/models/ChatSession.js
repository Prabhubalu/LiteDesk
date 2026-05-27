const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const ChatSessionSchema = new mongoose.Schema({
  // In tenant DB mode, org scope is implicit; keep for analytics / safety.
  organizationId: { type: mongoose.Schema.Types.ObjectId, index: true, required: false },

  // Once the first inbound message arrives we create/link a Helpdesk Case.
  caseRecordId: { type: mongoose.Schema.Types.ObjectId, index: true, required: false },

  instancePublicKey: { type: String, index: true, required: true },
  sessionSecret: { type: String, required: true },

  status: { type: String, enum: ['open', 'closed'], default: 'open', index: true },

  visitor: {
    name: { type: String, default: '' },
    email: { type: String, default: '' },
    externalId: { type: String, default: '' }
  },

  pageUrl: { type: String, default: '' },
  userAgent: { type: String, default: '' },
  ip: { type: String, default: '' },

  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now, index: true },
  lastMessageAt: { type: Date, default: null, index: true }
});

ChatSessionSchema.pre('save', function setUpdated(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = wrapTenantModel(mongoose.model('ChatSession', ChatSessionSchema));

