/**
 * Dry-run process simulation for test mode (no mutations).
 */

const { buildGraphState, messageForNode } = require('./processExecutionTracker');

function evaluateCondition(config, context) {
  const condition = config?.condition || config;
  const { event = {}, dataBag = {} } = context;
  if (typeof condition === 'boolean') return condition;
  if (!condition?.field || !condition?.operator) return false;

  let fieldValue = null;
  const field = condition.field;
  if (field.startsWith('event.')) {
    const path = field.replace('event.', '');
    fieldValue = path.split('.').reduce((obj, key) => obj?.[key], event);
  } else if (field.startsWith('dataBag.')) {
    fieldValue = dataBag[field.replace('dataBag.', '')];
  } else if (field.startsWith('event.currentState.')) {
    const path = field.replace('event.currentState.', '');
    fieldValue = event.currentState?.[path];
  } else {
    fieldValue = dataBag[field] ?? event?.[field];
  }

  switch (condition.operator) {
    case 'equals':
    case '===':
      return fieldValue === condition.value;
    case 'not_equals':
    case '!==':
      return fieldValue !== condition.value;
    case 'greater_than':
      return Number(fieldValue) > Number(condition.value);
    case 'less_than':
      return Number(fieldValue) < Number(condition.value);
    case 'contains':
      return String(fieldValue || '').includes(String(condition.value || ''));
    default:
      return false;
  }
}

function findNextNodeId(currentNode, edges, conditionResult) {
  const outgoing = (edges || []).filter((e) => e.fromNodeId === currentNode.id);
  if (currentNode.type === 'condition' && conditionResult !== null) {
    const trueEdge = outgoing.find((e) => e.condition === true || e.condition === 'true');
    const falseEdge = outgoing.find((e) => e.condition === false || e.condition === 'false');
    if (conditionResult) return (trueEdge || outgoing[0])?.toNodeId || null;
    return (falseEdge || outgoing[1])?.toNodeId || null;
  }
  return outgoing[0]?.toNodeId || null;
}

function findStartNode(process) {
  const edges = process.edges || [];
  if (process.trigger?.type === 'domain_event') {
    return process.nodes.find((n) => n.type === 'trigger') || null;
  }
  if (process.trigger?.type === 'webhook') {
    const triggerNode = process.nodes.find((n) => n.type === 'trigger');
    if (triggerNode) {
      const nextId = findNextNodeId(triggerNode, edges, null);
      if (nextId) {
        const nodeMap = new Map(process.nodes.map((n) => [n.id, n]));
        return nodeMap.get(nextId) || null;
      }
    }
  }
  return process.nodes.find((n) => n.type !== 'trigger') || process.nodes[0] || null;
}

/**
 * Simulate process run; returns graph-state shape (no DB write).
 */
function simulateProcessRun(process, options = {}) {
  const { entityId, entityType, sampleEventState = {} } = options;
  const nodeMap = new Map(process.nodes.map((n) => [n.id, n]));
  const edges = process.edges || [];
  const context = {
    event: {
      eventType: process.trigger?.eventType,
      entityType: entityType || process.entityType,
      entityId,
      currentState: sampleEventState
    },
    dataBag: { entityId, entityType: entityType || process.entityType },
    entityType: entityType || process.entityType,
    entityId
  };

  const executionPath = [];
  const nodeSteps = [];
  let previousNodeId = null;
  let currentNode = findStartNode(process);
  let failed = false;
  let error = null;

  while (currentNode && !failed) {
    const startedAt = new Date();
    const edge = previousNodeId
      ? edges.find((e) => e.fromNodeId === previousNodeId && e.toNodeId === currentNode.id)
      : null;

    executionPath.push(currentNode.id);

    let conditionResult = null;
    let stepMessage = messageForNode(currentNode, {}, process);

    if (currentNode.type === 'condition') {
      conditionResult = evaluateCondition(currentNode.config, context);
      stepMessage = conditionResult ? 'Condition passed (Yes branch)' : 'Condition did not pass (No branch)';
    } else if (currentNode.type === 'action') {
      stepMessage = `Would run: ${currentNode.config?.actionType || 'action'}`;
    } else if (currentNode.type === 'approval_gate') {
      stepMessage = 'Would pause for approval';
    } else if (currentNode.type === 'wait') {
      const d = currentNode.config?.duration ?? 1;
      const u = currentNode.config?.unit || 'hours';
      stepMessage = `Would wait ${d} ${u} (simulated — test run continues immediately)`;
    }

    const endedAt = new Date();
    nodeSteps.push({
      nodeId: currentNode.id,
      edgeId: edge?.id || null,
      status: 'completed',
      startedAt,
      endedAt,
      durationMs: endedAt - startedAt,
      message: stepMessage,
      technicalDetail: null
    });

    if (currentNode.type === 'end') break;

    const nextId = findNextNodeId(
      currentNode,
      edges,
      currentNode.type === 'condition' ? conditionResult : null
    );

    if (!nextId) break;
    previousNodeId = currentNode.id;
    currentNode = nodeMap.get(nextId);
    if (!currentNode) {
      failed = true;
      error = `Next node not found`;
      break;
    }
  }

  const mockExecution = {
    executionId: `test_${Date.now()}`,
    status: failed ? 'failed' : 'completed',
    currentNodeId: failed ? previousNodeId : null,
    error,
    executionPath,
    nodeSteps
  };

  return buildGraphState(mockExecution, process);
}

module.exports = { simulateProcessRun, evaluateCondition };
