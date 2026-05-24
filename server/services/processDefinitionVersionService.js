'use strict';

const ProcessDefinitionVersion = require('../models/ProcessDefinitionVersion');
const { normalizeProcessGraph } = require('../utils/processGraphUtils');
const { buildGraphState } = require('./processExecutionTracker');

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * Build immutable snapshot from a process document (draft or active).
 */
function buildSnapshotFromProcess(process) {
  return {
    trigger: deepClone(process.trigger || { type: 'manual', eventType: null }),
    nodes: deepClone(process.nodes || []),
    edges: deepClone(process.edges || []),
    appKey: process.appKey,
    entityType: process.entityType || null
  };
}

/**
 * Merge process metadata with published snapshot for execution / overlay.
 */
function runnableProcessFromDefinition(processDoc, definitionVersion) {
  if (!definitionVersion?.snapshot) {
    return processDoc;
  }
  const snap = definitionVersion.snapshot;
  return {
    ...processDoc,
    trigger: snap.trigger,
    nodes: snap.nodes || [],
    edges: snap.edges || [],
    appKey: snap.appKey || processDoc.appKey,
    entityType: snap.entityType || processDoc.entityType
  };
}

/**
 * Create a new published version on activate. Mutates processDoc in memory.
 */
async function publishProcessDefinition(processDoc, publishedBy) {
  const nextVersion = Math.max(0, Number(processDoc.version) || 0) + 1;
  const snapshot = buildSnapshotFromProcess(processDoc);

  const definition = await ProcessDefinitionVersion.create({
    processId: processDoc._id,
    versionNumber: nextVersion,
    snapshot,
    publishedAt: new Date(),
    publishedBy: publishedBy || null
  });

  processDoc.version = nextVersion;
  processDoc.activeDefinitionVersionId = definition._id;

  return definition;
}

async function getActiveDefinitionVersion(processDoc) {
  if (!processDoc?.activeDefinitionVersionId) return null;
  return ProcessDefinitionVersion.findById(processDoc.activeDefinitionVersionId).lean();
}

async function getDefinitionVersionById(versionId) {
  if (!versionId) return null;
  return ProcessDefinitionVersion.findById(versionId).lean();
}

/**
 * Graph used to start a new run (active process only).
 */
async function resolveRunnableProcessForStart(processDoc) {
  if (processDoc.status !== 'active') {
    return { runnable: processDoc, definition: null, error: `Process status is ${processDoc.status}, must be 'active'` };
  }

  const definition = await getActiveDefinitionVersion(processDoc);
  if (!definition) {
    return {
      runnable: null,
      definition: null,
      error: 'No published definition. Save and activate the process to publish a version.'
    };
  }

  return {
    runnable: runnableProcessFromDefinition(processDoc, definition),
    definition,
    error: null
  };
}

/**
 * Graph for resume / replay — bound to execution's published version when present.
 */
async function resolveRunnableProcessForExecution(processDoc, execution) {
  if (execution?.processDefinitionVersionId) {
    const definition = await getDefinitionVersionById(execution.processDefinitionVersionId);
    if (definition) {
      return runnableProcessFromDefinition(processDoc, definition);
    }
  }
  return runnableProcessFromDefinition(processDoc, null);
}

/**
 * Run insight: overlay + snapshot graph + version metadata.
 */
async function buildExecutionInsightPayload(processDoc, execution) {
  const execDefinition = execution.processDefinitionVersionId
    ? await getDefinitionVersionById(execution.processDefinitionVersionId)
    : null;
  const currentDefinition = await getActiveDefinitionVersion(processDoc);

  const graphProcess = normalizeProcessGraph(
    runnableProcessFromDefinition(processDoc, execDefinition),
    { autoLayout: false }
  );

  const graphState = buildGraphState(execution, graphProcess);
  const execVersionNumber = execDefinition?.versionNumber ?? execution.processDefinitionVersionNumber ?? null;
  const currentVersionNumber = currentDefinition?.versionNumber ?? processDoc.version ?? null;

  return {
    ...graphState,
    processGraph: {
      trigger: graphProcess.trigger,
      nodes: graphProcess.nodes,
      edges: graphProcess.edges,
      appKey: graphProcess.appKey,
      entityType: graphProcess.entityType
    },
    definitionVersion: execVersionNumber
      ? {
          id: execDefinition?._id?.toString() || execution.processDefinitionVersionId?.toString(),
          versionNumber: execVersionNumber,
          publishedAt: execDefinition?.publishedAt || null
        }
      : null,
    currentPublishVersion: currentVersionNumber,
    newerVersionAvailable:
      execVersionNumber != null &&
      currentVersionNumber != null &&
      currentVersionNumber > execVersionNumber
  };
}

module.exports = {
  buildSnapshotFromProcess,
  runnableProcessFromDefinition,
  publishProcessDefinition,
  getActiveDefinitionVersion,
  resolveRunnableProcessForStart,
  resolveRunnableProcessForExecution,
  buildExecutionInsightPayload
};
