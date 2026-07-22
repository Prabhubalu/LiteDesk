'use strict';

const { registerTool } = require('./registry');
const { tokenize, matchQuery, toCitations, orgScope, scoreHaystack } = require('./productSearchUtils');

async function executeSearchAutomations({
  organizationId,
  query = '',
  limit = 12,
  filters = {},
} = {}) {
  const AutomationRule = require('../../../../models/AutomationRule');
  const BusinessFlow = require('../../../../models/BusinessFlow');
  const needles = tokenize(query);
  const lim = Math.max(1, Math.min(Number(limit) || 12, 25));

  const ruleQuery = {
    ...orgScope(organizationId),
  };
  if (filters.appKey) ruleQuery.appKey = String(filters.appKey).toUpperCase();
  if (filters.enabled !== undefined) ruleQuery.enabled = Boolean(filters.enabled);

  let rules = [];
  try {
    rules = await AutomationRule.find(ruleQuery)
      .select('name appKey entityType enabled trigger action order updatedAt')
      .sort({ order: 1, updatedAt: -1 })
      .limit(80)
      .lean();
  } catch (err) {
    return { records: [], citations: [], query, error: String(err?.message || err) };
  }

  let flows = [];
  try {
    flows = await BusinessFlow.find({ organizationId })
      .select('name appKey processIds updatedAt')
      .limit(40)
      .lean();
  } catch {
    flows = [];
  }

  const ruleRecords = (rules || [])
    .map((r) => ({
      id: String(r._id),
      type: 'automation_rule',
      title: r.name || String(r._id),
      subtitle: `${r.enabled ? 'enabled' : 'disabled'} • ${r.appKey || ''} • ${r.entityType || ''} • trigger=${r.trigger?.eventType || r.trigger?.type || 'n/a'} • action=${r.action?.type || 'n/a'}`,
      enabled: Boolean(r.enabled),
      appKey: r.appKey,
      entityType: r.entityType,
      trigger: r.trigger || null,
      actionType: r.action?.type || null,
    }))
    .filter((row) => matchQuery(row, needles, ['title', 'subtitle', 'appKey', 'entityType', 'actionType']));

  const flowRecords = (flows || [])
    .map((f) => ({
      id: String(f._id),
      type: 'business_flow',
      title: f.name || String(f._id),
      subtitle: `${f.appKey || ''} • ${Array.isArray(f.processIds) ? f.processIds.length : 0} process(es)`,
      appKey: f.appKey,
      processCount: Array.isArray(f.processIds) ? f.processIds.length : 0,
    }))
    .filter((row) => matchQuery(row, needles, ['title', 'subtitle', 'appKey']));

  let records = [...ruleRecords, ...flowRecords];
  if (needles.length) {
    records = records
      .map((r) => ({ r, s: scoreHaystack(`${r.title} ${r.subtitle}`, needles) }))
      .sort((a, b) => b.s - a.s)
      .map(({ r }) => r);
  }
  records = records.slice(0, lim);

  return {
    records,
    citations: toCitations(records, 'automation'),
    query,
    filters,
  };
}

registerTool({
  name: 'SearchAutomations',
  description: 'Search tenant automation rules and business flows.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      limit: { type: 'number' },
      filters: { type: 'object' },
    },
  },
  execute: executeSearchAutomations,
});

module.exports = { executeSearchAutomations };
