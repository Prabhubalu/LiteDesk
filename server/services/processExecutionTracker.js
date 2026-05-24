/**
 * Process execution observability: executionPath, nodeSteps, graph-state for designer overlay.
 */

const ProcessExecution = require('../models/ProcessExecution');

/**
 * @param {Array} edges
 * @param {string} fromNodeId
 * @param {string} toNodeId
 * @returns {string|null}
 */
function findEdgeId(edges, fromNodeId, toNodeId) {
  if (!fromNodeId || !toNodeId) return null;
  const edge = (edges || []).find((e) => e.fromNodeId === fromNodeId && e.toNodeId === toNodeId);
  return edge?.id || null;
}

/**
 * Begin tracking a node (append path + step with startedAt).
 */
async function recordNodeEnter(executionId, { nodeId, edgeId }) {
  const startedAt = new Date();
  await ProcessExecution.updateOne(
    { _id: executionId },
    {
      $push: {
        executionPath: nodeId,
        nodeSteps: {
          nodeId,
          edgeId: edgeId || null,
          status: 'completed',
          startedAt,
          endedAt: null,
          durationMs: 0,
          message: null,
          technicalDetail: null
        }
      },
      currentNodeId: nodeId
    }
  );
  return startedAt;
}

/**
 * Finalize the last node step after it completes.
 */
async function finalizeLastNodeStep(executionId, { status = 'completed', message, technicalDetail }) {
  const execution = await ProcessExecution.findById(executionId).lean();
  if (!execution?.nodeSteps?.length) return;

  const endedAt = new Date();
  const steps = [...execution.nodeSteps];
  const last = steps[steps.length - 1];
  const durationMs = last.startedAt ? endedAt.getTime() - new Date(last.startedAt).getTime() : 0;
  steps[steps.length - 1] = {
    ...last,
    status,
    message: message || last.message,
    technicalDetail: technicalDetail || null,
    endedAt,
    durationMs
  };

  await ProcessExecution.updateOne({ _id: executionId }, { nodeSteps: steps });
}

/**
 * Mark last step failed and set execution failed.
 */
async function recordNodeFailure(executionId, errorMessage) {
  const endedAt = new Date();
  const execution = await ProcessExecution.findById(executionId).lean();
  if (execution?.nodeSteps?.length) {
    const steps = [...execution.nodeSteps];
    const last = steps[steps.length - 1];
    const durationMs = last.startedAt ? endedAt - new Date(last.startedAt) : 0;
    steps[steps.length - 1] = {
      ...last,
      status: 'failed',
      message: errorMessage || 'Step failed',
      endedAt,
      durationMs
    };
    await ProcessExecution.updateOne({ _id: executionId }, { nodeSteps: steps });
  }
}

/**
 * Human-readable message for a completed node.
 */
function messageForNode(node, result, process) {
  if (!node) return null;
  if (node.type === 'condition' && result?.conditionResult !== undefined) {
    return result.conditionResult ? 'Condition passed (Yes branch)' : 'Condition failed (No branch)';
  }
  if (node.type === 'approval_gate') {
    return 'Waiting for approval';
  }
  if (node.type === 'wait') {
    if (result?.waitLabel) return result.waitLabel;
    const d = node.config?.duration;
    const u = node.config?.unit || 'hours';
    return d ? `Wait ${d} ${u}` : 'Wait before continuing';
  }
  const labels = {
    trigger: 'Trigger fired',
    field_rule: `Field rule applied (${node.config?.fieldKey || 'field'})`,
    ownership_rule: 'Ownership rule applied',
    status_guard: 'Status guard evaluated',
    action: `Action: ${node.config?.actionType || 'action'}`,
    approval_gate: 'Approval gate',
    end: 'Process ended'
  };
  return labels[node.type] || `${node.type} completed`;
}

/**
 * Build graph-state payload for designer overlay.
 * @param {Object} execution - lean ProcessExecution
 * @param {Object} process - lean Process with nodes/edges
 */
function buildGraphState(execution, process) {
  const pathSet = new Set(execution.executionPath || []);
  const stepByNode = new Map((execution.nodeSteps || []).map((s) => [s.nodeId, s]));

  const nodes = {};
  for (const node of process.nodes || []) {
    let status = 'pending';
    let message = null;
    let durationMs = null;
    let startedAt = null;
    let endedAt = null;

    const step = stepByNode.get(node.id);
    const pausedId = execution.pausedNodeId || execution.currentNodeId;
    if (execution.status === 'waiting_until' && node.id === pausedId) {
      status = 'running';
      message = execution.resumeAt
        ? `Scheduled to resume at ${new Date(execution.resumeAt).toISOString()}`
        : 'Waiting…';
      if (step) {
        startedAt = step.startedAt;
        endedAt = step.endedAt;
        durationMs = step.durationMs;
        message = step.message || message;
      }
    } else if (execution.status === 'running' && execution.currentNodeId === node.id) {
      status = 'running';
      message = 'Currently running…';
      if (step) {
        startedAt = step.startedAt;
        message = step.message || message;
      }
    } else if (step) {
      status = step.status === 'failed' ? 'failed' : 'completed';
      message = step.message;
      durationMs = step.durationMs;
      startedAt = step.startedAt;
      endedAt = step.endedAt;
    } else if (pathSet.has(node.id)) {
      status = 'completed';
    } else if (['completed', 'failed'].includes(execution.status)) {
      status = 'skipped';
      message = 'Not reached in this run';
    }

    if (execution.status === 'failed' && execution.currentNodeId === node.id) {
      status = 'failed';
      message = execution.error || message;
    }

    nodes[node.id] = { status, message, durationMs, startedAt, endedAt };
  }

  const edges = {};
  for (const edge of process.edges || []) {
    const fromStep = stepByNode.get(edge.fromNodeId);
    const toInPath = pathSet.has(edge.toNodeId);
    const fromInPath = pathSet.has(edge.fromNodeId);
    let traversed = fromInPath && toInPath;
    if (fromStep && execution.executionPath) {
      const idx = execution.executionPath.indexOf(edge.fromNodeId);
      if (idx >= 0 && execution.executionPath[idx + 1] === edge.toNodeId) {
        traversed = true;
      }
    }
    edges[edge.id] = {
      traversed,
      durationMs: traversed && fromStep?.durationMs ? fromStep.durationMs : null
    };
  }

  return {
    executionId: execution.executionId,
    executionMongoId: execution._id?.toString(),
    status: execution.status,
    currentNodeId: execution.currentNodeId,
    error: execution.error,
    executionPath: execution.executionPath || [],
    nodes,
    edges
  };
}

module.exports = {
  findEdgeId,
  recordNodeEnter,
  finalizeLastNodeStep,
  recordNodeFailure,
  messageForNode,
  buildGraphState
};
