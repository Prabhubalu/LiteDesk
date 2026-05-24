/**
 * ============================================================================
 * PLATFORM CORE: Process Invocation Service (Integration Layer)
 * ============================================================================
 *
 * Formal Process invocation API/service that provides a controlled integration
 * layer between Automation Rules and the Process Engine.
 *
 * This service:
 * - Initializes ProcessExecution
 * - Enforces Process Engine constraints
 * - Is reusable by Automation Engine, manual triggers, and Process Designer UI
 * - Supports input mapping from automation context to process dataBag
 *
 * ============================================================================
 */

const crypto = require('crypto');
const mongoose = require('mongoose');
const Process = require('../models/Process');
const ProcessExecution = require('../models/ProcessExecution');
const ApprovalInstance = require('../models/ApprovalInstance');
const { buildExecutionContext } = require('./processExecutionContext');
const { executeNode } = require('./processNodeHandlers');
const { createLogger } = require('./automationLogger');
const {
  findEdgeId,
  recordNodeEnter,
  finalizeLastNodeStep,
  recordNodeFailure,
  messageForNode
} = require('./processExecutionTracker');
const {
  resolveRunnableProcessForStart,
  resolveRunnableProcessForExecution
} = require('./processDefinitionVersionService');
const { appendProcessRecordActivity } = require('./processRecordActivity');

const log = createLogger('processInvocation');

async function logProcessOnRecord(process, execution, context, status, error = null) {
  await appendProcessRecordActivity({ process, execution, context, status, error });
}

/**
 * Validate process is active and trigger matches.
 *
 * @param {Object} process - Process document
 * @param {Object} triggerContext - Trigger context (event or manual params)
 * @returns {{ valid: boolean, error?: string }}
 */
function validateProcessTrigger(process, triggerContext) {
  if (!process) {
    return { valid: false, error: 'Process not found' };
  }

  if (process.status !== 'active') {
    return { valid: false, error: `Process status is ${process.status}, must be 'active'` };
  }

  // Validate trigger match
  if (process.trigger.type === 'domain_event') {
    if (!triggerContext.event) {
      return { valid: false, error: 'Process requires domain event trigger' };
    }
    if (process.trigger.eventType && triggerContext.event.eventType !== process.trigger.eventType) {
      return { valid: false, error: `Event type mismatch: expected ${process.trigger.eventType}, got ${triggerContext.event.eventType}` };
    }
  } else if (process.trigger.type === 'manual') {
    if (!triggerContext.manualParams) {
      return { valid: false, error: 'Process requires manual trigger parameters' };
    }
  } else if (process.trigger.type === 'webhook') {
    if (!triggerContext.webhookInvocation) {
      return { valid: false, error: 'Process requires webhook invocation' };
    }
  } else if (process.trigger.type === 'schedule') {
    if (triggerContext.event || triggerContext.manualParams || triggerContext.webhookInvocation) {
      return { valid: false, error: 'Scheduled processes cannot be started from domain events or manual API in this path' };
    }
    return { valid: false, error: 'Scheduled trigger requires the process schedule runner (not yet invoked here)' };
  } else {
    return { valid: false, error: `Unsupported trigger type: ${process.trigger.type}` };
  }

  return { valid: true };
}

/**
 * Check if execution already exists (idempotency).
 *
 * @param {string} executionId - Execution ID
 * @returns {Promise<boolean>}
 */
async function executionExists(executionId) {
  try {
    const existing = await ProcessExecution.findOne({ executionId }).lean();
    return !!existing;
  } catch {
    return false;
  }
}

/**
 * Find the starting node for a process.
 *
 * @param {Object} process - Process document
 * @returns {Object|null} - Starting ProcessNode
 */
function findStartNode(process) {
  const edges = process.edges || [];

  if (process.trigger.type === 'domain_event') {
    return process.nodes.find(n => n.type === 'trigger') || null;
  }

  if (process.trigger.type === 'schedule' || process.trigger.type === 'manual') {
    const sortedNodes = [...process.nodes].sort((a, b) => {
      if (a.order != null && b.order != null) return a.order - b.order;
      if (a.order != null) return -1;
      if (b.order != null) return 1;
      return 0;
    });
    const nonTrigger = sortedNodes.find((n) => n.type !== 'trigger');
    return nonTrigger || sortedNodes[0] || null;
  }

  if (process.trigger.type === 'webhook') {
    const triggerNode = process.nodes.find(n => n.type === 'trigger');
    if (triggerNode) {
      const nextId = findNextNode(triggerNode.id, edges);
      if (nextId) return process.nodes.find(n => n.id === nextId) || null;
    }
  }

  // For manual / webhook-without-trigger-node: first non-trigger or ordered node
  const sortedNodes = [...process.nodes].sort((a, b) => {
    if (a.order != null && b.order != null) return a.order - b.order;
    if (a.order != null) return -1;
    if (b.order != null) return 1;
    return 0;
  });

  const nonTrigger = sortedNodes.find(n => n.type !== 'trigger');
  return nonTrigger || sortedNodes[0] || null;
}

/**
 * Find next node(s) from current node using edges.
 *
 * @param {string} currentNodeId - Current node ID
 * @param {Array} edges - ProcessEdge[]
 * @returns {string|null} - Next node ID
 */
function findNextNode(currentNodeId, edges) {
  const outgoingEdges = edges.filter(e => e.fromNodeId === currentNodeId);
  return outgoingEdges.length > 0 ? outgoingEdges[0]?.toNodeId : null;
}

/**
 * Generate unique approval ID.
 * @returns {string}
 */
function generateApprovalId() {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : crypto.randomBytes(16).toString('hex');
}

/**
 * Run the execution loop from a given node. Used by startProcess and resumeProcess.
 *
 * @param {Object} process - Process document (lean)
 * @param {Object} execution - ProcessExecution document
 * @param {Object} context - ProcessExecutionContext
 * @param {{ startNode: Object, automationExecutionId?: string }} options
 * @returns {Promise<{ ok: boolean, executionId: string, paused?: boolean, approvalInstanceId?: string, error?: string }>}
 */
async function runExecutionLoop(process, execution, context, options) {
  const { startNode, automationExecutionId = null } = options;
  const nodeMap = new Map(process.nodes.map(n => [n.id, n]));
  const edges = process.edges || [];
  let currentNode = startNode;
  let executionComplete = false;
  let previousNodeId = null;

  while (!executionComplete && currentNode) {
    const edgeId = findEdgeId(edges, previousNodeId, currentNode.id);
    await recordNodeEnter(execution._id, { nodeId: currentNode.id, edgeId });

    const result = await executeNode(currentNode, context, edges);

    if (!result.ok) {
      await recordNodeFailure(execution._id, result.error || 'Node execution failed');
      await ProcessExecution.updateOne(
        { _id: execution._id },
        {
          status: 'failed',
          error: result.error || 'Node execution failed',
          completedAt: new Date(),
          currentNodeId: currentNode.id,
          dataBag: null,
          behaviorProposals: null,
          approvalInstanceId: null
        }
      );
      log.info('process_failed', {
        executionId: context.executionId,
        nodeId: currentNode.id,
        nodeType: currentNode.type,
        error: result.error,
        automationExecutionId: automationExecutionId?.toString()
      });
      await logProcessOnRecord(process, execution, context, 'failed', result.error);
      return { ok: false, error: result.error, executionId: context.executionId };
    }

    await finalizeLastNodeStep(execution._id, {
      status: 'completed',
      message: messageForNode(currentNode, result, process)
    });

    if (result.paused && currentNode.type === 'wait') {
      await ProcessExecution.updateOne(
        { _id: execution._id },
        {
          status: 'waiting_until',
          currentNodeId: currentNode.id,
          pausedNodeId: currentNode.id,
          resumeAt: result.resumeAt,
          dataBag: context.dataBag || null,
          behaviorProposals: context.behaviorProposals || null,
          approvalInstanceId: null
        }
      );

      log.info('process_waiting', {
        executionId: context.executionId,
        processId: process._id.toString(),
        nodeId: currentNode.id,
        resumeAt: result.resumeAt?.toISOString?.(),
        automationExecutionId: automationExecutionId?.toString()
      });

      await logProcessOnRecord(process, execution, context, 'waiting_until');

      return {
        ok: true,
        executionId: context.executionId,
        paused: true,
        resumeAt: result.resumeAt
      };
    }

    if (result.paused && currentNode.type === 'approval_gate') {
      const approvalId = generateApprovalId();
      const approval = await ApprovalInstance.create({
        approvalId,
        processExecutionId: execution._id,
        processId: process._id,
        nodeId: currentNode.id,
        entityType: context.entityType,
        entityId: context.entityId,
        organizationId: context.organizationId ? new mongoose.Types.ObjectId(context.organizationId) : null,
        approvers: (result.approverUserIds || []).map(id => new mongoose.Types.ObjectId(id)),
        status: 'pending',
        timeoutAt: result.timeoutAt || null,
        configSnapshot: result.configSnapshot || null
      });

      await ProcessExecution.updateOne(
        { _id: execution._id },
        {
          status: 'waiting_for_approval',
          currentNodeId: currentNode.id,
          dataBag: context.dataBag || null,
          behaviorProposals: context.behaviorProposals || null,
          approvalInstanceId: approval._id
        }
      );

      log.info('approval_requested', {
        executionId: context.executionId,
        approvalId,
        processId: process._id.toString(),
        nodeId: currentNode.id,
        approverCount: (result.approverUserIds || []).length,
        automationExecutionId: automationExecutionId?.toString()
      });

      await logProcessOnRecord(process, execution, context, 'waiting_for_approval');

      return {
        ok: true,
        executionId: context.executionId,
        paused: true,
        approvalInstanceId: approval._id.toString()
      };
    }

    if (currentNode.type === 'end' || result.terminated) {
      executionComplete = true;
      previousNodeId = currentNode.id;
      break;
    }

    let nextNodeId = result.nextNodeId ?? findNextNode(currentNode.id, edges);
    if (!nextNodeId) {
      executionComplete = true;
      previousNodeId = currentNode.id;
      break;
    }

    previousNodeId = currentNode.id;
    currentNode = nodeMap.get(nextNodeId);
    if (!currentNode) {
      const nextMissingError = `Next node not found: ${nextNodeId}`;
      await ProcessExecution.updateOne(
        { _id: execution._id },
        {
          status: 'failed',
          error: nextMissingError,
          completedAt: new Date(),
          dataBag: null,
          behaviorProposals: null,
          approvalInstanceId: null
        }
      );
      await logProcessOnRecord(process, execution, context, 'failed', nextMissingError);
      return { ok: false, error: nextMissingError, executionId: context.executionId };
    }
  }

  await ProcessExecution.updateOne(
    { _id: execution._id },
    {
      status: 'completed',
      currentNodeId: null,
      pausedNodeId: null,
      resumeAt: null,
      completedAt: new Date(),
      dataBag: null,
      behaviorProposals: null,
      approvalInstanceId: null
    }
  );

  log.info('process_completed', {
    executionId: context.executionId,
    processId: process._id.toString(),
    processName: process.name,
    automationExecutionId: automationExecutionId?.toString()
  });

  await logProcessOnRecord(process, execution, context, 'completed');

  return { ok: true, executionId: context.executionId };
}

/**
 * Start a process execution (formal invocation entry point).
 *
 * This method:
 * - Validates process exists and is active
 * - Validates trigger matches
 * - Enforces idempotency
 * - Initializes ProcessExecution
 * - Executes process nodes sequentially
 *
 * @param {Object} params
 * @param {string} params.processId - Process ID
 * @param {Object} [params.event] - Domain event (if triggered by event)
 * @param {Object} [params.manualParams] - Manual invocation params (if manual)
 * @param {Object} [params.inputMapping] - Key-value mapping to populate dataBag
 * @param {string} [params.automationExecutionId] - Automation execution ID (if started from automation)
 * @returns {Promise<{ ok: boolean, executionId?: string, error?: string }>}
 */
async function startProcess(params) {
  const {
    processId,
    event = null,
    manualParams = {},
    inputMapping = {},
    automationExecutionId = null,
    webhookInvocation = false,
    webhookDeliveryId = null
  } = params;

  try {
    const processDoc = await Process.findById(processId).lean();
    if (!processDoc) {
      return { ok: false, error: `Process not found: ${processId}` };
    }

    const { runnable: process, definition, error: resolveError } = await resolveRunnableProcessForStart(processDoc);
    if (resolveError) {
      return { ok: false, error: resolveError };
    }

    // Validate process trigger
    const validation = validateProcessTrigger(process, {
      event,
      manualParams,
      webhookInvocation
    });
    if (!validation.valid) {
      return { ok: false, error: validation.error };
    }

    // Build execution context
    const context = buildExecutionContext({
      processId: process._id.toString(),
      appKey: process.appKey,
      event,
      entityType: manualParams.entityType,
      entityId: manualParams.entityId,
      organizationId: manualParams.organizationId || event?.organizationId,
      triggeredBy: manualParams.triggeredBy || event?.triggeredBy,
      ownerId: manualParams.ownerId || event?.ownerId,
      webhookInvocation,
      webhookDeliveryId
    });
    if (webhookInvocation) {
      context.webhookInvocation = true;
    }

    // Apply input mapping to dataBag
    if (inputMapping && typeof inputMapping === 'object') {
      Object.assign(context.dataBag, inputMapping);
    }

    // Check idempotency
    const exists = await executionExists(context.executionId);
    if (exists) {
      log.info('process_execution_skipped', {
        executionId: context.executionId,
        reason: 'already_executed',
        automationExecutionId
      });
      return { ok: true, executionId: context.executionId, skipped: true };
    }

    // Create execution record
    const execution = await ProcessExecution.create({
      executionId: context.executionId,
      processId: processDoc._id,
      processDefinitionVersionId: definition?._id || null,
      processDefinitionVersionNumber: definition?.versionNumber ?? null,
      status: 'running',
      appKey: process.appKey,
      entityType: context.entityType,
      entityId: context.entityId,
      organizationId: context.organizationId ? new mongoose.Types.ObjectId(context.organizationId) : null,
      triggeredBy: context.triggeredBy ? new mongoose.Types.ObjectId(context.triggeredBy) : null,
      eventId: event?.eventId || null,
      automationExecutionId: automationExecutionId ? new mongoose.Types.ObjectId(automationExecutionId) : null,
      startedAt: new Date()
    });

    // Log process start (with automation context if applicable)
    const logData = {
      executionId: context.executionId,
      processId: process._id.toString(),
      processName: process.name,
      appKey: process.appKey,
      entityType: context.entityType,
      entityId: context.entityId
    };

    if (automationExecutionId) {
      log.info('process_started_from_automation', {
        ...logData,
        automationExecutionId: automationExecutionId.toString()
      });
    } else {
      log.info('process_started', logData);
    }

    // Find start node
    const startNode = findStartNode(process);
    if (!startNode) {
      await ProcessExecution.updateOne(
        { _id: execution._id },
        { status: 'failed', error: 'No start node found', completedAt: new Date() }
      );
      return { ok: false, error: 'No start node found' };
    }

    return await runExecutionLoop(process, execution, context, {
      startNode,
      automationExecutionId
    });
  } catch (err) {
    log.error('process_invocation_error', {
      processId,
      error: err.message,
      stack: err.stack,
      automationExecutionId: automationExecutionId?.toString()
    });

    // Try to update execution record if it exists
    try {
      const execution = await ProcessExecution.findOne({ executionId: `${processId}:${event?.eventId || 'manual'}` });
      if (execution) {
        await ProcessExecution.updateOne(
          { _id: execution._id },
          {
            status: 'failed',
            error: err.message,
            completedAt: new Date()
          }
        );
      }
    } catch {
      // Ignore update errors
    }

    return { ok: false, error: err.message };
  }
}

/**
 * Build execution context from a paused ProcessExecution (for resume).
 *
 * @param {Object} execution - ProcessExecution document (lean)
 * @param {Object} process - Process document (lean)
 * @returns {Object} ProcessExecutionContext
 */
function buildContextFromPausedExecution(execution, process) {
  const orgId = execution.organizationId?.toString?.() || execution.organizationId;
  const event = execution.eventId
    ? {
        eventId: execution.eventId,
        entityType: execution.entityType,
        entityId: execution.entityId,
        organizationId: orgId,
        triggeredBy: execution.triggeredBy
      }
    : null;

  return {
    executionId: execution.executionId,
    processId: execution.processId?.toString?.() || execution.processId,
    appKey: execution.appKey || process.appKey,
    entityType: execution.entityType,
    entityId: execution.entityId,
    organizationId: orgId,
    triggeredBy: execution.triggeredBy,
    ownerId: null,
    event,
    dataBag: execution.dataBag || {},
    behaviorProposals: execution.behaviorProposals || {
      fieldRules: [],
      ownershipRules: [],
      statusGuards: []
    }
  };
}

/**
 * Resume a process after approval (Phase 3).
 * Loads paused execution, continues from node after approval_gate.
 *
 * @param {Object} params
 * @param {string} params.approvalInstanceId - ApprovalInstance _id
 * @returns {Promise<{ ok: boolean, executionId?: string, error?: string }>}
 */
async function resumeProcess(params) {
  const { approvalInstanceId } = params;

  try {
    const approval = await ApprovalInstance.findById(approvalInstanceId).lean();
    if (!approval) {
      return { ok: false, error: 'Approval not found' };
    }
    if (approval.status !== 'approved') {
      return { ok: false, error: `Approval status is ${approval.status}, cannot resume` };
    }

    const execution = await ProcessExecution.findById(approval.processExecutionId).lean();
    if (!execution) {
      return { ok: false, error: 'Process execution not found' };
    }
    if (execution.status !== 'waiting_for_approval') {
      return { ok: false, error: `Execution status is ${execution.status}, cannot resume` };
    }
    if (String(execution.approvalInstanceId) !== String(approvalInstanceId)) {
      return { ok: false, error: 'Approval does not match execution' };
    }

    const processDoc = await Process.findById(execution.processId).lean();
    if (!processDoc) {
      return { ok: false, error: 'Process not found' };
    }
    if (processDoc.status !== 'active') {
      return { ok: false, error: `Process status is ${processDoc.status}, cannot resume` };
    }

    const process = await resolveRunnableProcessForExecution(processDoc, execution);
    const context = buildContextFromPausedExecution(execution, process);
    const nodeMap = new Map(process.nodes.map(n => [n.id, n]));
    const nextNodeId = findNextNode(approval.nodeId, process.edges || []);
    if (!nextNodeId) {
      await ProcessExecution.updateOne(
        { _id: execution._id },
        {
          status: 'completed',
          currentNodeId: null,
          completedAt: new Date(),
          dataBag: null,
          behaviorProposals: null,
          approvalInstanceId: null
        }
      );
      log.info('process_completed', {
        executionId: execution.executionId,
        processId: process._id.toString(),
        processName: process.name,
        note: 'resumed after approval; no next node'
      });
      await logProcessOnRecord(process, execution, context, 'completed');
      return { ok: true, executionId: execution.executionId };
    }

    const nextNode = nodeMap.get(nextNodeId);
    if (!nextNode) {
      return { ok: false, error: `Next node not found: ${nextNodeId}` };
    }

    await ProcessExecution.updateOne(
      { _id: execution._id },
      { status: 'running', approvalInstanceId: null }
    );

    log.info('process_resumed_after_approval', {
      executionId: execution.executionId,
      processId: process._id.toString(),
      approvalId: approval.approvalId,
      nodeId: approval.nodeId,
      nextNodeId
    });

    return await runExecutionLoop(process, execution, context, {
      startNode: nextNode,
      automationExecutionId: null
    });
  } catch (err) {
    log.error('resume_process_error', {
      approvalInstanceId,
      error: err.message,
      stack: err.stack
    });
    return { ok: false, error: err.message };
  }
}

/**
 * Resume a process after a wait node delay (Phase 3a).
 *
 * @param {Object} params
 * @param {string} params.executionMongoId - ProcessExecution _id
 * @returns {Promise<{ ok: boolean, executionId?: string, skipped?: boolean, error?: string }>}
 */
async function resumeProcessFromWait(params) {
  const { executionMongoId } = params;
  const now = new Date();

  try {
    const claimed = await ProcessExecution.findOneAndUpdate(
      {
        _id: executionMongoId,
        status: 'waiting_until',
        resumeAt: { $lte: now }
      },
      { $set: { status: 'running' } },
      { new: true }
    ).lean();

    if (!claimed) {
      return { ok: false, skipped: true, error: 'Execution not due or already resumed' };
    }

    const processDoc = await Process.findById(claimed.processId).lean();
    if (!processDoc) {
      await ProcessExecution.updateOne(
        { _id: claimed._id },
        { status: 'failed', error: 'Process not found', completedAt: new Date() }
      );
      return { ok: false, error: 'Process not found' };
    }
    if (processDoc.status !== 'active') {
      await ProcessExecution.updateOne(
        { _id: claimed._id },
        {
          status: 'failed',
          error: `Process status is ${processDoc.status}, cannot resume`,
          completedAt: new Date()
        }
      );
      return { ok: false, error: `Process status is ${processDoc.status}, cannot resume` };
    }

    const process = await resolveRunnableProcessForExecution(processDoc, claimed);
    const pausedNodeId = claimed.pausedNodeId || claimed.currentNodeId;
    const nextNodeId = findNextNode(pausedNodeId, process.edges || []);
    if (!nextNodeId) {
      await ProcessExecution.updateOne(
        { _id: claimed._id },
        {
          status: 'completed',
          currentNodeId: null,
          pausedNodeId: null,
          resumeAt: null,
          completedAt: new Date(),
          dataBag: null,
          behaviorProposals: null
        }
      );
      log.info('process_completed', {
        executionId: claimed.executionId,
        processId: process._id.toString(),
        note: 'resumed after wait; no next node'
      });
      const waitContext = buildContextFromPausedExecution(claimed, process);
      await logProcessOnRecord(process, claimed, waitContext, 'completed');
      return { ok: true, executionId: claimed.executionId };
    }

    const nodeMap = new Map(process.nodes.map((n) => [n.id, n]));
    const nextNode = nodeMap.get(nextNodeId);
    if (!nextNode) {
      return { ok: false, error: `Next node not found: ${nextNodeId}` };
    }

    const context = buildContextFromPausedExecution(claimed, process);

    log.info('process_resumed_after_wait', {
      executionId: claimed.executionId,
      processId: process._id.toString(),
      pausedNodeId,
      nextNodeId
    });

    return await runExecutionLoop(process, claimed, context, {
      startNode: nextNode,
      automationExecutionId: null
    });
  } catch (err) {
    log.error('resume_process_from_wait_error', {
      executionMongoId: executionMongoId?.toString?.(),
      error: err.message,
      stack: err.stack
    });
    return { ok: false, error: err.message };
  }
}

module.exports = {
  startProcess,
  resumeProcess,
  resumeProcessFromWait,
  validateProcessTrigger,
  findNextNode,
  runExecutionLoop
};
