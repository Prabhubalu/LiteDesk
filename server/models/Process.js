/**
 * ============================================================================
 * PLATFORM CORE: Process Model (Process Engine Step 0)
 * ============================================================================
 *
 * Represents a single executable flow. Defines structure, not behavior logic.
 * A Process is a graph of nodes connected by edges, executed sequentially.
 *
 * ============================================================================
 */

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const ProcessNodeLayoutSchema = new mongoose.Schema({
  x: { type: Number, default: null },
  y: { type: Number, default: null }
}, { _id: false });

const ProcessNodeMetaSchema = new mongoose.Schema({
  color: { type: String, default: null },
  icon: { type: String, default: null },
  notes: { type: String, default: null },
  tags: { type: [String], default: [] }
}, { _id: false });

const ProcessNodeSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['trigger', 'condition', 'action', 'data_mapping', 'end', 'field_rule', 'ownership_rule', 'status_guard', 'approval_gate', 'wait'],
    required: true
  },
  config: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  version: {
    type: Number,
    default: 1
  },
  layout: {
    type: ProcessNodeLayoutSchema,
    default: null
  },
  meta: {
    type: ProcessNodeMetaSchema,
    default: () => ({})
  },
  order: {
    type: Number,
    default: null
  }
}, { _id: false });

const ProcessEdgeSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  fromNodeId: {
    type: String,
    required: true
  },
  toNodeId: {
    type: String,
    required: true
  },
  condition: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  }
}, { _id: false });

const ProcessSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true,
    required: true
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  appKey: {
    type: String,
    trim: true,
    uppercase: true,
    required: true,
    index: true
  },
  /** Target module: people | organization | deal | quote */
  entityType: {
    type: String,
    trim: true,
    lowercase: true,
    default: null
  },
  trigger: {
    type: {
      type: String,
      enum: ['domain_event', 'manual', 'webhook', 'schedule'],
      required: true
    },
    eventType: {
      type: String,
      trim: true,
      default: null
    },
    webhookKey: {
      type: String,
      trim: true,
      default: null,
      index: true,
      sparse: true
    },
    secretHash: {
      type: String,
      default: null
    },
    version: {
      type: Number,
      default: 1
    },
    /** v1: { dataBagKey: 'body.fieldPath' } */
    payloadMapping: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({})
    },
    /** record_updated: { mode: 'any' | 'fields', fields: string[] } */
    updateWatch: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    /** schedule: { preset, hour, minute, dayOfWeek, timezone } */
    schedule: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    }
  },
  /** False until user picks a “Starts when” option in the designer */
  triggerConfigured: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'archived'],
    default: 'draft',
    index: true
  },
  version: {
    type: Number,
    default: 0
  },
  /** Latest published definition used for new runs (set on activate) */
  activeDefinitionVersionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProcessDefinitionVersion',
    default: null,
    index: true
  },
  nodes: {
    type: [ProcessNodeSchema],
    default: []
  },
  edges: {
    type: [ProcessEdgeSchema],
    default: []
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
ProcessSchema.index({ appKey: 1, status: 1 });
ProcessSchema.index({ 'trigger.type': 1, 'trigger.eventType': 1, status: 1 });

module.exports = wrapTenantModel(mongoose.model('Process', ProcessSchema));
