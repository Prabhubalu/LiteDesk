'use strict';

const fs = require('fs');
const path = require('path');
const { registerTool } = require('./registry');
const { tokenize, scoreHaystack } = require('./productSearchUtils');

/** Curated purpose labels for common prefixes (grounded product map). */
const PURPOSE_BY_PREFIX = Object.freeze({
  '/api/ai': 'Astra / knowledge / work-graph / tenant agents / process designer AI',
  '/api/modules': 'Module definitions, fields, and module records',
  '/api/roles': 'Roles and permission matrices',
  '/api/profiles': 'Permission profiles',
  '/api/sharing': 'Module sharing defaults and rules',
  '/api/admin/processes': 'Process Designer graphs (admin)',
  '/api/admin/automation-rules': 'Legacy automation rules (admin)',
  '/api/admin/business-flows': 'Business flow groupings',
  '/api/admin/approvals': 'Approval decisions (admin)',
  '/api/approvals': 'User approval inbox',
  '/api/automation': 'Automation context (read-only)',
  '/api/settings': 'Org settings including SLA and assignment rules',
  '/api/helpdesk/cases': 'Support cases / tickets',
  '/api/deals': 'Deals / opportunities',
  '/api/people': 'People / contacts',
  '/api/organizations': 'CRM organizations / accounts',
  '/api/quotes': 'Quotes',
  '/api/sales-orders': 'Sales orders',
  '/api/invoices': 'Invoices',
  '/api/analytics': 'Analytics meta',
  '/api/analytics/reports': 'Analytics reports',
  '/api/analytics/dashboards': 'Analytics dashboards',
  '/api/analytics/widgets': 'Analytics widgets',
  '/api/documents': 'Documents / knowledge',
  '/api/mailboxes': 'Mailroom / inbox sync',
  '/api/hooks/process': 'Process webhooks',
  '/api/auth': 'Authentication',
  '/api/users': 'Users',
  '/api/search': 'Global search',
  '/api/ui': 'UI composition (apps/modules registry)',
});

function parseServerMounts() {
  const serverPath = path.join(__dirname, '../../../../server.js');
  let text = '';
  try {
    text = fs.readFileSync(serverPath, 'utf8');
  } catch {
    return [];
  }
  const mounts = [];
  const re = /app\.use\(\s*['"](\/api\/[^'"]+)['"]/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const prefix = m[1].replace(/\/$/, '');
    mounts.push({
      path: prefix,
      purpose: PURPOSE_BY_PREFIX[prefix]
        || PURPOSE_BY_PREFIX[Object.keys(PURPOSE_BY_PREFIX).find((k) => prefix.startsWith(k)) || '']
        || 'Mounted Express API prefix (see server.js)',
    });
  }
  // Dedupe
  const seen = new Set();
  return mounts.filter((row) => {
    if (seen.has(row.path)) return false;
    seen.add(row.path);
    return true;
  });
}

async function executeSearchApiMap({
  query = '',
  limit = 40,
} = {}) {
  const needles = tokenize(query);
  const lim = Math.max(1, Math.min(Number(limit) || 40, 80));
  let mounts = parseServerMounts();

  // Always merge curated purposes for known keys even if parse missed
  for (const [prefix, purpose] of Object.entries(PURPOSE_BY_PREFIX)) {
    if (!mounts.some((m) => m.path === prefix)) {
      mounts.push({ path: prefix, purpose });
    }
  }

  if (needles.length || /\b(api|endpoint|route|rest)\b/i.test(query)) {
    mounts = mounts
      .map((m) => ({
        ...m,
        _score: scoreHaystack(`${m.path} ${m.purpose}`, needles)
          + (/\b(api|endpoint|route)\b/i.test(query) ? 1 : 0),
      }))
      .filter((m) => !needles.length || m._score > 0)
      .sort((a, b) => b._score - a._score)
      .map(({ _score, ...rest }) => rest);
  }

  const records = mounts.slice(0, lim).map((m) => ({
    id: m.path,
    type: 'api_prefix',
    title: m.path,
    subtitle: m.purpose,
  }));

  const catalogText = [
    'API MAP (from server.js mounts + curated purposes)',
    ...records.map((r) => `- ${r.title} — ${r.subtitle}`),
  ].join('\n');

  return {
    records,
    catalogText,
    citations: records.slice(0, 12).map((r) => ({
      sourceType: 'api_prefix',
      sourceId: r.id,
      excerpt: `${r.title} — ${r.subtitle}`.slice(0, 160),
      score: 1,
    })),
    query,
  };
}

registerTool({
  name: 'SearchApiMap',
  description: 'List grounded /api Express mount prefixes from server.js with purposes.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      limit: { type: 'number' },
    },
  },
  execute: executeSearchApiMap,
});

module.exports = {
  executeSearchApiMap,
  parseServerMounts,
  PURPOSE_BY_PREFIX,
};
