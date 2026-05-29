/**
 * ============================================================================
 * PLATFORM CORE: Approval Instance Model (Process Engine Phase 3)
 * ============================================================================
 *
 * Source of truth for process approval gates. Tracks pending/approved/rejected
 * state, approvers, and decisions. Used for resume and audit.
 *
 * ============================================================================
 */

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const ApprovalInstanceSchema = new mongoose.Schema({
  approvalId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  processExecutionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProcessExecution',
    required: true,
    index: true
  },
  processId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Process',
    required: true,
    index: true
  },
  nodeId: {
    type: String,
    required: true,
    index: true
  },
  entityType: {
    type: String,
    trim: true,
    enum: ['people', 'organization', 'deal', 'quote'],
    default: null
  },
  entityId: {
    type: String,
    default: null,
    index: true
  },
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    default: null,
    index: true
  },
  /** Resolved user IDs who can approve (from config approvers) */
  approvers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'timed_out', 'escalated'],
    required: true,
    default: 'pending',
    index: true
  },
  decidedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  decidedAt: {
    type: Date,
    default: null
  },
  /** Rejection/timed-out reason if any */
  reason: {
    type: String,
    default: null
  },
  /** Escalation: new approvers after timeout */
  escalatedApprovers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  /** Timeout: when to escalate or fail */
  timeoutAt: {
    type: Date,
    default: null,
    index: true
  },
  /** Original config snapshot for audit */
  configSnapshot: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  }
}, {
  timestamps: true
});

ApprovalInstanceSchema.index({ processExecutionId: 1, nodeId: 1 }, { unique: true });
ApprovalInstanceSchema.index({ status: 1, timeoutAt: 1 });

module.exports = wrapTenantModel(mongoose.model('ApprovalInstance', ApprovalInstanceSchema));
