'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

/**
 * Per-user Arivu Assistant conversation threads (tenant-scoped).
 */
const AiConversationMessageSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, trim: true },
    role: { type: String, required: true, enum: ['user', 'assistant'] },
    body: { type: String, default: '' },
    structured: { type: mongoose.Schema.Types.Mixed, default: null },
    citations: { type: [mongoose.Schema.Types.Mixed], default: undefined },
    source: { type: String, trim: true, default: '' },
    meta: { type: mongoose.Schema.Types.Mixed, default: undefined },
    createdAt: { type: Number, default: () => Date.now() },
  },
  { _id: false },
);

const AiConversationSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      trim: true,
      maxlength: 120,
      default: 'New conversation',
    },
    messages: {
      type: [AiConversationMessageSchema],
      default: [],
    },
    moduleKey: { type: String, trim: true, default: '' },
    recordId: { type: String, trim: true, default: '' },
    contextLabel: { type: String, trim: true, default: '' },
    appKey: { type: String, trim: true, default: '' },
    messageCount: { type: Number, default: 0, index: true },
  },
  { timestamps: true },
);

AiConversationSchema.index({ organizationId: 1, userId: 1, updatedAt: -1 });

module.exports = wrapTenantModel(mongoose.model('AiConversation', AiConversationSchema));
