'use strict';

const mongoose = require('mongoose');
const TelephonyIvrFlow = require('../../models/TelephonyIvrFlow');
const { getProviderForOrganization } = require('./telephonyProviderRegistry');

async function listFlows(organizationId) {
  return TelephonyIvrFlow.find({ organizationId }).sort({ updatedAt: -1 }).lean();
}

async function getFlow(organizationId, flowId) {
  if (!mongoose.Types.ObjectId.isValid(flowId)) return null;
  return TelephonyIvrFlow.findOne({ _id: flowId, organizationId }).lean();
}

async function createFlow(organizationId, payload = {}) {
  const name = String(payload.name || '').trim();
  if (!name) {
    const err = new Error('name is required');
    err.statusCode = 400;
    throw err;
  }
  return TelephonyIvrFlow.create({
    organizationId,
    name,
    status: 'draft',
    nodes: Array.isArray(payload.nodes) ? payload.nodes : [],
    edges: Array.isArray(payload.edges) ? payload.edges : [],
  });
}

async function updateFlow(organizationId, flowId, payload = {}) {
  const row = await TelephonyIvrFlow.findOne({ _id: flowId, organizationId });
  if (!row) {
    const err = new Error('IVR flow not found');
    err.statusCode = 404;
    throw err;
  }
  if (payload.name != null) row.name = String(payload.name).trim();
  if (Array.isArray(payload.nodes)) row.nodes = payload.nodes;
  if (Array.isArray(payload.edges)) row.edges = payload.edges;
  if (row.status === 'published') {
    row.status = 'draft';
    row.publishedAt = null;
  }
  await row.save();
  return row;
}

async function publishFlow(organizationId, flowId) {
  const row = await TelephonyIvrFlow.findOne({ _id: flowId, organizationId });
  if (!row) {
    const err = new Error('IVR flow not found');
    err.statusCode = 404;
    throw err;
  }
  const adapter = await getProviderForOrganization(organizationId);
  let compiled = null;
  if (adapter) {
    compiled = await adapter.compileIvrFlow({
      nodes: row.nodes,
      edges: row.edges,
      name: row.name,
    });
  }
  row.status = 'published';
  row.publishedAt = new Date();
  row.providerCompiledMeta = compiled;
  await row.save();
  return row;
}

async function deleteFlow(organizationId, flowId) {
  const result = await TelephonyIvrFlow.deleteOne({ _id: flowId, organizationId });
  return { deleted: result.deletedCount > 0 };
}

module.exports = {
  listFlows,
  getFlow,
  createFlow,
  updateFlow,
  publishFlow,
  deleteFlow,
};
