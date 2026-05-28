/**
 * Convert Process document ↔ Vue Flow graph.
 */

import { buildNodeSentence, getNodeTypeLabel } from '@/utils/processSentenceBuilder';

function generateId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * @param {import('@vue-flow/core').Node[]} vfNodes
 * @param {import('@vue-flow/core').Edge[]} vfEdges
 */
export function flowToProcess(baseProcess, vfNodes, vfEdges) {
  const nodes = vfNodes.map((n) => ({
    id: n.id,
    type: n.data.processType,
    version: n.data.version ?? 1,
    config: { ...n.data.config },
    layout: {
      x: Math.round(n.position.x),
      y: Math.round(n.position.y)
    },
    meta: n.data.meta || { color: null, icon: null, notes: null, tags: [] }
  }));

  const edges = vfEdges.map((e) => {
    let condition = e.data?.condition ?? null;
    if (e.sourceHandle === 'true') condition = true;
    if (e.sourceHandle === 'false') condition = false;
    return {
      id: e.id,
      fromNodeId: e.source,
      toNodeId: e.target,
      condition
    };
  });

  return {
    ...baseProcess,
    nodes,
    edges
  };
}

/**
 * @param {Object} process
 * @returns {{ nodes: import('@vue-flow/core').Node[], edges: import('@vue-flow/core').Edge[] }}
 */
export function processToFlow(process) {
  const nodes = (process.nodes || []).map((n) => ({
    id: n.id,
    type: 'processFlow',
    position: {
      x: n.layout?.x ?? 0,
      y: n.layout?.y ?? 0
    },
    data: {
      processType: n.type,
      label: getNodeTypeLabel(n.type),
      sentence: buildNodeSentence(n, process),
      config: n.config || {},
      version: n.version ?? 1,
      meta: n.meta || {}
    }
  }));

  const edges = (process.edges || []).map((e) => {
    const isTrue = e.condition === true || e.condition === 'true';
    const isFalse = e.condition === false || e.condition === 'false';
    return {
      id: e.id,
      source: e.fromNodeId,
      target: e.toNodeId,
      sourceHandle: isTrue ? 'true' : isFalse ? 'false' : undefined,
      label: isTrue ? 'Yes' : isFalse ? 'No' : undefined,
      data: { condition: e.condition ?? null }
    };
  });

  return { nodes, edges };
}

export function createFlowNode(processType, position, partialConfig = {}) {
  const id = generateId(processType);
  const config = getDefaultConfig(processType, partialConfig);
  const node = {
    id,
    type: processType,
    version: 1,
    config,
    layout: position,
    meta: { color: null, icon: null, notes: null, tags: [] }
  };
  const vf = processToFlow({ nodes: [node], edges: [], trigger: { type: 'manual' } });
  return vf.nodes[0];
}

function getDefaultConfig(processType, partial = {}) {
  switch (processType) {
    case 'trigger':
      return { eventType: partial.eventType || null, ...partial };
    case 'condition':
      return {
        condition: {
          field: partial.field || 'event.currentState.stage',
          operator: partial.operator || 'equals',
          value: partial.value ?? ''
        }
      };
    case 'field_rule':
      return {
        entityType: partial.entityType || 'deal',
        fieldKey: partial.fieldKey || '',
        rule: partial.rule || 'mandatory',
        value: partial.value ?? true
      };
    case 'ownership_rule':
      return {
        entityType: partial.entityType || 'deal',
        assignment: partial.assignment || 'role',
        target: partial.target || ''
      };
    case 'status_guard':
      return {
        entityType: partial.entityType || 'deal',
        field: partial.field || 'stage',
        allowedTransitions: partial.allowedTransitions || [],
        blockReason: partial.blockReason || ''
      };
    case 'approval_gate':
      return {
        approvers: partial.approvers || { type: 'role', role: 'manager' },
        timeoutHours: partial.timeoutHours || 48
      };
    case 'wait':
      return {
        duration: partial.duration ?? 2,
        unit: partial.unit || 'days'
      };
    case 'action':
      return {
        actionType: partial.actionType || '',
        params: partial.params || {}
      };
    case 'end':
      return {};
    default:
      return { ...partial };
  }
}

/**
 * Keep canvas in sync with process.trigger (add/remove trigger node).
 */
export function syncTriggerNodeOnGraph(process, vfNodes, vfEdges) {
  const needsTrigger =
    (process.trigger?.type === 'domain_event' && process.trigger?.eventType) ||
    process.trigger?.type === 'webhook';
  const existing = vfNodes.find((n) => n.data.processType === 'trigger');
  let nodes = [...vfNodes];
  let edges = [...vfEdges];

  if (needsTrigger && !existing) {
    const triggerNode = createFlowNode('trigger', { x: 280, y: 40 }, {
      eventType: process.trigger.eventType,
      triggerKind: process.trigger.type
    });
    nodes = [triggerNode, ...nodes.map((n, i) => ({
      ...n,
      position: { ...n.position, y: n.position.y + 100 }
    }))];
    const firstNonTrigger = nodes.find((n) => n.data.processType !== 'trigger' && n.id !== triggerNode.id);
    if (firstNonTrigger) {
      edges = [
        {
          id: generateId('edge'),
          source: triggerNode.id,
          target: firstNonTrigger.id,
          data: { condition: null }
        },
        ...edges
      ];
    }
  } else if (needsTrigger && existing) {
    nodes = nodes.map((n) => {
      if (n.data.processType !== 'trigger') return n;
      return {
        ...n,
        data: {
          ...n.data,
          config: {
            eventType: process.trigger.eventType,
            triggerKind: process.trigger.type
          },
          sentence: buildNodeSentence(
            {
              type: 'trigger',
              config: { eventType: process.trigger.eventType, triggerKind: process.trigger.type }
            },
            process
          )
        }
      };
    });
  } else if (!needsTrigger && existing) {
    const triggerId = existing.id;
    nodes = nodes.filter((n) => n.id !== triggerId);
    edges = edges.filter((e) => e.source !== triggerId && e.target !== triggerId);
  }

  return { nodes, edges };
}

/**
 * Stack nodes vertically in execution order (trigger/start → downstream).
 */
export function tidyFlowLayout(vfNodes, vfEdges) {
  const X = 280;
  const Y_START = 40;
  const Y_GAP = 100;
  const nodeIds = new Set(vfNodes.map((n) => n.id));
  const incoming = new Map();
  for (const id of nodeIds) incoming.set(id, 0);
  for (const e of vfEdges) {
    if (nodeIds.has(e.target)) {
      incoming.set(e.target, (incoming.get(e.target) || 0) + 1);
    }
  }

  const trigger = vfNodes.find((n) => n.data?.processType === 'trigger');
  const startIds = trigger
    ? [trigger.id]
    : vfNodes.filter((n) => !incoming.get(n)).map((n) => n.id);
  if (!startIds.length && vfNodes.length) startIds.push(vfNodes[0].id);

  const order = [];
  const visited = new Set();

  function walk(id) {
    if (!id || visited.has(id) || !nodeIds.has(id)) return;
    visited.add(id);
    order.push(id);
    const outs = vfEdges
      .filter((e) => e.source === id)
      .sort((a, b) => {
        if (a.sourceHandle === 'true' && b.sourceHandle !== 'true') return -1;
        if (b.sourceHandle === 'true' && a.sourceHandle !== 'true') return 1;
        return 0;
      });
    for (const e of outs) walk(e.target);
  }

  for (const sid of startIds) walk(sid);
  for (const n of vfNodes) {
    if (!visited.has(n.id)) order.push(n.id);
  }

  const posById = new Map();
  order.forEach((id, i) => posById.set(id, { x: X, y: Y_START + i * Y_GAP }));

  return vfNodes.map((n) => ({
    ...n,
    position: posById.get(n.id) || n.position
  }));
}

export { generateId, getDefaultConfig };
