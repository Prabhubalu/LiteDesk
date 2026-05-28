/**
 * Apply execution graph-state to Vue Flow nodes and edges.
 */

const NODE_STATUS_CLASS = {
  completed: 'execution-node--completed',
  running: 'execution-node--running',
  failed: 'execution-node--failed',
  skipped: 'execution-node--skipped',
  pending: ''
};

const EDGE_STATUS_CLASS = {
  traversed: 'execution-edge--traversed',
  skipped: 'execution-edge--skipped'
};

export function applyGraphStateToFlow(flowNodes, flowEdges, graphState) {
  if (!graphState) {
    return {
      nodes: flowNodes.map((n) => stripExecution(n)),
      edges: flowEdges.map((e) => stripExecutionEdge(e))
    };
  }

  const nodes = flowNodes.map((n) => {
    const info = graphState.nodes?.[n.id] || { status: 'pending' };
    const cls = NODE_STATUS_CLASS[info.status] || '';
    return {
      ...n,
      class: cls,
      data: {
        ...n.data,
        executionStatus: info.status,
        executionMessage: info.message,
        executionDurationMs: info.durationMs
      }
    };
  });

  const edges = flowEdges.map((e) => {
    const info = graphState.edges?.[e.id] || { traversed: false };
    const cls = info.traversed ? EDGE_STATUS_CLASS.traversed : EDGE_STATUS_CLASS.skipped;
    return {
      ...e,
      class: graphState ? cls : '',
      animated: !!info.traversed && graphState.status === 'running',
      style: info.traversed
        ? { stroke: '#22c55e', strokeWidth: 2 }
        : graphState
        ? { stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '4 4' }
        : undefined
    };
  });

  return { nodes, edges };
}

function stripExecution(n) {
  const data = { ...n.data };
  delete data.executionStatus;
  delete data.executionMessage;
  delete data.executionDurationMs;
  return { ...n, class: '', data };
}

function stripExecutionEdge(e) {
  return {
    ...e,
    class: '',
    animated: false,
    style: undefined
  };
}

export function executionStatusLabel(status) {
  const labels = {
    completed: 'Completed',
    running: 'Running',
    failed: 'Failed',
    skipped: 'Skipped',
    pending: 'Not run'
  };
  return labels[status] || status;
}
