'use strict';

const { registerTool } = require('./registry');
const { buildContainsRegex, buildSearchOrConditions } = require('../../../../utils/searchRelevance');

async function executeSearchTickets({
  organizationId,
  query = '',
  limit = 8,
  filters = {},
} = {}) {
  const q = String(query || '').trim();
  const Case = require('../../../../models/Case');
  const fetchLimit = Math.max(Number(limit) || 8, 8) * 3;
  const mongoQuery = {
    organizationId,
  };

  if (q) {
    mongoQuery.$or = buildSearchOrConditions(q, ['subject', 'description', 'caseNumber']);
  }

  const status = String(filters.status || '').toLowerCase();
  if (status === 'open') {
    mongoQuery.status = { $nin: ['closed', 'resolved', 'cancelled', 'canceled'] };
  } else if (status === 'closed') {
    mongoQuery.status = { $in: ['closed', 'resolved', 'cancelled', 'canceled'] };
  }

  let rows = [];
  try {
    rows = await Case.find(mongoQuery)
      .select('subject status priority caseNumber createdAt updatedAt')
      .sort({ updatedAt: -1 })
      .limit(fetchLimit)
      .lean();
  } catch (err) {
    return {
      records: [],
      citations: [],
      query: q,
      error: String(err?.message || err),
    };
  }

  // If query looks like an account name, also match loosely via subject contains
  if (q && rows.length === 0) {
    try {
      const re = buildContainsRegex(q);
      rows = await Case.find({
        organizationId,
        $or: [
          { subject: re },
          { description: re },
        ],
      })
        .select('subject status priority caseNumber createdAt updatedAt')
        .sort({ updatedAt: -1 })
        .limit(Number(limit) || 8)
        .lean();
    } catch {
      rows = [];
    }
  }

  const records = (rows || []).slice(0, Number(limit) || 8).map((row) => ({
    id: String(row._id),
    type: 'cases',
    title: row.subject || row.caseNumber || String(row._id),
    subtitle: `${row.status || ''} • ${row.priority || ''}`.trim(),
    status: row.status,
    priority: row.priority,
    caseNumber: row.caseNumber,
    updatedAt: row.updatedAt,
  }));

  const citations = records.map((r) => ({
    sourceType: 'cases',
    sourceId: r.id,
    excerpt: String(r.title || '').slice(0, 120),
    score: 1,
  }));

  return { records, citations, query: q, filters };
}

registerTool({
  name: 'SearchTickets',
  description: 'Search support cases/tickets for the tenant (permission-scoped by org).',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      limit: { type: 'number' },
      filters: { type: 'object' },
    },
  },
  execute: executeSearchTickets,
});

module.exports = { executeSearchTickets };
