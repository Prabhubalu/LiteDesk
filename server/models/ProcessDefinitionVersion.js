/**
 * Immutable published snapshot of a process graph (activate / publish).
 */

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const ProcessDefinitionSnapshotSchema = new mongoose.Schema({
  trigger: { type: mongoose.Schema.Types.Mixed, required: true },
  nodes: { type: mongoose.Schema.Types.Mixed, default: [] },
  edges: { type: mongoose.Schema.Types.Mixed, default: [] },
  appKey: { type: String, trim: true, uppercase: true },
  entityType: { type: String, trim: true, lowercase: true }
}, { _id: false });

const ProcessDefinitionVersionSchema = new mongoose.Schema({
  processId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Process',
    required: true,
    index: true
  },
  versionNumber: {
    type: Number,
    required: true,
    min: 1
  },
  snapshot: {
    type: ProcessDefinitionSnapshotSchema,
    required: true
  },
  publishedAt: {
    type: Date,
    required: true,
    default: Date.now
  },
  publishedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
});

ProcessDefinitionVersionSchema.index({ processId: 1, versionNumber: 1 }, { unique: true });

module.exports = wrapTenantModel(mongoose.model('ProcessDefinitionVersion', ProcessDefinitionVersionSchema));
