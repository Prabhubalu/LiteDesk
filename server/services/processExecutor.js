/**
 * ============================================================================
 * PLATFORM CORE: Process Executor (Process Engine Step 0)
 * ============================================================================
 *
 * Deterministic process executor that can:
 * - Accept domain event or manual invocation triggers
 * - Load active Process definition
 * - Initialize ProcessExecutionContext
 * - Execute nodes sequentially
 * - Traverse graph using edges
 * - Stop execution at end node
 *
 * Execution Rules (MUST BE ENFORCED):
 * - Sequential execution only
 * - One node executes at a time
 * - Deterministic replay from logs
 * - Failure stops the process immediately
 *
 * ============================================================================
 */

const mongoose = require('mongoose');
const Process = require('../models/Process');
const ProcessExecution = require('../models/ProcessExecution');
const { buildExecutionContext } = require('./processExecutionContext');
const { executeNode } = require('./processNodeHandlers');
const {
  snapshotRecordBinding,
  restoreRecordBinding,
  bindFetchedRecord,
  findForEachEndNodeId
} = require('../utils/processForEachControl');
const { createLogger } = require('./automationLogger');
const { subscribe } = require('./domainEvents');
const { startProcess } = require('./processInvocation');

const log = createLogger('processExecutor');

let initialized = false;

/**
 * Validate process structure and constraints.
 *
 * @param {Object} process - Process document
 * @returns {{ valid: boolean, error?: string }}
 */
function validateProcess(process) {
  if (!process) {
    return { valid: false, error: 'Process not found' };
  }

  if (process.status !== 'active') {
    return { valid: false, error: `Process status is ${process.status}, must be 'active'` };
  }

  if (!process.nodes || process.nodes.length === 0) {
    return { valid: false, error: 'Process has no nodes' };
  }

  // Validate node types
  const validNodeTypes = [
    'trigger', 'condition', 'action', 'data_mapping', 'end',
    'field_rule', 'ownership_rule', 'status_guard', 'approval_gate', 'wait',
    'for_each', 'for_each_end'
  ];
  for (const node of process.nodes) {
    if (!validNodeTypes.includes(node.type)) {
      return { valid: false, error: `Unsupported node type: ${node.type}` };
    }
  }

  // Validate edges reference valid nodes
  const nodeIds = new Set(process.nodes.map(n => n.id));
  for (const edge of process.edges || []) {
    if (!nodeIds.has(edge.fromNodeId)) {
      return { valid: false, error: `Edge references invalid fromNodeId: ${edge.fromNodeId}` };
    }
    if (!nodeIds.has(edge.toNodeId)) {
      return { valid: false, error: `Edge references invalid toNodeId: ${edge.toNodeId}` };
    }
  }

  // Validate trigger node exists and matches trigger type
  if (process.trigger.type === 'domain_event') {
    if (!process.trigger.eventType) {
      return { valid: false, error: 'Domain event trigger requires eventType' };
    }
    const triggerNode = process.nodes.find(n => n.type === 'trigger');
    if (!triggerNode) {
      return { valid: false, error: 'Process with domain_event trigger must have a trigger node' };
    }
  }

  if (process.trigger.type === 'webhook') {
    if (!process.trigger.webhookKey) {
      return { valid: false, error: 'Webhook trigger requires webhookKey' };
    }
    if (!process.trigger.secretHash) {
      return { valid: false, error: 'Webhook trigger requires a configured secret' };
    }
    const triggerNode = process.nodes.find(n => n.type === 'trigger');
    if (!triggerNode) {
      return { valid: false, error: 'Process with webhook trigger must have a trigger node' };
    }
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

  if (process.trigger.type === 'webhook') {
    const triggerNode = process.nodes.find(n => n.type === 'trigger');
    if (triggerNode) {
      const nextId = findNextNode(triggerNode.id, edges);
      if (nextId) return process.nodes.find(n => n.id === nextId) || null;
    }
  }

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
 * @param {Object} conditionResult - Result from condition node (if applicable)
 * @returns {string|null} - Next node ID
 */
function findNextNode(currentNodeId, edges, conditionResult = null) {
  const outgoingEdges = edges.filter(e => e.fromNodeId === currentNodeId);

  if (outgoingEdges.length === 0) {
    return null;
  }

  // If condition result provided, use it to choose edge
  if (conditionResult !== null) {
    const matchingEdge = outgoingEdges.find(e => {
      if (e.condition === true || e.condition === 'true') return conditionResult === true;
      if (e.condition === false || e.condition === 'false') return conditionResult === false;
      return e.condition == null; // Default edge
    });
    return matchingEdge?.toNodeId || outgoingEdges[0]?.toNodeId || null;
  }

  // Default: use first edge
  return outgoingEdges[0]?.toNodeId || null;
}

/**
 * Execute a process.
 *
 * @param {Object} params
 * @param {string} params.processId - Process ID
 * @param {Object|null} params.event - Domain event (if triggered by event)
 * @param {Object} params.manualParams - Manual invocation params (if manual)
 * @returns {Promise<{ ok: boolean, executionId?: string, error?: string }>}
 */
async function executeProcess(params) {
  const { processId, event = null, manualParams = {} } = params;

  try {
    // Load process
    const process = await Process.findById(processId).lean();
    if (!process) {
      return { ok: false, error: `Process not found: ${processId}` };
    }

    // Validate process
    const validation = validateProcess(process);
    if (!validation.valid) {
      return { ok: false, error: validation.error };
    }

    // Validate trigger match
    if (process.trigger.type === 'domain_event') {
      if (!event) {
        return { ok: false, error: 'Process requires domain event trigger' };
      }
      if (process.trigger.eventType && event.eventType !== process.trigger.eventType) {
        return { ok: false, error: `Event type mismatch: expected ${process.trigger.eventType}, got ${event.eventType}` };
      }
    } else if (process.trigger.type === 'manual') {
      // Manual trigger - no event validation needed
    } else if (process.trigger.type === 'schedule') {
      // Schedule runs are started by the process schedule runner
    } else if (process.trigger.type === 'webhook') {
      return { ok: false, error: 'Webhook processes must be started via the webhook endpoint' };
    } else {
      return { ok: false, error: `Unsupported trigger type: ${process.trigger.type}` };
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
      assignedTo: manualParams.assignedTo || event?.assignedTo
    });

    // Check idempotency
    const exists = await executionExists(context.executionId);
    if (exists) {
      log.info('process_execution_skipped', {
        executionId: context.executionId,
        reason: 'already_executed'
      });
      return { ok: true, executionId: context.executionId, skipped: true };
    }

    // Create execution record
    const execution = await ProcessExecution.create({
      executionId: context.executionId,
      processId: process._id,
      status: 'running',
      appKey: process.appKey,
      entityType: context.entityType,
      entityId: context.entityId,
      organizationId: context.organizationId ? new mongoose.Types.ObjectId(context.organizationId) : null,
      triggeredBy: context.triggeredBy ? new mongoose.Types.ObjectId(context.triggeredBy) : null,
      eventId: event?.eventId || null,
      startedAt: new Date()
    });

    log.info('process_started', {
      executionId: context.executionId,
      processId: process._id.toString(),
      processName: process.name,
      appKey: process.appKey,
      entityType: context.entityType,
      entityId: context.entityId
    });

    // Find start node
    const startNode = findStartNode(process);
    if (!startNode) {
      await ProcessExecution.updateOne(
        { _id: execution._id },
        { status: 'failed', error: 'No start node found', completedAt: new Date() }
      );
      return { ok: false, error: 'No start node found' };
    }

    // Build node map for quick lookup
    const nodeMap = new Map(process.nodes.map(n => [n.id, n]));

    // Execute nodes sequentially (for_each expands into per-record passes)
    let currentNode = startNode;
    let executionComplete = false;
    context._forEachStack = [];

    while (!executionComplete && currentNode) {
      // Update execution record with current node
      await ProcessExecution.updateOne(
        { _id: execution._id },
        { currentNodeId: currentNode.id }
      );

      // ---- For each: bind first item and enter body ----
      if (currentNode.type === 'for_each') {
        const variableName =
          currentNode.config?.variableName != null
            ? String(currentNode.config.variableName).trim()
            : 'records';
        const bag = context.dataBag && typeof context.dataBag === 'object' ? context.dataBag : {};
        const items = Array.isArray(bag[variableName]) ? bag[variableName] : null;
        if (!items) {
          await ProcessExecution.updateOne(
            { _id: execution._id },
            {
              status: 'failed',
              error: `for_each: dataBag.${variableName} is not an array (run Fetch records first)`,
              completedAt: new Date()
            }
          );
          return {
            ok: false,
            error: `for_each: dataBag.${variableName} is not an array`,
            executionId: context.executionId
          };
        }

        const bodyStartId = findNextNode(currentNode.id, process.edges || []);
        const endNodeId = findForEachEndNodeId(bodyStartId, process.edges || [], nodeMap);
        if (!bodyStartId || !endNodeId) {
          await ProcessExecution.updateOne(
            { _id: execution._id },
            {
              status: 'failed',
              error:
                'for_each requires a loop body ending in an "End for each" step (connect For each → steps → End for each)',
              completedAt: new Date()
            }
          );
          return {
            ok: false,
            error: 'for_each requires a matching for_each_end',
            executionId: context.executionId
          };
        }

        const afterEndId = findNextNode(endNodeId, process.edges || []);
        const moduleKey =
          (currentNode.config?.moduleKey && String(currentNode.config.moduleKey).trim()) ||
          bag[`${variableName}__meta`]?.moduleKey ||
          context.entityType;

        if (!items.length) {
          currentNode = afterEndId ? nodeMap.get(afterEndId) : null;
          if (!currentNode) executionComplete = true;
          continue;
        }

        if (context._forEachStack.length >= 10) {
          await ProcessExecution.updateOne(
            { _id: execution._id },
            {
              status: 'failed',
              error: 'for_each nesting too deep (max 10)',
              completedAt: new Date()
            }
          );
          return {
            ok: false,
            error: 'for_each nesting too deep (max 10)',
            executionId: context.executionId
          };
        }

        context._forEachStack.push({
          forEachNodeId: currentNode.id,
          variableName,
          items,
          index: 0,
          bodyStartId,
          endNodeId,
          afterEndId,
          moduleKey,
          saved: snapshotRecordBinding(context)
        });
        bindFetchedRecord(context, items[0], moduleKey, 0, items.length);
        log.info('for_each_started', {
          executionId: context.executionId,
          variableName,
          count: items.length,
          moduleKey,
          nestDepth: context._forEachStack.length
        });
        currentNode = nodeMap.get(bodyStartId);
        continue;
      }

      // ---- End for each: next item or exit loop ----
      if (currentNode.type === 'for_each_end') {
        const stack = context._forEachStack;
        const frame = stack.length ? stack[stack.length - 1] : null;
        if (!frame) {
          // No active loop — treat as no-op pass-through
          const nextId = findNextNode(currentNode.id, process.edges || []);
          currentNode = nextId ? nodeMap.get(nextId) : null;
          if (!currentNode) executionComplete = true;
          continue;
        }
        if (frame.endNodeId !== currentNode.id) {
          await ProcessExecution.updateOne(
            { _id: execution._id },
            {
              status: 'failed',
              error:
                'for_each_end does not match the active for_each — check nested For each / End for each pairing',
              completedAt: new Date()
            }
          );
          return {
            ok: false,
            error: 'for_each_end does not match the active for_each',
            executionId: context.executionId
          };
        }

        frame.index += 1;
        if (frame.index < frame.items.length) {
          bindFetchedRecord(
            context,
            frame.items[frame.index],
            frame.moduleKey,
            frame.index,
            frame.items.length
          );
          currentNode = nodeMap.get(frame.bodyStartId);
          continue;
        }

        restoreRecordBinding(context, frame.saved);
        stack.pop();
        log.info('for_each_completed', {
          executionId: context.executionId,
          variableName: frame.variableName,
          count: frame.items.length
        });
        currentNode = frame.afterEndId ? nodeMap.get(frame.afterEndId) : null;
        if (!currentNode) executionComplete = true;
        continue;
      }

      // Execute current node
      const result = await executeNode(currentNode, context, process.edges || []);

      if (!result.ok) {
        // Failure stops the process immediately
        await ProcessExecution.updateOne(
          { _id: execution._id },
          {
            status: 'failed',
            error: result.error || 'Node execution failed',
            completedAt: new Date()
          }
        );

        log.info('process_failed', {
          executionId: context.executionId,
          nodeId: currentNode.id,
          nodeType: currentNode.type,
          error: result.error
        });

        return { ok: false, error: result.error, executionId: context.executionId };
      }

      // Check if execution should end
      if (currentNode.type === 'end' || result.terminated) {
        executionComplete = true;
        break;
      }

      // Find next node
      let nextNodeId = null;
      if (result.nextNodeId) {
        nextNodeId = result.nextNodeId;
      } else if (currentNode.type === 'condition') {
        nextNodeId = null;
      } else {
        nextNodeId = findNextNode(currentNode.id, process.edges || []);
      }

      if (!nextNodeId) {
        executionComplete = true;
        break;
      }

      currentNode = nodeMap.get(nextNodeId);
      if (!currentNode) {
        await ProcessExecution.updateOne(
          { _id: execution._id },
          {
            status: 'failed',
            error: `Next node not found: ${nextNodeId}`,
            completedAt: new Date()
          }
        );
        return { ok: false, error: `Next node not found: ${nextNodeId}`, executionId: context.executionId };
      }
    }

    // Execution completed successfully
    await ProcessExecution.updateOne(
      { _id: execution._id },
      {
        status: 'completed',
        currentNodeId: null,
        completedAt: new Date()
      }
    );

    log.info('process_completed', {
      executionId: context.executionId,
      processId: process._id.toString(),
      processName: process.name
    });

    return { ok: true, executionId: context.executionId };
  } catch (err) {
    log.error('process_execution_error', {
      processId,
      error: err.message,
      stack: err.stack
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
 * Execute process triggered by domain event.
 * Uses the formal process invocation service.
 *
 * @param {Object} event - Domain event
 * @returns {Promise<{ ok: boolean, executionId?: string, error?: string }>}
 */
async function executeByEvent(event) {
  if (!event || !event.eventId) {
    return { ok: false, error: 'Invalid domain event' };
  }

  const run = async () => {
    // Find all active processes that match this event
    // Closed-record gate runs inside startProcess (loads entity from DB).
    const { matchesUpdateWatch, domainEventProcessMatchFilter } = require('../utils/processTriggerUtils');

    const matchingProcesses = await Process.find({
      status: 'active',
      'trigger.type': 'domain_event',
      ...domainEventProcessMatchFilter(event.eventType)
    }).lean();

    const results = [];
    for (const process of matchingProcesses) {
      // App scope: PLATFORM processes receive all apps; otherwise require matching appKey
      const processApp = String(process.appKey || '').toUpperCase();
      const eventApp = String(event.appKey || '').toUpperCase();
      if (processApp && processApp !== 'PLATFORM' && eventApp && processApp !== eventApp) {
        results.push({
          processId: process._id.toString(),
          ok: true,
          skipped: true,
          reason: 'appKey_mismatch'
        });
        continue;
      }
      if (process.entityType && event.entityType && process.entityType !== event.entityType) {
        results.push({
          processId: process._id.toString(),
          ok: true,
          skipped: true,
          reason: 'entityType_mismatch'
        });
        continue;
      }
      if (!matchesUpdateWatch(process.trigger, event)) {
        results.push({
          processId: process._id.toString(),
          ok: true,
          skipped: true,
          reason: 'updateWatch_mismatch',
          changedFields: event.changedFields || []
        });
        continue;
      }
      const result = await startProcess({
        processId: process._id.toString(),
        event
      });
      results.push({ processId: process._id.toString(), ...result });
    }

    if (matchingProcesses.length === 0) {
      log.info('process_executor_no_match', {
        eventType: event.eventType,
        entityType: event.entityType,
        entityId: event.entityId,
        organizationId: event.organizationId,
        appKey: event.appKey,
        changedFields: event.changedFields || []
      });
    } else {
      log.info('process_executor_event_matched', {
        eventType: event.eventType,
        matched: matchingProcesses.length,
        results: results.map((r) => ({
          processId: r.processId,
          ok: r.ok,
          skipped: r.skipped,
          reason: r.reason,
          error: r.error,
          executionId: r.executionId
        }))
      });
    }

    return {
      ok: true,
      processesMatched: matchingProcesses.length,
      results
    };
  };

  if (event.organizationId) {
    try {
      const { runWithOrganizationTenantContext } = require('../utils/runWithOrganizationTenant');
      return await runWithOrganizationTenantContext(event.organizationId, run);
    } catch (err) {
      log.error('process_executor_tenant_bind_failed', {
        organizationId: event.organizationId,
        error: err.message
      });
    }
  }

  return run();
}

/**
 * Execute process manually.
 * Uses the formal process invocation service.
 *
 * @param {Object} params
 * @param {string} params.processId - Process ID
 * @param {string} params.entityType - Entity type
 * @param {string} params.entityId - Entity ID
 * @param {string} params.organizationId - Organization ID
 * @param {string} params.triggeredBy - User ID
 * @param {string} [params.assignedTo] - Owner ID
 * @returns {Promise<{ ok: boolean, executionId?: string, error?: string }>}
 */
async function executeManually(params) {
  const { processId, entityType, entityId, organizationId, triggeredBy, assignedTo } = params;

  if (!processId || !entityType || !entityId || !organizationId || !triggeredBy) {
    return { ok: false, error: 'Missing required parameters for manual execution' };
  }

  return await startProcess({
    processId,
    manualParams: {
      entityType,
      entityId,
      organizationId,
      triggeredBy,
      assignedTo
    }
  });
}

/**
 * Initialize the process executor: subscribe to domain events and process each one.
 * Safe to call multiple times (idempotent).
 */
function init() {
  if (initialized) return;
  initialized = true;

  subscribe(async (event) => {
    try {
      await executeByEvent(event);
    } catch (err) {
      log.error('process_executor_event_handler_error', {
        eventType: event.eventType,
        eventId: event.eventId,
        error: err.message,
        stack: err.stack
      });
    }
  });

  log.info('process_executor_initialized', {});
}

module.exports = {
  init,
  executeProcess,
  executeByEvent,
  executeManually,
  validateProcess
};
