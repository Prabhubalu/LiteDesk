/**
 * ============================================================================
 * PLATFORM CORE: Process Execution Model (Process Engine Step 0)
 * ============================================================================
 *
 * Persists process execution for observability and auditability.
 * Tracks execution state, current node, and errors.
 *
 * ============================================================================
 */

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const ProcessExecutionStepSchema = new mongoose.Schema({
  nodeId: { type: String, required: true },
  edgeId: { type: String, default: null },
  status: {
    type: String,
    enum: ['completed', 'failed', 'skipped'],
    required: true
  },
  startedAt: { type: Date, required: true },
  endedAt: { type: Date, default: null },
  durationMs: { type: Number, default: 0 },
  message: { type: String, default: null },
  technicalDetail: { type: String, default: null }
}, { _id: false });

const ProcessExecutionSchema = new mongoose.Schema({
  executionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  processId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Process',
    required: true,
    index: true
  },
  processDefinitionVersionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProcessDefinitionVersion',
    default: null,
    index: true
  },
  processDefinitionVersionNumber: {
    type: Number,
    default: null
  },
  status: {
    type: String,
    enum: ['running', 'waiting_for_approval', 'waiting_until', 'completed', 'failed'],
    required: true,
    default: 'running',
    index: true
  },
  currentNodeId: {
    type: String,
    default: null
  },
  /** Node id where execution paused (wait or approval) */
  pausedNodeId: {
    type: String,
    default: null
  },
  /** Resume after this time (wait nodes) */
  resumeAt: {
    type: Date,
    default: null,
    index: true
  },
  error: {
    type: String,
    default: null
  },
  appKey: {
    type: String,
    trim: true,
    uppercase: true,
    required: true,
    index: true
  },
  entityType: {
    type: String,
    trim: true,
    default: null
  },
  entityId: {
    type: String,
    default: null
  },
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    default: null,
    index: true
  },
  triggeredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  eventId: {
    type: String,
    default: null,
    index: true
  },
  automationExecutionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AutomationExecution',
    default: null,
    index: true
  },
  startedAt: {
    type: Date,
    required: true,
    default: Date.now
  },
  completedAt: {
    type: Date,
    default: null
  },
  /** Persisted when paused at approval_gate for deterministic resume (Phase 3) */
  dataBag: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  behaviorProposals: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  /** ApprovalInstance ID when status is waiting_for_approval (Phase 3) */
  approvalInstanceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ApprovalInstance',
    default: null,
    index: true
  },
  /** Ordered node IDs visited during this run */
  executionPath: {
    type: [String],
    default: []
  },
  /** Per-node audit trail for designer overlay */
  nodeSteps: {
    type: [ProcessExecutionStepSchema],
    default: []
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
ProcessExecutionSchema.index({ processId: 1, eventId: 1 }, { unique: true });
ProcessExecutionSchema.index({ organizationId: 1, status: 1 });
ProcessExecutionSchema.index({ entityType: 1, entityId: 1 });
ProcessExecutionSchema.index({ status: 1, resumeAt: 1 });

module.exports = wrapTenantModel(mongoose.model('ProcessExecution', ProcessExecutionSchema));
