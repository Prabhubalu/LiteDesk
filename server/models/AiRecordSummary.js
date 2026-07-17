const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

/**
 * Cache for AI record summaries keyed by org + source + recordUpdatedAt.
 */
const AiRecordSummarySchema = new mongoose.Schema({
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
    enum: ['case', 'deal', 'people'],
    index: true,
  },
  sourceId: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  recordUpdatedAt: {
    type: Date,
    required: true,
  },
  text: {
    type: String,
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
}, {
  timestamps: true,
});

AiRecordSummarySchema.index(
  { organizationId: 1, sourceType: 1, sourceId: 1 },
  { unique: true }
);

module.exports = wrapTenantModel(mongoose.model('AiRecordSummary', AiRecordSummarySchema));
