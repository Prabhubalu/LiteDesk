import { ref } from 'vue';

/**
 * Draft configs for process flow steps — survives Vue Flow selection / re-render.
 * Source of truth while editing; synced to flowNodes on each update.
 */

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? {}));
}

/**
 * @param {import('@vue-flow/core').Node[]} vfNodes
 * @returns {Record<string, { processType: string, config: object, sentence: string }>}
 */
export function buildDraftsFromFlowNodes(vfNodes = []) {
  const drafts = {};
  for (const n of vfNodes) {
    if (!n?.id) continue;
    drafts[n.id] = {
      processType: n.data?.processType || n.type,
      config: cloneJson(n.data?.config),
      sentence: n.data?.sentence || ''
    };
  }
  return drafts;
}

/**
 * Apply all drafts onto Vue Flow nodes (draft wins over node.data).
 */
export function applyDraftsToFlowNodes(vfNodes, drafts) {
  return vfNodes.map((n) => {
    const d = drafts[n.id];
    if (!d) return n;
    return {
      ...n,
      data: {
        ...n.data,
        config: cloneJson(d.config),
        sentence: d.sentence ?? n.data?.sentence ?? ''
      }
    };
  });
}

export function useProcessNodeDrafts() {
  const drafts = ref({});

  /** Replace all drafts (e.g. after loading process from API). */
  function loadFromFlowNodes(vfNodes) {
    drafts.value = buildDraftsFromFlowNodes(vfNodes);
  }

  /** Merge canvas into drafts without overwriting in-progress edits. */
  function mergeFromFlowNodes(vfNodes) {
    const fromNodes = buildDraftsFromFlowNodes(vfNodes);
    drafts.value = { ...fromNodes, ...drafts.value };
  }

  function getDraft(nodeId) {
    return drafts.value[nodeId] || null;
  }

  function setDraft(nodeId, processType, config, sentence) {
    if (!nodeId) return;
    drafts.value = {
      ...drafts.value,
      [nodeId]: {
        processType: processType || drafts.value[nodeId]?.processType || 'action',
        config: cloneJson(config),
        sentence: sentence ?? drafts.value[nodeId]?.sentence ?? ''
      }
    };
  }

  function removeDraft(nodeId) {
    if (!nodeId || !drafts.value[nodeId]) return;
    const next = { ...drafts.value };
    delete next[nodeId];
    drafts.value = next;
  }

  function applyToFlowNodes(vfNodes) {
    return applyDraftsToFlowNodes(vfNodes, drafts.value);
  }

  /** Build inspector-facing node from canvas node + draft. */
  function nodeForInspector(vfNode) {
    if (!vfNode?.id) return null;
    const d = drafts.value[vfNode.id];
    if (!d) return vfNode;
    return {
      ...vfNode,
      data: {
        ...vfNode.data,
        processType: d.processType,
        config: cloneJson(d.config),
        sentence: d.sentence
      }
    };
  }

  return {
    drafts,
    loadFromFlowNodes,
    mergeFromFlowNodes,
    getDraft,
    setDraft,
    removeDraft,
    applyToFlowNodes,
    nodeForInspector
  };
}
