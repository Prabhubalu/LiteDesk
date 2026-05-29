/**
 * ============================================================================
 * PLATFORM CORE: Approval Controller (Process Engine Phase 3)
 * ============================================================================
 *
 * Approval decision API: approve / reject.
 * Caller must be an authorized approver. Emits domain events.
 *
 * ============================================================================
 */

const mongoose = require('mongoose');
const ApprovalInstance = require('../models/ApprovalInstance');
const ProcessExecution = require('../models/ProcessExecution');
const { resumeProcess } = require('../services/processInvocation');
const { createLogger } = require('../services/automationLogger');
const { emit: emitDomainEvent } = require('../services/domainEvents');
const { applyProcessDecisionToQuote } = require('../services/quoteApprovalProcessService');

const log = createLogger('approvalController');
const Process = require('../models/Process');
const User = require('../models/User');

/**
 * Assert caller is an authorized approver. Hard-fail if not.
 *
 * @param {Object} approval - ApprovalInstance (lean)
 * @param {string} userId - Caller user ID
 * @returns {{ authorized: boolean, error?: string }}
 */
function assertAuthorizedApprover(approval, userId) {
  if (!userId) {
    return { authorized: false, error: 'Authentication required' };
  }
  const uid = userId.toString ? userId.toString() : String(userId);
  const approverIds = (approval.approvers || []).map(a => {
    const v = a && (a._id ? a._id : a);
    return v && v.toString ? v.toString() : String(v);
  });
  if (!approverIds.some(id => id === uid)) {
    return { authorized: false, error: 'Unauthorized: you are not an approver for this request' };
  }
    return { authorized: true };
}

/**
 * @route   GET /api/approvals
 * @desc    Get pending approvals for current user
 * @access  Private
 */
exports.getMyApprovals = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const approvals = await ApprovalInstance.find({
      organizationId: req.user.organizationId,
      status: 'pending',
      approvers: { $in: [userId] }
    })
      .populate('processId', 'name')
      .populate('processExecutionId', 'executionId entityType entityId triggeredBy startedAt')
      .populate('approvers', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .lean();

    const enriched = await Promise.all(approvals.map(async (a) => {
      const entity = a.entityType && a.entityId ? await getEntitySnapshot(a.entityType, a.entityId) : null;
      return {
        ...a,
        entitySnapshot: entity,
        dueIn: a.timeoutAt ? Math.max(0, Math.floor((a.timeoutAt - new Date()) / (1000 * 60 * 60))) : null
      };
    }));

    res.json({
      success: true,
      data: enriched,
      count: enriched.length
    });
  } catch (error) {
    log.error('get_my_approvals_error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error fetching approvals',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/approvals/:id
 * @desc    Get single approval with full context
 * @access  Private
 */
exports.getApprovalById = async (req, res) => {
  try {
    const approvalId = req.params.id;
    const approval = await ApprovalInstance.findById(approvalId)
      .populate('processId', 'name description appKey')
      .populate('processExecutionId', 'executionId entityType entityId triggeredBy startedAt')
      .populate('decidedBy', 'firstName lastName email')
      .populate('approvers', 'firstName lastName email')
      .lean();

    if (!approval) {
      return res.status(404).json({ success: false, message: 'Approval not found' });
    }

    if (approval.organizationId && String(approval.organizationId) !== String(req.user.organizationId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const entity = approval.entityType && approval.entityId
      ? await getEntitySnapshot(approval.entityType, approval.entityId)
      : null;

    const process = approval.processId;
    const impactPreview = await generateImpactPreview(approval, process);

    res.json({
      success: true,
      data: {
        ...approval,
        entitySnapshot: entity,
        impactPreview,
        dueIn: approval.timeoutAt ? Math.max(0, Math.floor((approval.timeoutAt - new Date()) / (1000 * 60 * 60))) : null
      }
    });
  } catch (error) {
    log.error('get_approval_error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error fetching approval',
      error: error.message
    });
  }
};

/**
 * Get entity snapshot for display.
 */
async function getEntitySnapshot(entityType, entityId) {
  try {
    if (entityType === 'deal') {
      const Deal = require('../models/Deal');
      const deal = await Deal.findById(entityId).select('name value stage pipeline').lean();
      return deal ? { type: 'deal', name: deal.name, value: deal.value, stage: deal.stage, pipeline: deal.pipeline } : null;
    } else if (entityType === 'people') {
      const People = require('../models/People');
      const person = await People.findById(entityId).select('firstName lastName email').lean();
      return person ? { type: 'people', name: `${person.firstName || ''} ${person.lastName || ''}`.trim() || person.email, email: person.email } : null;
    } else if (entityType === 'organization') {
      const Organization = require('../models/Organization');
      const org = await Organization.findById(entityId).select('name').lean();
      return org ? { type: 'organization', name: org.name } : null;
    } else if (entityType === 'quote') {
      const Quote = require('../models/Quote');
      const quote = await Quote.findById(entityId)
        .select('quoteNumber quoteTitle status grandTotal currency revisionNumber')
        .lean();
      return quote
        ? {
            type: 'quote',
            name: quote.quoteTitle || quote.quoteNumber || 'Quote',
            quoteNumber: quote.quoteNumber,
            status: quote.status,
            grandTotal: quote.grandTotal,
            currency: quote.currency,
            revisionNumber: quote.revisionNumber
          }
        : null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Generate human-readable impact preview from process context.
 */
async function generateImpactPreview(approval, process) {
  if (!process || !approval.configSnapshot) {
    return {
      ifApproved: ['Process will continue'],
      ifRejected: ['Action will be blocked']
    };
  }

  const config = approval.configSnapshot;
  const nodeMap = new Map(process.nodes.map(n => [n.id, n]));
  const edges = process.edges || [];
  
  // Find next node after approval_gate
  const nextNodeId = edges.find(e => e.fromNodeId === approval.nodeId)?.toNodeId;
  const nextNode = nextNodeId ? nodeMap.get(nextNodeId) : null;

  const ifApproved = [];
  const ifRejected = [];

  // If approved: what happens next
  if (config.onApprove === 'continue' && nextNode) {
    if (nextNode.type === 'action') {
      const actionType = nextNode.config?.actionType;
      if (actionType === 'create_task') {
        ifApproved.push(`Task will be created: "${nextNode.config.params?.title || 'Untitled'}"`);
      } else if (actionType === 'notify_user') {
        ifApproved.push(`Notification will be sent`);
      } else if (actionType === 'start_process') {
        ifApproved.push(`Process will continue`);
      } else {
        ifApproved.push(`Action will execute`);
      }
    } else if (nextNode.type === 'field_rule') {
      const rule = nextNode.config?.rule;
      const fieldKey = nextNode.config?.fieldKey;
      if (rule === 'mandatory') {
        ifApproved.push(`Field "${fieldKey}" will become mandatory`);
      } else if (rule === 'default') {
        ifApproved.push(`Field "${fieldKey}" will be set to default value`);
      }
    } else if (nextNode.type === 'status_guard') {
      ifApproved.push(`Status transition will be controlled`);
    } else {
      ifApproved.push(`Process will continue`);
    }
  } else {
    ifApproved.push('Process will continue');
  }

  // If rejected: what gets blocked
  if (config.onReject === 'fail') {
    ifRejected.push('Action will be blocked');
    ifRejected.push('Process will stop');
  } else {
    ifRejected.push('Action will be blocked');
  }

  return { ifApproved, ifRejected };
}

/**
 * @route   POST /api/admin/approvals/:id/approve
 * @desc    Approve an approval gate (Phase 3)
 * @access  Private (admin or approver)
 */
exports.approve = async (req, res) => {
  try {
    const approvalId = req.params.id;
    const userId = req.user?._id;

    const approval = await ApprovalInstance.findById(approvalId).lean();
    if (!approval) {
      return res.status(404).json({ success: false, message: 'Approval not found' });
    }
    if (approval.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Approval already ${approval.status}. Cannot approve twice.`
      });
    }

    const auth = assertAuthorizedApprover(approval, userId);
    if (!auth.authorized) {
      return res.status(403).json({ success: false, message: auth.error });
    }

    await ApprovalInstance.updateOne(
      { _id: approval._id },
      {
        status: 'approved',
        decidedBy: new mongoose.Types.ObjectId(userId),
        decidedAt: new Date(),
        reason: null
      }
    );

    log.info('approval_approved', {
      approvalId: approval.approvalId,
      processExecutionId: approval.processExecutionId?.toString(),
      nodeId: approval.nodeId,
      decidedBy: userId?.toString()
    });

    emitDomainEvent({
      entityType: 'approval',
      entityId: approval.approvalId,
      eventType: 'approval.approved',
      previousState: { status: 'pending' },
      currentState: { status: 'approved', decidedBy: userId },
      organizationId: approval.organizationId,
      triggeredBy: userId
    });

    const resume = await resumeProcess({ approvalInstanceId: approvalId });
    if (!resume.ok) {
      return res.status(500).json({
        success: false,
        message: resume.error || 'Process resume failed'
      });
    }

    let quoteSync = null;
    if (approval.entityType === 'quote') {
      try {
        quoteSync = await applyProcessDecisionToQuote({
          approval,
          decision: 'approved',
          userId
        });
      } catch (syncErr) {
        log.error('quote_approval_sync_error', { approvalId: approval.approvalId, error: syncErr.message });
      }
    }

    return res.json({
      success: true,
      data: {
        approvalId: approval.approvalId,
        executionId: resume.executionId,
        resumed: !resume.paused,
        quoteUpdated: quoteSync?.applied === true
      },
      message: 'Approved and process resumed'
    });
  } catch (error) {
    log.error('approval_approve_error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error approving request',
      error: error.message
    });
  }
};

/**
 * @route   POST /api/admin/approvals/:id/reject
 * @desc    Reject an approval gate (Phase 3)
 * @access  Private (admin or approver)
 */
exports.reject = async (req, res) => {
  try {
    const approvalId = req.params.id;
    const userId = req.user?._id;
    const { reason } = req.body || {};

    const approval = await ApprovalInstance.findById(approvalId).lean();
    if (!approval) {
      return res.status(404).json({ success: false, message: 'Approval not found' });
    }
    if (approval.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Approval already ${approval.status}. Cannot reject twice.`
      });
    }

    const auth = assertAuthorizedApprover(approval, userId);
    if (!auth.authorized) {
      return res.status(403).json({ success: false, message: auth.error });
    }

    await ApprovalInstance.updateOne(
      { _id: approval._id },
      {
        status: 'rejected',
        decidedBy: new mongoose.Types.ObjectId(userId),
        decidedAt: new Date(),
        reason: reason || 'Rejected by approver'
      }
    );

    const exec = await ProcessExecution.findById(approval.processExecutionId);
    if (exec && exec.status === 'waiting_for_approval') {
      await ProcessExecution.updateOne(
        { _id: exec._id },
        {
          status: 'failed',
          error: `Approval rejected${reason ? `: ${reason}` : ''}`,
          completedAt: new Date(),
          dataBag: null,
          behaviorProposals: null,
          approvalInstanceId: null
        }
      );
    }

    log.info('approval_rejected', {
      approvalId: approval.approvalId,
      processExecutionId: approval.processExecutionId?.toString(),
      nodeId: approval.nodeId,
      decidedBy: userId?.toString(),
      reason: reason || null
    });

    emitDomainEvent({
      entityType: 'approval',
      entityId: approval.approvalId,
      eventType: 'approval.rejected',
      previousState: { status: 'pending' },
      currentState: { status: 'rejected', decidedBy: userId, reason: reason || null },
      organizationId: approval.organizationId,
      triggeredBy: userId
    });

    let quoteSync = null;
    if (approval.entityType === 'quote') {
      try {
        quoteSync = await applyProcessDecisionToQuote({
          approval,
          decision: 'rejected',
          userId,
          comment: reason || null
        });
      } catch (syncErr) {
        log.error('quote_approval_sync_error', { approvalId: approval.approvalId, error: syncErr.message });
      }
    }

    return res.json({
      success: true,
      data: { approvalId: approval.approvalId, quoteUpdated: quoteSync?.applied === true },
      message: 'Rejected and process failed'
    });
  } catch (error) {
    log.error('approval_reject_error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error rejecting request',
      error: error.message
    });
  }
};
