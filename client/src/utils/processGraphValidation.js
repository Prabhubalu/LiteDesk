/**
 * Client-side process graph rules (mirrors server validateProcessGraph Phase 3c).
 */

function nodeTypeFromFlowNode(node) {
  return node?.data?.processType || node?.type;
}

function flowEdgesToProcessEdges(vfEdges) {
  return (vfEdges || []).map((e) => ({
    id: e.id,
    fromNodeId: e.source,
    toNodeId: e.target,
    condition: e.data?.condition ?? (e.sourceHandle === 'true' ? true : e.sourceHandle === 'false' ? false : null)
  }));
}

function flowNodesToProcessNodes(vfNodes) {
  return (vfNodes || []).map((n) => ({
    id: n.id,
    type: nodeTypeFromFlowNode(n)
  }));
}

/**
 * Validate a proposed Vue Flow connection before adding an edge.
 */
export function validateFlowConnection(process, vfNodes, vfEdges, connection) {
  const nodes = flowNodesToProcessNodes(vfNodes);
  const edges = flowEdgesToProcessEdges(vfEdges);
  const source = nodes.find((n) => n.id === connection.source);
  const target = nodes.find((n) => n.id === connection.target);

  if (!source || !target) {
    return { valid: false, code: 'INVALID_NODE', message: 'Invalid connection' };
  }

  if (source.id === target.id) {
    return { valid: false, code: 'SELF_LOOP', message: 'Cannot connect a step to itself' };
  }

  if (source.type === 'end') {
    return { valid: false, code: 'END_OUTGOING', message: 'End step cannot have outgoing connections' };
  }

  if (target.type === 'trigger') {
    return { valid: false, code: 'TRIGGER_INCOMING', message: 'Cannot connect into a trigger step' };
  }

  const existingOut = edges.filter((e) => e.fromNodeId === source.id);
  const existingIn = edges.filter((e) => e.toNodeId === target.id);

  if (target.type !== 'trigger' && existingIn.length >= 1) {
    return {
      valid: false,
      code: 'PARALLEL_INCOMING',
      message: 'This step already has an incoming connection (parallel merge is not supported in v1)'
    };
  }

  let condition = null;
  if (connection.sourceHandle === 'true') condition = true;
  if (connection.sourceHandle === 'false') condition = false;

  if (source.type === 'condition') {
    if (condition == null) {
      return { valid: false, code: 'CONDITION_HANDLE', message: 'Connect from the Yes or No handle on an IF step' };
    }
    const hasBranch = existingOut.some(
      (e) => e.condition === condition || (condition === true && (e.condition === true || e.condition === 'true')) || (condition === false && (e.condition === false || e.condition === 'false'))
    );
    if (hasBranch) {
      return { valid: false, code: 'CONDITION_BRANCH_EXISTS', message: 'This IF branch already has a connection' };
    }
    if (existingOut.length >= 2) {
      return { valid: false, code: 'CONDITION_OUT_DEGREE', message: 'IF step supports only True and False branches' };
    }
  } else {
    if (condition != null) {
      return { valid: false, code: 'CONDITION_EDGE_INVALID', message: 'Yes/No handles are only valid on IF steps' };
    }
    if (existingOut.length >= 1) {
      return {
        valid: false,
        code: 'PARALLEL_OUTGOING',
        message: 'Only IF steps may branch. This step already has an outgoing connection.'
      };
    }
  }

  const hypothetical = [
    ...edges,
    {
      id: '__new__',
      fromNodeId: connection.source,
      toNodeId: connection.target,
      condition
    }
  ];

  if (wouldCreateCycle(nodes, hypothetical)) {
    return { valid: false, code: 'GRAPH_CYCLE', message: 'This connection would create a loop (not supported in v1)' };
  }

  return { valid: true };
}

function wouldCreateCycle(nodes, edges) {
  const adj = new Map(nodes.map((n) => [n.id, []]));
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

  for (const n of nodes) {
    if (dfs(n.id)) return true;
  }
  return false;
}

/**
 * Map server validation errors to Vue Flow node/edge highlight classes.
 */
export function graphErrorsByElement(errors = []) {
  const byNode = new Map();
  const byEdge = new Map();
  for (const err of errors) {
    if (err.nodeId) {
      if (!byNode.has(err.nodeId)) byNode.set(err.nodeId, []);
      byNode.get(err.nodeId).push(err.message);
    }
    if (err.edgeId) {
      if (!byEdge.has(err.edgeId)) byEdge.set(err.edgeId, []);
      byEdge.get(err.edgeId).push(err.message);
    }
  }
  return { byNode, byEdge };
}
