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
    enum: ['trigger', 'condition', 'action', 'data_mapping', 'end', 'field_rule', 'ownership_rule', 'status_guard', 'approval_gate', 'wait', 'for_each', 'for_each_end'],
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
    /**
     * When true with an *.updated eventType, also match *.created for the same entity.
     * Used by core trigger "Record Update (includes Creation)".
     */
    includeCreated: {
      type: Boolean,
      default: false
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
  /**
   * When entry conditions fire the process (record-event triggers only; ignored for schedule):
   * - first_time: only the first time conditions are met for a record
   * - every_time: every time conditions are met
   */
  triggerBehaviour: {
    type: String,
    enum: ['first_time', 'every_time'],
    default: 'every_time'
  },
  /**
   * When false (default), skip domain-event runs if the record looks closed.
   * When true, allow the process to run on closed records as well.
   */
  includeClosedRecords: {
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
