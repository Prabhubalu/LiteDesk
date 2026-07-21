'use strict';

const { registerTool } = require('./registry');
const { tokenize, matchQuery, toCitations, scoreHaystack } = require('./productSearchUtils');

async function executeSearchProcessGraphs({
  organizationId,
  query = '',
  limit = 12,
  filters = {},
} = {}) {
  const Process = require('../../../../models/Process');
  const needles = tokenize(query);
  const lim = Math.max(1, Math.min(Number(limit) || 12, 25));

  const mongoQuery = {};
  if (filters.status) mongoQuery.status = String(filters.status);
  if (filters.appKey) mongoQuery.appKey = String(filters.appKey);
  // Process is tenant-scoped via wrapTenantModel (no organizationId field on schema).

  let rows = [];
  try {
    rows = await Process.find(mongoQuery)
      .select('name description appKey entityType status trigger nodes edges version updatedAt')
      .sort({ updatedAt: -1 })
      .limit(80)
      .lean();
  } catch (err) {
    return { records: [], citations: [], query, error: String(err?.message || err) };
  }

  let records = (rows || []).map((p) => {
    const nodeCount = Array.isArray(p.nodes) ? p.nodes.length : 0;
    const edgeCount = Array.isArray(p.edges) ? p.edges.length : 0;
    const nodeTypes = Array.isArray(p.nodes)
      ? [...new Set(p.nodes.map((n) => n.type).filter(Boolean))].slice(0, 8)
      : [];
    return {
      id: String(p._id),
      type: 'process',
      title: p.name || String(p._id),
      subtitle: `${p.status || 'draft'} • ${p.appKey || ''} • ${p.entityType || ''} • trigger=${p.trigger?.type || p.trigger?.eventType || 'n/a'} • nodes=${nodeCount}`,
      status: p.status,
      appKey: p.appKey,
      entityType: p.entityType,
      trigger: {
        type: p.trigger?.type || null,
        eventType: p.trigger?.eventType || null,
      },
      nodeCount,
      edgeCount,
      nodeTypes,
      description: String(p.description || '').slice(0, 240),
      version: p.version,
    };
  }).filter((row) => matchQuery(row, needles, [
    'title', 'subtitle', 'description', 'appKey', 'entityType', 'status',
  ]));

  if (needles.length) {
    records = records
      .map((r) => ({ r, s: scoreHaystack(`${r.title} ${r.subtitle} ${r.description}`, needles) }))
      .sort((a, b) => b.s - a.s)
      .map(({ r }) => r);
  }
  records = records.slice(0, lim);

  return {
    records,
    citations: toCitations(records, 'process'),
    query,
    filters,
  };
}

registerTool({
  name: 'SearchProcessGraphs',
  description: 'Search Process Designer graphs (triggers, node counts, status) for the tenant.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      limit: { type: 'number' },
      filters: { type: 'object' },
    },
  },
  execute: executeSearchProcessGraphs,
});

module.exports = { executeSearchProcessGraphs };
