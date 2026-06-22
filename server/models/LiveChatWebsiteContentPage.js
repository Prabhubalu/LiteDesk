const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const LiveChatWebsiteContentPageSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, index: true, required: true },

  pageKey: { type: String, trim: true, lowercase: true, required: true, index: true },
  title: { type: String, trim: true, required: true },
  body: { type: String, trim: true, default: '' },
  /** Optional URL path prefix to prioritize this page when visitor pageUrl matches. */
  matchPath: { type: String, trim: true, default: '' },

  enabled: { type: Boolean, default: true, index: true },
  order: { type: Number, default: 0, index: true },

  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now },
});

LiveChatWebsiteContentPageSchema.index({ organizationId: 1, pageKey: 1 }, { unique: true });

LiveChatWebsiteContentPageSchema.pre('save', function setUpdated(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = wrapTenantModel(mongoose.model('LiveChatWebsiteContentPage', LiveChatWebsiteContentPageSchema));
