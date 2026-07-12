'use strict';

/**
 * For-each loop control: bind each fetched record as the active entity
 * while walking For each → body → End for each (supports nesting).
 */

function snapshotRecordBinding(context) {
  return {
    entityId: context.entityId,
    entityType: context.entityType,
    assignedTo: context.assignedTo,
    eventCurrentState: context.event?.currentState,
    eventEntityId: context.event?.entityId,
    eventEntityType: context.event?.entityType,
    dataBagCurrentRecord: context.dataBag?.currentRecord,
    forEachItem: context.dataBag?.forEachItem,
    forEachIndex: context.dataBag?.forEachIndex,
    forEachTotal: context.dataBag?.forEachTotal
  };
}

function restoreRecordBinding(context, snap) {
  if (!snap) return;
  context.entityId = snap.entityId;
  context.entityType = snap.entityType;
  context.assignedTo = snap.assignedTo;
  context.event = context.event || {};
  context.event.currentState = snap.eventCurrentState;
  context.event.entityId = snap.eventEntityId;
  context.event.entityType = snap.eventEntityType;
  context.dataBag = context.dataBag || {};
  context.dataBag.currentRecord = snap.dataBagCurrentRecord;
  context.dataBag.forEachItem = snap.forEachItem;
  context.dataBag.forEachIndex = snap.forEachIndex;
  context.dataBag.forEachTotal = snap.forEachTotal;
}

function bindFetchedRecord(context, record, moduleKey, index, total) {
  const id = record?._id || record?.id;
  context.entityId = id != null ? String(id) : null;
  if (moduleKey) context.entityType = moduleKey;
  const owner = record?.assignedTo || record?.ownerId || record?.owner;
  if (owner != null) context.assignedTo = owner;
  context.event = context.event || {};
  context.event.currentState =
    record && typeof record === 'object' && !Array.isArray(record) ? { ...record } : {};
  context.event.entityId = context.entityId;
  context.event.entityType = context.entityType;
  context.dataBag = context.dataBag || {};
  context.dataBag.currentRecord = record;
  context.dataBag.forEachItem = record;
  context.dataBag.forEachIndex = index;
  context.dataBag.forEachTotal = total;
}

/**
 * Find matching for_each_end for this loop body.
 * Nested for_each raises depth; nested for_each_end lowers it.
 * First for_each_end at depth 0 is this loop's end.
 */
function findForEachEndNodeId(bodyStartId, edges, nodeMap) {
  if (!bodyStartId) return null;
  const stack = [{ id: bodyStartId, depth: 0 }];
  const seen = new Set();

  while (stack.length) {
    const { id, depth } = stack.pop();
    if (!id || depth < 0) continue;
    const key = `${id}#${depth}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const node = nodeMap.get(id);
    if (!node) continue;

    if (node.type === 'for_each_end') {
      if (depth === 0) return id;
      for (const edge of edges) {
        if (edge.fromNodeId === id && edge.toNodeId) {
          stack.push({ id: edge.toNodeId, depth: depth - 1 });
        }
      }
      continue;
    }

    if (node.type === 'for_each') {
      for (const edge of edges) {
        if (edge.fromNodeId === id && edge.toNodeId) {
          stack.push({ id: edge.toNodeId, depth: depth + 1 });
        }
      }
      continue;
    }

    for (const edge of edges) {
      if (edge.fromNodeId === id && edge.toNodeId) {
        stack.push({ id: edge.toNodeId, depth });
      }
    }
  }
  return null;
}

module.exports = {
  snapshotRecordBinding,
  restoreRecordBinding,
  bindFetchedRecord,
  findForEachEndNodeId
};
