const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const Schema = mongoose.Schema;

const ImportHistorySchema = new Schema({
  organizationId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
    // index: true removed - using compound indexes below instead
  },
  module: {
    type: String,
    enum: ['contacts', 'deals', 'tasks', 'organizations'],
    required: true
    // index: true removed - using compound indexes below instead
  },
  fileName: {
    type: String,
    required: true
  },
  importedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['processing', 'completed', 'failed', 'partial'],
    default: 'processing'
    // index: true removed - using compound indexes below instead
  },
  stats: {
    total: { type: Number, default: 0 },
    processed: { type: Number, default: 0 },
    created: { type: Number, default: 0 },
    updated: { type: Number, default: 0 },
    skipped: { type: Number, default: 0 },
    failed: { type: Number, default: 0 }
  },
  recordIds: {
    created: [{ type: Schema.Types.ObjectId }],
    updated: [{ type: Schema.Types.ObjectId }]
  },
  importErrors: [{
    row: Number,
    error: String
  }], // Renamed from 'errors' to avoid reserved pathname warning
  duplicateCheckEnabled: {
    type: Boolean,
    default: true
  },
  duplicateCheckFields: [String],
  duplicateAction: {
    type: String,
    enum: ['skip', 'update', 'import-all'],
    default: 'skip'
  },
  processingTime: {
    type: Number, // milliseconds
    default: 0
  },
  storagePath: {
    type: String,
    default: null
  },
  jobState: {
    batchSize: { type: Number, default: 500 },
    lastProcessedRow: { type: Number, default: 0 },
    enqueuedAt: { type: Date, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    workerId: { type: String, default: null }
  },
  metadata: {
    csvHeaders: [String],
    fieldMapping: Schema.Types.Mixed,
    totalRows: Number,
    source: {
      type: String,
      enum: ['inline', 'staging', 'upload'],
      default: 'inline'
    },
    recordIdsTruncated: { type: Boolean, default: false },
    deleteFileAfterImport: { type: Boolean, default: true }
  }
}, { 
  timestamps: true 
});

// Indexes for efficient querying
ImportHistorySchema.index({ organizationId: 1, module: 1 });
ImportHistorySchema.index({ organizationId: 1, importedBy: 1 });
ImportHistorySchema.index({ organizationId: 1, status: 1 });
ImportHistorySchema.index({ createdAt: -1 });

// Virtual for success rate
ImportHistorySchema.virtual('successRate').get(function() {
  if (this.stats.total === 0) return 0;
  return ((this.stats.created + this.stats.updated) / this.stats.total * 100).toFixed(2);
});

// Ensure virtuals are included in JSON
ImportHistorySchema.set('toJSON', { virtuals: true });
ImportHistorySchema.set('toObject', { virtuals: true });

module.exports = wrapTenantModel(mongoose.model('ImportHistory', ImportHistorySchema));

