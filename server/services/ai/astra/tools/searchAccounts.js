'use strict';

const searchService = require('../../../searchService');
const { registerTool } = require('./registry');

function toCitations(rows, sourceType) {
  return (rows || []).map((row) => ({
    sourceType,
    sourceId: String(row.id || row._id || ''),
    excerpt: String(row.title || row.name || '').slice(0, 120),
    score: 1,
  })).filter((c) => c.sourceId);
}

async function executeSearchAccounts({ organizationId, query = '', limit = 5 } = {}) {
  const q = String(query || '').trim();
  if (!q) {
    return { records: [], citations: [], query: '' };
  }
  const pack = await searchService.searchAll(organizationId, q, {
    limitPerModule: Math.max(1, Math.min(Number(limit) || 5, 10)),
  });
  const records = Array.isArray(pack?.results?.organizations) ? pack.results.organizations : [];
  return {
    records,
    citations: toCitations(records, 'organizations'),
    query: q,
  };
}

registerTool({
  name: 'SearchAccounts',
  description: 'Search CRM accounts/organizations by name or keyword (tenant-scoped).',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      limit: { type: 'number' },
    },
    required: ['query'],
  },
  execute: executeSearchAccounts,
});

module.exports = { executeSearchAccounts };
