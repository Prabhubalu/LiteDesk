/**
 * ============================================================================
 * PLATFORM CORE: Process Node Handlers (Process Engine Step 0 + Phase 2)
 * ============================================================================
 *
 * Handlers for each node type: trigger, condition, action, data_mapping, end,
 * field_rule, ownership_rule, status_guard.
 * Node behavior must NOT be hardcoded per process.
 *
 * Phase 2: Behavior control nodes propose behavior changes but never mutate
 * records directly. All proposals are validated by System Invariants & Permissions.
 *
 * ============================================================================
 */

const { createLogger } = require('./automationLogger');
const { resolveApprovers } = require('./approvalApproverResolver');
const { computeResumeAt, formatWaitLabel } = require('../utils/processWaitUtils');

const log = createLogger('processNodeHandlers');

function executeAction(...args) {
  return require('./automationActionHandlers').execute(...args);
}

/**
 * Execute trigger node.
 * Validates trigger match. Does NOT mutate data. Does NOT advance state.
 *
 * @param {Object} node - ProcessNode
 * @param {Object} context - ProcessExecutionContext
 * @returns {Promise<{ ok: boolean, matched: boolean, error?: string }>}
 */
async function executeTrigger(node, context) {
  const { config } = node;
  const { event, trigger, webhookInvocation } = context;

  if (webhookInvocation) {
    return { ok: true, matched: true };
  }

  if (!event) {
    return { ok: false, matched: false, error: 'Trigger node requires domain event' };
  }

  // Validate trigger match
  const expectedEventType = config.eventType || trigger?.eventType;
  if (expectedEventType && event.eventType !== expectedEventType) {
    return { ok: false, matched: false, error: `Event type mismatch: expected ${expectedEventType}, got ${event.eventType}` };
  }

  // Additional trigger conditions can be evaluated here
  // For now, basic eventType matching is sufficient

  return { ok: true, matched: true };
}

/**
 * Execute condition node.
 * Evaluates boolean logic using context.event and context.dataBag.
 * Chooses outgoing edge based on result.
 *
 * @param {Object} node - ProcessNode
 * @param {Object} context - ProcessExecutionContext
 * @param {Array} edges - ProcessEdge[] (all edges from this node)
 * @returns {Promise<{ ok: boolean, nextNodeId?: string, error?: string }>}
 */
async function executeCondition(node, context, edges) {
  const { config, id: nodeId } = node;
  const { event, dataBag } = context;

  // Find outgoing edges from this node
  const outgoingEdges = edges.filter(e => e.fromNodeId === nodeId);

  if (outgoingEdges.length === 0) {
    return { ok: false, error: 'Condition node has no outgoing edges' };
  }

  // Evaluate condition logic
  // For Step 0, we support simple boolean expressions
  // Format: { field: 'event.eventType', operator: 'equals', value: 'deal.stage.changed' }
  let result = false;

  try {
    const condition = config.condition || config;
    if (typeof condition === 'boolean') {
      result = condition;
    } else if (typeof condition === 'object' && condition !== null) {
      // Simple condition evaluation
      const { field, operator, value } = condition;
      
      if (!field || !operator) {
        return { ok: false, error: 'Condition requires field and operator' };
      }
      
      // Resolve field value from event or dataBag
      let fieldValue = null;
      if (field.startsWith('event.')) {
        const path = field.replace('event.', '');
        fieldValue = path.split('.').reduce((obj, key) => obj?.[key], event);
      } else if (field.startsWith('dataBag.')) {
        const key = field.replace('dataBag.', '');
        fieldValue = dataBag[key];
      } else {
        fieldValue = dataBag[field] || event?.[field];
      }

      // Evaluate operator
      switch (operator) {
        case 'equals':
        case '===':
          result = fieldValue === value;
          break;
        case 'not_equals':
        case '!==':
          result = fieldValue !== value;
          break;
        case 'contains':
          result = String(fieldValue || '').includes(String(value || ''));
          break;
        case 'exists':
          result = fieldValue != null;
          break;
        case 'greater_than':
          result = Number(fieldValue) > Number(value);
          break;
        case 'less_than':
          result = Number(fieldValue) < Number(value);
          break;
        default:
          result = false;
      }
    } else {
      return { ok: false, error: 'Invalid condition format' };
    }

    // Choose edge based on result
    // If condition has 'true' and 'false' edges, use them
    // Otherwise, use first edge for true, second for false
    const trueEdge = outgoingEdges.find(e => e.condition === true || e.condition === 'true');
    const falseEdge = outgoingEdges.find(e => e.condition === false || e.condition === 'false');

    if (result) {
      const nextEdge = trueEdge || outgoingEdges[0];
      return { ok: true, nextNodeId: nextEdge?.toNodeId };
    } else {
      const nextEdge = falseEdge || (outgoingEdges.length > 1 ? outgoingEdges[1] : null);
      return { ok: true, nextNodeId: nextEdge?.toNodeId || null };
    }
  } catch (err) {
    return { ok: false, error: `Condition evaluation failed: ${err.message}` };
  }
}

/**
 * Execute action node.
 * Delegates execution to existing Automation Action Handlers.
 * Must respect permissions, ownership, and system invariants.
 *
 * @param {Object} node - ProcessNode
 * @param {Object} context - ProcessExecutionContext
 * @returns {Promise<{ ok: boolean, result?: Object, error?: string }>}
 */
async function executeActionNode(node, context) {
  const { config } = node;
  const { event, entityType, entityId, organizationId, triggeredBy, ownerId, appKey } = context;

  const actionType = config.actionType;
  if (!actionType) {
    return { ok: false, error: 'Action node missing actionType in config' };
  }

  // Build action context compatible with automation action handlers
  const actionContext = {
    eventId: event?.eventId || null,
    entityType,
    entityId,
    organizationId,
    triggeredBy,
    ownerId,
    appKey: appKey || 'SALES'
  };

  const actionParams = config.params || config.actionParams || {};

  try {
    const result = await executeAction(actionType, actionContext, actionParams);
    if (result && result.ok) {
      return { ok: true, result };
    } else {
      return { ok: false, error: result?.error || 'Action execution failed' };
    }
  } catch (err) {
    return { ok: false, error: `Action execution error: ${err.message}` };
  }
}

/**
 * Execute data_mapping node.
 * Maps values between event payload, entity data, and dataBag.
 *
 * @param {Object} node - ProcessNode
 * @param {Object} context - ProcessExecutionContext
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
async function executeDataMapping(node, context) {
  const { config } = node;
  const { event, dataBag } = context;

  try {
    const mappings = config.mappings || config;
    if (!Array.isArray(mappings) && typeof mappings !== 'object') {
      return { ok: false, error: 'Data mapping node requires mappings array or object' };
    }

    // Process mappings
    const mappingList = Array.isArray(mappings) ? mappings : [mappings];
    
    for (const mapping of mappingList) {
      const { source, target, transform } = mapping;

      if (!source || !target) {
        return { ok: false, error: 'Data mapping requires source and target' };
      }

      // Resolve source value
      let sourceValue = null;
      if (source.startsWith('event.')) {
        const path = source.replace('event.', '');
        sourceValue = path.split('.').reduce((obj, key) => obj?.[key], event);
      } else if (source.startsWith('dataBag.')) {
        const key = source.replace('dataBag.', '');
        sourceValue = dataBag[key];
      } else {
        sourceValue = dataBag[source] || event?.[source];
      }

      // Apply transform if provided
      if (transform && typeof transform === 'function') {
        sourceValue = transform(sourceValue);
      } else if (transform && typeof transform === 'string') {
        // Simple string transforms
        switch (transform) {
          case 'toString':
            sourceValue = String(sourceValue || '');
            break;
          case 'toNumber':
            sourceValue = Number(sourceValue) || 0;
            break;
          case 'toBoolean':
            sourceValue = Boolean(sourceValue);
            break;
          default:
            // No transform
        }
      }

      // Set target value in dataBag
      if (target.startsWith('dataBag.')) {
        const key = target.replace('dataBag.', '');
        dataBag[key] = sourceValue;
      } else {
        dataBag[target] = sourceValue;
      }
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: `Data mapping failed: ${err.message}` };
  }
}

/**
 * Execute field_rule node.
 * Controls field-level behavior: defaults, mandatory, visibility.
 * Proposes behavior changes - actual enforcement delegated to form engine/validation layer.
 *
 * @param {Object} node - ProcessNode
 * @param {Object} context - ProcessExecutionContext
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
async function executeFieldRule(node, context) {
  const { config, id: nodeId } = node;
  const { entityType, entityId, organizationId, behaviorProposals, event, dataBag } = context;

  // Validate config schema
  const { entityType: configEntityType, fieldKey, rule, value, condition } = config;

  if (!configEntityType || !fieldKey || !rule) {
    return { ok: false, error: 'field_rule node requires entityType, fieldKey, and rule' };
  }

  // Validate entityType
  const validEntityTypes = ['people', 'organization', 'deal'];
  if (!validEntityTypes.includes(configEntityType)) {
    return { ok: false, error: `Invalid entityType: ${configEntityType}. Must be one of: ${validEntityTypes.join(', ')}` };
  }

  // Validate rule type
  const validRules = ['default', 'mandatory', 'visibility'];
  if (!validRules.includes(rule)) {
    return { ok: false, error: `Invalid rule: ${rule}. Must be one of: ${validRules.join(', ')}` };
  }

  // Validate value based on rule type
  if (rule === 'visibility' && typeof value !== 'boolean') {
    return { ok: false, error: 'visibility rule requires boolean value (true/false)' };
  }

  // Evaluate condition if provided
  if (condition) {
    let conditionResult = true;
    try {
      // Simple condition evaluation (same logic as condition node)
      if (typeof condition === 'boolean') {
        conditionResult = condition;
      } else if (typeof condition === 'object' && condition !== null) {
        const { field, operator, value: conditionValue } = condition;
        if (field && operator) {
          let fieldValue = null;
          if (field.startsWith('event.')) {
            const path = field.replace('event.', '');
            fieldValue = path.split('.').reduce((obj, key) => obj?.[key], event);
          } else if (field.startsWith('dataBag.')) {
            const key = field.replace('dataBag.', '');
            fieldValue = dataBag[key];
          } else {
            fieldValue = dataBag[field] || event?.[field];
          }

          switch (operator) {
            case 'equals':
            case '===':
              conditionResult = fieldValue === conditionValue;
              break;
            case 'not_equals':
            case '!==':
              conditionResult = fieldValue !== conditionValue;
              break;
            case 'contains':
              conditionResult = String(fieldValue || '').includes(String(conditionValue || ''));
              break;
            case 'exists':
              conditionResult = fieldValue != null;
              break;
            default:
              conditionResult = false;
          }
        }
      }

      if (!conditionResult) {
        // Condition not met - skip this rule
        return { ok: true };
      }
    } catch (err) {
      return { ok: false, error: `Condition evaluation failed: ${err.message}` };
    }
  }

  // Create proposal
  const proposal = {
    nodeId,
    entityType: configEntityType,
    entityId: entityId || null,
    fieldKey,
    rule,
    value,
    condition: condition || null,
    organizationId: organizationId || null
  };

  // Add to behavior proposals
  behaviorProposals.fieldRules.push(proposal);

  // Log proposal
  log.info('behavior_rule_proposed', {
    executionId: context.executionId,
    nodeId,
    nodeType: 'field_rule',
    proposal
  });

  return { ok: true };
}

/**
 * Execute ownership_rule node.
 * Controls record ownership and assignment behavior.
 * Proposes ownership change - validated by permissions and ownership rules.
 *
 * @param {Object} node - ProcessNode
 * @param {Object} context - ProcessExecutionContext
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
async function executeOwnershipRule(node, context) {
  const { config, id: nodeId } = node;
  const { entityType, entityId, organizationId, behaviorProposals, event, dataBag } = context;

  // Validate config schema
  const { entityType: configEntityType, assignment, target, condition } = config;

  if (!configEntityType || !assignment || !target) {
    return { ok: false, error: 'ownership_rule node requires entityType, assignment, and target' };
  }

  // Validate entityType
  const validEntityTypes = ['people', 'organization', 'deal'];
  if (!validEntityTypes.includes(configEntityType)) {
    return { ok: false, error: `Invalid entityType: ${configEntityType}. Must be one of: ${validEntityTypes.join(', ')}` };
  }

  // Validate assignment type
  const validAssignments = ['owner', 'role', 'rule'];
  if (!validAssignments.includes(assignment)) {
    return { ok: false, error: `Invalid assignment: ${assignment}. Must be one of: ${validAssignments.join(', ')}` };
  }

  // Evaluate condition if provided
  if (condition) {
    let conditionResult = true;
    try {
      if (typeof condition === 'boolean') {
        conditionResult = condition;
      } else if (typeof condition === 'object' && condition !== null) {
        const { field, operator, value: conditionValue } = condition;
        if (field && operator) {
          let fieldValue = null;
          if (field.startsWith('event.')) {
            const path = field.replace('event.', '');
            fieldValue = path.split('.').reduce((obj, key) => obj?.[key], event);
          } else if (field.startsWith('dataBag.')) {
            const key = field.replace('dataBag.', '');
            fieldValue = dataBag[key];
          } else {
            fieldValue = dataBag[field] || event?.[field];
          }

          switch (operator) {
            case 'equals':
            case '===':
              conditionResult = fieldValue === conditionValue;
              break;
            case 'not_equals':
            case '!==':
              conditionResult = fieldValue !== conditionValue;
              break;
            case 'contains':
              conditionResult = String(fieldValue || '').includes(String(conditionValue || ''));
              break;
            case 'exists':
              conditionResult = fieldValue != null;
              break;
            default:
              conditionResult = false;
          }
        }
      }

      if (!conditionResult) {
        return { ok: true };
      }
    } catch (err) {
      return { ok: false, error: `Condition evaluation failed: ${err.message}` };
    }
  }

  // Create proposal
  const proposal = {
    nodeId,
    entityType: configEntityType,
    entityId: entityId || null,
    assignment,
    target,
    condition: condition || null,
    organizationId: organizationId || null
  };

  // Add to behavior proposals
  behaviorProposals.ownershipRules.push(proposal);

  // Log proposal
  log.info('behavior_rule_proposed', {
    executionId: context.executionId,
    nodeId,
    nodeType: 'ownership_rule',
    proposal
  });

  return { ok: true };
}

/**
 * Execute status_guard node.
 * Controls whether a status/lifecycle/stage change is allowed.
 * Evaluated before status changes - enforcement delegated to System Invariants.
 *
 * @param {Object} node - ProcessNode
 * @param {Object} context - ProcessExecutionContext
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
async function executeStatusGuard(node, context) {
  const { config, id: nodeId } = node;
  const { entityType, entityId, organizationId, behaviorProposals, event, dataBag } = context;

  // Validate config schema
  const { entityType: configEntityType, field, allowedTransitions, condition } = config;

  if (!configEntityType || !field || !allowedTransitions) {
    return { ok: false, error: 'status_guard node requires entityType, field, and allowedTransitions' };
  }

  // Validate entityType
  const validEntityTypes = ['people', 'organization', 'deal'];
  if (!validEntityTypes.includes(configEntityType)) {
    return { ok: false, error: `Invalid entityType: ${configEntityType}. Must be one of: ${validEntityTypes.join(', ')}` };
  }

  // Validate field
  const validFields = ['status', 'lifecycle', 'stage'];
  if (!validFields.includes(field)) {
    return { ok: false, error: `Invalid field: ${field}. Must be one of: ${validFields.join(', ')}` };
  }

  // Validate allowedTransitions is array
  if (!Array.isArray(allowedTransitions)) {
    return { ok: false, error: 'allowedTransitions must be an array' };
  }

  // Validate transition format
  for (const transition of allowedTransitions) {
    if (typeof transition !== 'string' || !transition.includes('→')) {
      return { ok: false, error: `Invalid transition format: ${transition}. Must be "from → to"` };
    }
  }

  // Evaluate condition if provided
  if (condition) {
    let conditionResult = true;
    try {
      if (typeof condition === 'boolean') {
        conditionResult = condition;
      } else if (typeof condition === 'object' && condition !== null) {
        const { field: conditionField, operator, value: conditionValue } = condition;
        if (conditionField && operator) {
          let fieldValue = null;
          if (conditionField.startsWith('event.')) {
            const path = conditionField.replace('event.', '');
            fieldValue = path.split('.').reduce((obj, key) => obj?.[key], event);
          } else if (conditionField.startsWith('dataBag.')) {
            const key = conditionField.replace('dataBag.', '');
            fieldValue = dataBag[key];
          } else {
            fieldValue = dataBag[conditionField] || event?.[conditionField];
          }

          switch (operator) {
            case 'equals':
            case '===':
              conditionResult = fieldValue === conditionValue;
              break;
            case 'not_equals':
            case '!==':
              conditionResult = fieldValue !== conditionValue;
              break;
            case 'contains':
              conditionResult = String(fieldValue || '').includes(String(conditionValue || ''));
              break;
            case 'exists':
              conditionResult = fieldValue != null;
              break;
            default:
              conditionResult = false;
          }
        }
      }

      if (!conditionResult) {
        return { ok: true };
      }
    } catch (err) {
      return { ok: false, error: `Condition evaluation failed: ${err.message}` };
    }
  }

  // Create proposal
  const proposal = {
    nodeId,
    entityType: configEntityType,
    entityId: entityId || null,
    field,
    allowedTransitions,
    condition: condition || null,
    organizationId: organizationId || null
  };

  // Add to behavior proposals
  behaviorProposals.statusGuards.push(proposal);

  // Log proposal
  log.info('behavior_rule_proposed', {
    executionId: context.executionId,
    nodeId,
    nodeType: 'status_guard',
    proposal
  });

  return { ok: true };
}

/**
 * Execute end node.
 * Terminates execution cleanly.
 *
 * @param {Object} node - ProcessNode
 * @param {Object} context - ProcessExecutionContext
 * @returns {Promise<{ ok: boolean, terminated: boolean }>}
 */
async function executeEnd(node, context) {
  // End node simply terminates execution
  return { ok: true, terminated: true };
}

/**
 * Execute approval_gate node (Phase 3).
 * Pause process until an approval decision is made. Resolves approvers, never mutates.
 *
 * Config: { entityType, approvalType, approvers: [{ type, value }], onApprove, onReject, timeout, onTimeout }
 *
 * @param {Object} node - ProcessNode
 * @param {Object} context - ProcessExecutionContext
 * @returns {Promise<{ ok: boolean, paused?: boolean, approverUserIds?: string[], configSnapshot?: Object, timeoutAt?: Date, error?: string }>}
 */
async function executeApprovalGate(node, context) {
  const { config, id: nodeId } = node;
  const { entityType, entityId, organizationId, ownerId, triggeredBy } = context;

  if (!config || !Array.isArray(config.approvers) || config.approvers.length === 0) {
    return { ok: false, error: 'approval_gate requires approvers' };
  }

  if (!organizationId) {
    return { ok: false, error: 'approval_gate requires organizationId in context' };
  }

  const resolution = await resolveApprovers({
    approvers: config.approvers,
    organizationId: organizationId.toString ? organizationId.toString() : organizationId,
    entityType,
    entityId,
    ownerId: ownerId?.toString ? ownerId.toString() : ownerId,
    triggeredBy: triggeredBy?.toString ? triggeredBy.toString() : triggeredBy
  });

  if (!resolution.ok || !resolution.userIds || resolution.userIds.length === 0) {
    return { ok: false, error: resolution.error || 'No valid approvers resolved' };
  }

  let timeoutAt = null;
  const timeout = config.timeout;
  if (timeout && typeof timeout.duration === 'number' && timeout.duration > 0 && timeout.unit) {
    const d = new Date();
    if (timeout.unit === 'hours') {
      d.setHours(d.getHours() + timeout.duration);
    } else if (timeout.unit === 'days') {
      d.setDate(d.getDate() + timeout.duration);
    } else {
      timeoutAt = null;
    }
    if (timeout.unit === 'hours' || timeout.unit === 'days') timeoutAt = d;
  }

  const configSnapshot = {
    entityType: config.entityType || entityType,
    approvalType: config.approvalType || 'single',
    approvers: config.approvers,
    onApprove: config.onApprove || 'continue',
    onReject: config.onReject || 'fail',
    timeout: config.timeout || null,
    onTimeout: config.onTimeout || 'fail'
  };

  return {
    ok: true,
    paused: true,
    approverUserIds: resolution.userIds,
    configSnapshot,
    timeoutAt
  };
}

/**
 * Execute wait node — pause until resumeAt (scheduler resumes).
 * Config: { duration: number, unit: 'minutes'|'hours'|'days' }
 *
 * @param {Object} node - ProcessNode
 * @returns {Promise<{ ok: boolean, paused?: boolean, resumeAt?: Date, error?: string }>}
 */
async function executeWait(node) {
  const { config = {} } = node;
  const duration = Number(config.duration);
  const unit = config.unit || 'hours';

  if (!Number.isFinite(duration) || duration < 1) {
    return { ok: false, error: 'wait requires duration >= 1' };
  }
  if (!['minutes', 'hours', 'days'].includes(unit)) {
    return { ok: false, error: `wait unit must be minutes, hours, or days (got ${unit})` };
  }

  const resumeAt = computeResumeAt(duration, unit);
  return {
    ok: true,
    paused: true,
    resumeAt,
    waitLabel: formatWaitLabel(duration, unit)
  };
}

/**
 * Execute a node by type.
 *
 * @param {Object} node - ProcessNode
 * @param {Object} context - ProcessExecutionContext
 * @param {Array} edges - ProcessEdge[] (all edges)
 * @returns {Promise<{ ok: boolean, nextNodeId?: string, result?: Object, error?: string }>}
 */
async function executeNode(node, context, edges) {
  const { type, id: nodeId } = node;

  log.info('node_executed', {
    executionId: context.executionId,
    nodeId,
    nodeType: type
  });

  switch (type) {
    case 'trigger':
      return await executeTrigger(node, context);
    case 'condition':
      return await executeCondition(node, context, edges);
    case 'action':
      return await executeActionNode(node, context);
    case 'data_mapping':
      return await executeDataMapping(node, context);
    case 'end':
      return await executeEnd(node, context);
    case 'field_rule':
      return await executeFieldRule(node, context);
    case 'ownership_rule':
      return await executeOwnershipRule(node, context);
    case 'status_guard':
      return await executeStatusGuard(node, context);
    case 'approval_gate':
      return await executeApprovalGate(node, context);
    case 'wait':
      return await executeWait(node, context);
    default:
      return { ok: false, error: `Unsupported node type: ${type}` };
  }
}

module.exports = {
  executeNode,
  executeTrigger,
  executeCondition,
  executeActionNode,
  executeDataMapping,
  executeEnd,
  executeFieldRule,
  executeOwnershipRule,
  executeStatusGuard,
  executeApprovalGate,
  executeWait
};
