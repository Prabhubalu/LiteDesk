const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const LiveChatBotSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, index: true, required: true },

  botKey: { type: String, trim: true, lowercase: true, required: true, index: true },
  name: { type: String, trim: true, required: true },
  description: { type: String, trim: true, default: '' },

  enabled: { type: Boolean, default: true, index: true },
  isDefault: { type: Boolean, default: false, index: true },
  greetingMessage: { type: String, trim: true, default: '' },

  useKnowledgeBase: { type: Boolean, default: true },
  useWebsiteContent: { type: Boolean, default: true },
  knowledgeDocumentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Document' }],
  websiteContentPageIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'LiveChatWebsiteContentPage' }],

  fallbackMessage: {
    type: String,
    trim: true,
    default: 'I could not find an answer. Connecting you with an agent.',
  },
  confidenceMinScore: { type: Number, default: 2 },

  /** Optional Process Designer recipe key for bot flows (LC5). */
  processRecipeKey: { type: String, trim: true, default: '' },

  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now },
});

LiveChatBotSchema.index({ organizationId: 1, botKey: 1 }, { unique: true });

LiveChatBotSchema.pre('save', function setUpdated(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = wrapTenantModel(mongoose.model('LiveChatBot', LiveChatBotSchema));
