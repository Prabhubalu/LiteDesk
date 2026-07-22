'use strict';

const { registerTool } = require('./registry');
const { tokenize, matchQuery, toCitations, scoreHaystack } = require('./productSearchUtils');

async function executeSearchBusinessRules({
  organizationId,
  query = '',
  limit = 12,
  filters = {},
} = {}) {
  const SlaPolicy = require('../../../../models/SlaPolicy');
  const AssignmentRuleSet = require('../../../../models/AssignmentRuleSet');
  const needles = tokenize(query);
  const lim = Math.max(1, Math.min(Number(limit) || 12, 25));

  const slaQuery = {
    organizationId,
    deletedAt: null,
  };
  if (filters.active !== undefined) slaQuery.active = Boolean(filters.active);
  if (filters.moduleKey) slaQuery['scope.moduleKey'] = String(filters.moduleKey).toLowerCase();

  let slaPolicies = [];
  try {
    slaPolicies = await SlaPolicy.find(slaQuery)
      .select('policyKey name active precedence scope trigger targets escalations updatedAt')
      .sort({ precedence: 1, updatedAt: -1 })
      .limit(60)
      .lean();
  } catch (err) {
    // Model may not exist in all envs
    slaPolicies = [];
  }

  let assignmentSets = [];
  try {
    assignmentSets = await AssignmentRuleSet.find({ organizationId })
      .select('appKey moduleKey enabled version applyStrategy rules updatedAt')
      .limit(40)
      .lean();
  } catch {
    assignmentSets = [];
  }

  const slaRecords = (slaPolicies || []).map((p) => ({
    id: String(p._id),
    type: 'sla_policy',
    title: p.name || p.policyKey || String(p._id),
    subtitle: `${p.active ? 'active' : 'inactive'} • ${p.scope?.appKey || ''}.${p.scope?.moduleKey || ''} • targets=${Array.isArray(p.targets) ? p.targets.length : 0} • escalations=${Array.isArray(p.escalations) ? p.escalations.length : 0}`,
    policyKey: p.policyKey,
    active: Boolean(p.active),
    scope: p.scope || null,
    triggerType: p.trigger?.type || p.trigger?.eventType || null,
  })).filter((row) => matchQuery(row, needles, ['title', 'subtitle', 'policyKey']));

  const assignmentRecords = (assignmentSets || []).map((s) => ({
    id: String(s._id),
    type: 'assignment_rule_set',
    title: `${s.appKey}.${s.moduleKey}`,
    subtitle: `${s.enabled ? 'enabled' : 'disabled'} • strategy=${s.applyStrategy || 'n/a'} • rules=${Array.isArray(s.rules) ? s.rules.length : 0} • v${s.version ?? '?'}`,
    appKey: s.appKey,
    moduleKey: s.moduleKey,
    enabled: Boolean(s.enabled),
    ruleCount: Array.isArray(s.rules) ? s.rules.length : 0,
  })).filter((row) => matchQuery(row, needles, ['title', 'subtitle', 'appKey', 'moduleKey']));

  let records = [...slaRecords, ...assignmentRecords];
  if (needles.length) {
    records = records
      .map((r) => ({ r, s: scoreHaystack(`${r.title} ${r.subtitle}`, needles) }))
      .sort((a, b) => b.s - a.s)
      .map(({ r }) => r);
  }
  records = records.slice(0, lim);

  return {
    records,
    citations: toCitations(records, 'business_rule'),
    query,
    filters,
  };
}

registerTool({
  name: 'SearchBusinessRules',
  description: 'Search SLA policies and assignment rule sets (org business rules).',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      limit: { type: 'number' },
      filters: { type: 'object' },
    },
  },
  execute: executeSearchBusinessRules,
});

module.exports = { executeSearchBusinessRules };
