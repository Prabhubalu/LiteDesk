'use strict';

const searchService = require('../../../searchService');
const { registerTool } = require('./registry');
const { buildContainsRegex } = require('../../../../utils/searchRelevance');

function toCitations(rows) {
  return (rows || []).map((row) => ({
    sourceType: 'deals',
    sourceId: String(row.id || row._id || ''),
    excerpt: String(row.title || row.name || '').slice(0, 120),
    score: 1,
  })).filter((c) => c.sourceId);
}

function applyDealFilters(records, filters = {}) {
  let out = Array.isArray(records) ? [...records] : [];
  const status = String(filters.status || '').toLowerCase();
  if (status === 'open') {
    out = out.filter((d) => {
      const stage = String(d.subtitle || d.stage || d.status || '').toLowerCase();
      return !/\b(closed|won|lost)\b/.test(stage) && String(d.status || '').toLowerCase() !== 'closed';
    });
  } else if (status === 'closed') {
    out = out.filter((d) => {
      const stage = String(d.subtitle || d.stage || d.status || '').toLowerCase();
      return /\b(closed|won|lost)\b/.test(stage) || String(d.status || '').toLowerCase() === 'closed';
    });
  }
  return out;
}

function mapDealRow(deal) {
  return {
    id: String(deal._id || deal.id),
    type: 'deals',
    title: deal.name,
    subtitle: `${deal.stage || deal.status || ''} • ${deal.currency || '$'}${deal.amount ?? deal.value ?? 0}`,
    stage: deal.stage,
    status: deal.status,
    value: deal.amount ?? deal.value,
    accountId: deal.accountId ? String(deal.accountId) : null,
  };
}

/**
 * Resolve CRM account ids matching a name query (tenant-scoped via searchService).
 */
async function resolveAccountIds(organizationId, query) {
  const q = String(query || '').trim();
  if (!q) return [];
  try {
    const pack = await searchService.searchAll(organizationId, q, { limitPerModule: 5 });
    const orgs = Array.isArray(pack?.results?.organizations) ? pack.results.organizations : [];
    return orgs.map((o) => String(o.id || o._id)).filter(Boolean);
  } catch {
    return [];
  }
}

async function findDealsByAccountIds(organizationId, accountIds, limit = 10) {
  if (!accountIds.length) return [];
  const Deal = require('../../../../models/Deal');
  const ids = accountIds.slice(0, 8);
  const rows = await Deal.find({
    organizationId,
    deletedAt: null,
    $or: [
      { accountId: { $in: ids } },
      { 'dealOrganizations.organizationId': { $in: ids } },
    ],
  })
    .select('name stage status amount value currency accountId')
    .sort({ updatedAt: -1 })
    .limit(Math.max(1, Math.min(Number(limit) || 10, 25)))
    .lean();
  return (rows || []).map(mapDealRow);
}

async function executeSearchDeals({
  organizationId,
  query = '',
  limit = 8,
  filters = {},
  accountId = null,
} = {}) {
  const q = String(query || '').trim();
  const lim = Math.max(1, Math.min(Number(limit) || 8, 25));
  let records = [];

  // 1) Explicit account id
  if (accountId) {
    records = await findDealsByAccountIds(organizationId, [String(accountId)], lim);
  }

  // 2) Resolve account name → deals on that account (fixes "Show Vtiger CRM deals")
  if (!records.length && q) {
    const accountIds = await resolveAccountIds(organizationId, q);
    if (accountIds.length) {
      records = await findDealsByAccountIds(organizationId, accountIds, lim);
    }
  }

  // 3) Keyword search on deal fields
  if (!records.length && q) {
    const pack = await searchService.searchAll(organizationId, q, {
      limitPerModule: lim,
    });
    records = Array.isArray(pack?.results?.deals) ? pack.results.deals : [];
  }

  // 4) Regex fallback on deal name when still empty
  if (!records.length && q && q.length >= 2) {
    try {
      const Deal = require('../../../../models/Deal');
      const re = buildContainsRegex(q);
      const rows = await Deal.find({
        organizationId,
        deletedAt: null,
        $or: [{ name: re }, { description: re }, { stage: re }],
      })
        .select('name stage status amount value currency accountId')
        .limit(lim)
        .lean();
      records = (rows || []).map(mapDealRow);
    } catch {
      /* ignore */
    }
  }

  records = applyDealFilters(records, filters);
  return {
    records,
    citations: toCitations(records),
    query: q,
    filters,
    resolvedViaAccount: Boolean(accountId) || undefined,
  };
}

registerTool({
  name: 'SearchDeals',
  description: 'Search CRM deals by keyword or related account name; optional status filter.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      limit: { type: 'number' },
      filters: { type: 'object' },
      accountId: { type: 'string' },
    },
    required: ['query'],
  },
  execute: executeSearchDeals,
});

module.exports = {
  executeSearchDeals,
  applyDealFilters,
  resolveAccountIds,
  findDealsByAccountIds,
};
