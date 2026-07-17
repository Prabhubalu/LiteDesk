const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const AiAuditLogSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
    default: null,
    index: true,
  },
  abilityKey: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  provider: {
    type: String,
    required: true,
    trim: true,
  },
  model: {
    type: String,
    required: true,
    trim: true,
  },
  keyMode: {
    type: String,
    enum: ['platform', 'byok'],
    required: true,
  },
  promptVersion: {
    type: String,
    trim: true,
    default: 'v0',
  },
  status: {
    type: String,
    enum: ['success', 'failed', 'not_configured'],
    required: true,
    index: true,
  },
  contextRefs: [{
    sourceType: { type: String, trim: true },
    sourceId: { type: String, trim: true },
    appKey: { type: String, trim: true },
    moduleKey: { type: String, trim: true },
  }],
  usage: {
    promptTokens: { type: Number, default: 0 },
    completionTokens: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 },
  },
  creditsDebited: {
    type: Number,
    default: 0,
    min: 0,
  },
  latencyMs: {
    type: Number,
    default: 0,
    min: 0,
  },
  errorCode: {
    type: String,
    trim: true,
    default: null,
  },
  errorMessage: {
    type: String,
    trim: true,
    default: null,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
}, {
  timestamps: true,
});

AiAuditLogSchema.index({ organizationId: 1, createdAt: -1 });
AiAuditLogSchema.index({ organizationId: 1, abilityKey: 1, createdAt: -1 });

module.exports = wrapTenantModel(mongoose.model('AiAuditLog', AiAuditLogSchema));
