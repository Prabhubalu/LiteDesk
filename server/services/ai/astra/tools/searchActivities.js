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

async function executeSearchActivities({
  organizationId,
  query = '',
  limit = 6,
} = {}) {
  const q = String(query || '').trim();
  if (!q) {
    return { tasks: [], events: [], citations: [], query: '' };
  }
  const pack = await searchService.searchAll(organizationId, q, {
    limitPerModule: Math.max(1, Math.min(Number(limit) || 6, 10)),
  });
  const tasks = Array.isArray(pack?.results?.tasks) ? pack.results.tasks : [];
  const events = Array.isArray(pack?.results?.events) ? pack.results.events : [];
  const citations = [
    ...toCitations(tasks, 'tasks'),
    ...toCitations(events, 'events'),
  ];
  return {
    tasks,
    events,
    citations,
    query: q,
  };
}

registerTool({
  name: 'SearchActivities',
  description: 'Search tasks and events/meetings related to a keyword or account.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      limit: { type: 'number' },
    },
    required: ['query'],
  },
  execute: executeSearchActivities,
});

module.exports = { executeSearchActivities };
