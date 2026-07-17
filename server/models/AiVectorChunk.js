const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

/**
 * Canonical AI chunk row for retrieval (future-proof vector port).
 * Vectors may later move to Qdrant; metadata stays tenant-scoped in Mongo.
 */
const AiVectorChunkSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true,
  },
  sourceType: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  sourceId: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  chunkId: {
    type: String,
    required: true,
    trim: true,
  },
  chunkIndex: {
    type: Number,
    default: 0,
    min: 0,
  },
  text: {
    type: String,
    required: true,
  },
  embedding: {
    type: [Number],
    default: undefined,
  },
  embeddingModel: {
    type: String,
    trim: true,
    default: null,
  },
  contentHash: {
    type: String,
    trim: true,
    default: null,
    index: true,
  },
  embeddingVersion: {
    type: Number,
    default: 1,
    min: 1,
  },
  appKey: {
    type: String,
    trim: true,
    default: null,
  },
  moduleKey: {
    type: String,
    trim: true,
    default: null,
  },
}, {
  timestamps: true,
});

AiVectorChunkSchema.index(
  { organizationId: 1, chunkId: 1 },
  { unique: true }
);
AiVectorChunkSchema.index({ organizationId: 1, sourceType: 1, sourceId: 1 });
AiVectorChunkSchema.index({ organizationId: 1, embeddingVersion: 1 });

module.exports = wrapTenantModel(mongoose.model('AiVectorChunk', AiVectorChunkSchema));
