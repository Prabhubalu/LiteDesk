const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

/**
 * AI response cache with exact + semantic (embedding) lookup.
 * Exact: organizationId + abilityKey + cacheKey
 * Semantic: same scope (record/agent/model) + cosine(questionEmbedding) >= threshold
 * Invalidated when primary recordUpdatedAt changes; TTL safety net.
 */
const AiResponseCacheSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true,
  },
  abilityKey: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  cacheKey: {
    type: String,
    required: true,
    trim: true,
  },
  /** Scope without question — lists semantic candidates for the same record/agent/model. */
  scopeKey: {
    type: String,
    trim: true,
    default: null,
    index: true,
  },
  moduleKey: {
    type: String,
    trim: true,
    default: null,
  },
  recordId: {
    type: String,
    trim: true,
    default: null,
    index: true,
  },
  agentId: {
    type: String,
    trim: true,
    default: null,
    index: true,
  },
  recordUpdatedAt: {
    type: Date,
    default: null,
  },
  questionText: {
    type: String,
    trim: true,
    default: null,
  },
  questionEmbedding: {
    type: [Number],
    default: undefined,
  },
  embeddingModel: {
    type: String,
    trim: true,
    default: null,
  },
  payload: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  provider: {
    type: String,
    trim: true,
    default: 'unknown',
  },
  model: {
    type: String,
    trim: true,
    default: 'unknown',
  },
  keyMode: {
    type: String,
    enum: ['platform', 'byok'],
    default: 'platform',
  },
  expiresAt: {
    type: Date,
    required: true,
  },
}, {
  timestamps: true,
});

AiResponseCacheSchema.index(
  { organizationId: 1, abilityKey: 1, cacheKey: 1 },
  { unique: true }
);
AiResponseCacheSchema.index({ organizationId: 1, abilityKey: 1, scopeKey: 1, expiresAt: 1 });
// TTL: Mongo purges expired rows automatically.
AiResponseCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = wrapTenantModel(mongoose.model('AiResponseCache', AiResponseCacheSchema));
