/**
 * Process graph normalization, edge ID migration, and auto-layout helpers.
 */

const crypto = require('crypto');

const NODE_TYPES = [
  'trigger', 'condition', 'action', 'data_mapping', 'end',
  'field_rule', 'ownership_rule', 'status_guard', 'approval_gate', 'wait',
  'for_each', 'for_each_end'
];

function generateId(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * Assign stable edge ids to legacy edges missing id.
 * @param {Array} edges
 * @returns {Array}
 */
function ensureEdgeIds(edges = []) {
  const seen = new Set();
  return edges.map((edge) => {
    let id = edge.id;
    if (!id || seen.has(id)) {
      id = generateId('edge');
    }
    seen.add(id);
    return {
      id,
      fromNodeId: edge.fromNodeId,
      toNodeId: edge.toNodeId,
      condition: edge.condition ?? null
    };
  });
}

/**
 * Normalize nodes: version, layout, meta defaults.
 * @param {Array} nodes
 * @returns {Array}
 */
function normalizeNodes(nodes = []) {
  return nodes.map((node) => ({
    ...node,
    version: typeof node.version === 'number' ? node.version : 1,
    layout: node.layout && typeof node.layout.x === 'number' && typeof node.layout.y === 'number'
      ? { x: node.layout.x, y: node.layout.y }
      : null,
    meta: node.meta && typeof node.meta === 'object'
      ? {
          color: node.meta.color ?? null,
          icon: node.meta.icon ?? null,
          notes: node.meta.notes ?? null,
          tags: Array.isArray(node.meta.tags) ? node.meta.tags : []
        }
      : { color: null, icon: null, notes: null, tags: [] }
  }));
}

/**
 * Topological walk order from start node for auto-layout.
 */
function getLayoutOrder(nodes, edges, triggerType) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  let startId = null;

  if (triggerType === 'domain_event' || triggerType === 'webhook') {
    const trigger = nodes.find((n) => n.type === 'trigger');
    startId = trigger?.id ?? null;
    if (triggerType === 'webhook' && startId) {
      const out = edges.find((e) => e.fromNodeId === startId);
      if (out?.toNodeId) startId = out.toNodeId;
    }
  }
  if (!startId && nodes.length > 0) {
    const nonTrigger = nodes.find((n) => n.type !== 'trigger');
    startId = nonTrigger?.id ?? nodes[0].id;
  }

  const order = [];
  const visited = new Set();
  let currentId = startId;

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    order.push(currentId);
    const out = edges.filter((e) => e.fromNodeId === currentId);
    const next = out.find((e) => e.condition === true || e.condition === 'true')
      || out.find((e) => e.condition == null)
      || out[0];
    currentId = next?.toNodeId ?? null;
  }

  for (const n of nodes) {
    if (!visited.has(n.id)) order.push(n.id);
  }

  return order;
}

const LAYOUT_X = 280;
const LAYOUT_START_Y = 80;
const LAYOUT_ROW_HEIGHT = 120;

/**
 * Apply vertical auto-layout to nodes missing layout.
 */
function applyAutoLayout(nodes, edges, triggerType) {
  const order = getLayoutOrder(nodes, edges, triggerType);
  const orderIndex = new Map(order.map((id, i) => [id, i]));

  return nodes.map((node) => {
    if (node.layout) return node;
    const idx = orderIndex.get(node.id) ?? 0;
    return {
      ...node,
      layout: {
        x: LAYOUT_X,
        y: LAYOUT_START_Y + idx * LAYOUT_ROW_HEIGHT
      }
    };
  });
}

/**
 * Full graph normalization for API responses and saves.
 * @param {Object} process - plain process object
 * @param {{ autoLayout?: boolean }} options
 */
function normalizeProcessGraph(process, options = {}) {
  const { autoLayout = true } = options;
  const triggerType = process.trigger?.type || 'manual';

  let nodes = normalizeNodes(process.nodes || []);
  let edges = ensureEdgeIds(process.edges || []);

  if (autoLayout) {
    nodes = applyAutoLayout(nodes, edges, triggerType);
  }

  return {
    ...process,
    nodes,
    edges
  };
}

/**
 * Resolve BFS/validation start node id for a process graph.
 */
function resolveGraphStartNodeId(processData) {
  const nodes = processData.nodes || [];
  const edges = processData.edges || [];
  const triggerType = processData.trigger?.type || 'manual';

  if (triggerType === 'domain_event') {
    return nodes.find((n) => n.type === 'trigger')?.id || null;
  }

  if (triggerType === 'webhook') {
    const trigger = nodes.find((n) => n.type === 'trigger');
    if (trigger) {
      const out = edges.find((e) => e.fromNodeId === trigger.id);
      return out?.toNodeId || trigger.id;
    }
  }

  const sorted = [...nodes].sort((a, b) => {
    if (a.order != null && b.order != null) return a.order - b.order;
    if (a.order != null) return -1;
    if (b.order != null) return 1;
    return 0;
  });
  const nonTrigger = sorted.find((n) => n.type !== 'trigger');
  return nonTrigger?.id || sorted[0]?.id || null;
}

function detectCycle(nodeIds, edges) {
  const adj = new Map();
  for (const id of nodeIds) adj.set(id, []);
  for (const e of edges) {
    if (adj.has(e.fromNodeId)) adj.get(e.fromNodeId).push(e.toNodeId);
  }

  const visiting = new Set();
  const visited = new Set();

  function dfs(id) {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const next of adj.get(id) || []) {
      if (dfs(next)) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  }

  for (const id of nodeIds) {
    if (dfs(id)) return true;
  }
  return false;
}

/**
 * Phase 3c: sequential + IF-only topology (no parallel split/merge in v1).
 */
function validateSequentialTopology(processData, errors) {
  const nodes = processData.nodes || [];
  const edges = processData.edges || [];
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  for (const node of nodes) {
    const outgoing = edges.filter((e) => e.fromNodeId === node.id);
    const incoming = edges.filter((e) => e.toNodeId === node.id);

    if (node.type === 'end' && outgoing.length > 0) {
      errors.push({
        nodeId: node.id,
        code: 'END_OUTGOING',
        message: 'End step cannot have outgoing connections'
      });
    }

    if (node.type === 'trigger' && incoming.length > 0) {
      errors.push({
        nodeId: node.id,
        code: 'TRIGGER_INCOMING',
        message: 'Trigger step cannot have incoming connections'
      });
    }

    if (node.type !== 'trigger' && incoming.length > 1) {
      errors.push({
        nodeId: node.id,
        code: 'PARALLEL_INCOMING',
        message: 'Only one incoming connection allowed (parallel merge is not supported in v1)'
      });
    }

    if (node.type === 'condition') {
      if (outgoing.length > 2) {
        errors.push({
          nodeId: node.id,
          code: 'CONDITION_OUT_DEGREE',
          message: 'IF step supports only True and False branches'
        });
      }
      continue;
    }

    if (outgoing.length > 1) {
      errors.push({
        nodeId: node.id,
        code: 'PARALLEL_OUTGOING',
        message: 'Only IF steps may branch. Connect one outgoing edge per step.'
      });
    }
  }

  for (const edge of edges) {
    const from = nodeById.get(edge.fromNodeId);
    const to = nodeById.get(edge.toNodeId);
    if (from?.type === 'condition') continue;
    if (edge.condition === true || edge.condition === false || edge.condition === 'true' || edge.condition === 'false') {
      errors.push({
        edgeId: edge.id,
        code: 'CONDITION_EDGE_INVALID',
        message: 'Yes/No handles are only valid on IF steps'
      });
    }
  }
}

function validateAcyclicAndReachable(processData, errors) {
  const nodes = processData.nodes || [];
  const edges = processData.edges || [];
  const nodeIds = nodes.map((n) => n.id).filter(Boolean);

  if (edges.length > 0 && detectCycle(nodeIds, edges)) {
    errors.push({
      code: 'GRAPH_CYCLE',
      message: 'Process graph cannot contain cycles (loops are not supported in v1)'
    });
  }

  const startId = resolveGraphStartNodeId(processData);
  if (!startId) return;

  const reachable = new Set([startId]);
  const queue = [startId];
  while (queue.length) {
    const id = queue.shift();
    for (const e of edges.filter((ed) => ed.fromNodeId === id)) {
      if (e.toNodeId && !reachable.has(e.toNodeId)) {
        reachable.add(e.toNodeId);
        queue.push(e.toNodeId);
      }
    }
  }

  for (const node of nodes) {
    if (!reachable.has(node.id)) {
      errors.push({
        nodeId: node.id,
        code: 'UNREACHABLE_NODE',
        message: 'Step is not reachable from the process start'
      });
    }
  }
}

/**
 * Validate graph per PROCESS_FLOW_DESIGNER spec (structured errors).
 * @param {Object} processData
 * @param {{ requireNodes?: boolean, strictTopology?: boolean }} [options]
 *   - requireNodes false: allow empty draft canvas
 *   - strictTopology false: allow disconnected / incomplete IF (draft saves only)
 */
function validateProcessGraph(processData, options = {}) {
  const errors = [];
  const requireNodes = options.requireNodes !== false;
  const strictTopology = options.strictTopology !== false;

  if (!processData.nodes?.length) {
    if (!requireNodes) {
      return { valid: true, errors: [] };
    }
    errors.push({ code: 'NO_NODES', message: 'Process must have at least one step' });
    return { valid: false, errors };
  }

  const nodeIds = new Set();
  for (const node of processData.nodes) {
    if (!node.id) {
      errors.push({ code: 'NODE_ID', message: 'All nodes must have an id' });
      continue;
    }
    if (nodeIds.has(node.id)) {
      errors.push({ nodeId: node.id, code: 'DUPLICATE_NODE', message: `Duplicate node id: ${node.id}` });
    }
    nodeIds.add(node.id);
    if (!NODE_TYPES.includes(node.type)) {
      errors.push({ nodeId: node.id, code: 'INVALID_TYPE', message: `Invalid node type: ${node.type}` });
    }
    if (node.version == null || node.version < 1) {
      errors.push({ nodeId: node.id, code: 'NODE_VERSION', message: `Node ${node.id} requires version >= 1` });
    }
  }

  const edgeIds = new Set();
  const edges = processData.edges || [];

  for (const edge of edges) {
    if (!edge.id) {
      errors.push({ code: 'EDGE_ID', message: 'All edges must have an id' });
      continue;
    }
    if (edgeIds.has(edge.id)) {
      errors.push({ edgeId: edge.id, code: 'DUPLICATE_EDGE', message: `Duplicate edge id: ${edge.id}` });
    }
    edgeIds.add(edge.id);

    if (!nodeIds.has(edge.fromNodeId)) {
      errors.push({ edgeId: edge.id, code: 'INVALID_FROM', message: `Invalid fromNodeId: ${edge.fromNodeId}` });
    }
    if (!nodeIds.has(edge.toNodeId)) {
      errors.push({ edgeId: edge.id, code: 'INVALID_TO', message: `Invalid toNodeId: ${edge.toNodeId}` });
    }
  }

  // Condition nodes: two branches
  for (const node of processData.nodes) {
    if (node.type !== 'condition') continue;
    const out = edges.filter((e) => e.fromNodeId === node.id);
    const hasTrue = out.some((e) => e.condition === true || e.condition === 'true');
    const hasFalse = out.some((e) => e.condition === false || e.condition === 'false');
    if (!hasTrue || !hasFalse) {
      errors.push({
        nodeId: node.id,
        code: 'CONDITION_BRANCHES',
        message: 'IF node must have True and False outgoing edges'
      });
    }
  }

  if (processData.trigger?.type === 'domain_event' || processData.trigger?.type === 'webhook') {
    const hasTrigger = processData.nodes.some((n) => n.type === 'trigger');
    if (!hasTrigger) {
      errors.push({
        code: 'MISSING_TRIGGER_NODE',
        message: `${processData.trigger.type === 'webhook' ? 'Webhook' : 'Domain event'} processes require a trigger node`
      });
    }
  }

  if (strictTopology) {
    validateSequentialTopology(processData, errors);
    validateAcyclicAndReachable(processData, errors);
  } else if ((processData.edges || []).length > 0) {
    const nodeIds = (processData.nodes || []).map((n) => n.id).filter(Boolean);
    if (detectCycle(nodeIds, processData.edges)) {
      errors.push({
        code: 'GRAPH_CYCLE',
        message: 'Process graph cannot contain cycles (loops are not supported in v1)'
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Default graph for new processes (empty canvas; user adds steps).
 */
function createDefaultProcessGraph() {
  return {
    trigger: { type: 'manual', eventType: null },
    triggerConfigured: false,
    nodes: [],
    edges: []
  };
}

module.exports = {
  NODE_TYPES,
  generateId,
  ensureEdgeIds,
  normalizeNodes,
  normalizeProcessGraph,
  validateProcessGraph,
  resolveGraphStartNodeId,
  applyAutoLayout,
  createDefaultProcessGraph
};
