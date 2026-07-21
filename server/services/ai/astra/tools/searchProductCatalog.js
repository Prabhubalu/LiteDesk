'use strict';

const uiCompositionService = require('../../../uiCompositionService');
const { getMergedModuleFieldsForWebform } = require('../../../webformModuleFieldsService');
const { registerTool } = require('./registry');

/** Known HTTP API surfaces (grounded product map — not invented per-tenant). */
const API_SURFACE = Object.freeze([
  { path: '/api/ai/*', purpose: 'Astra / knowledge / work-graph / tenant agents' },
  { path: '/api/modules', purpose: 'Module definitions and field metadata' },
  { path: '/api/ui/*', purpose: 'UI composition: apps, modules, registry for the tenant' },
  { path: '/api/people', purpose: 'People / contacts CRUD' },
  { path: '/api/organizations', purpose: 'CRM organizations / accounts' },
  { path: '/api/deals', purpose: 'Deals / opportunities' },
  { path: '/api/tasks', purpose: 'Tasks' },
  { path: '/api/events', purpose: 'Events / meetings' },
  { path: '/api/cases', purpose: 'Support cases / tickets' },
  { path: '/api/quotes', purpose: 'Quotes (commercial)' },
  { path: '/api/analytics/*', purpose: 'Reports, widgets, dashboards' },
  { path: '/api/documents', purpose: 'Documents / knowledge articles' },
  { path: '/api/automations', purpose: 'Process / automation rules' },
  { path: '/api/mailboxes', purpose: 'Mailroom / inbox sync' },
]);

const MODULE_ALIASES = Object.freeze({
  deal: 'deals',
  deals: 'deals',
  opportunity: 'deals',
  opportunities: 'deals',
  people: 'people',
  person: 'people',
  contact: 'people',
  contacts: 'people',
  account: 'organizations',
  accounts: 'organizations',
  organization: 'organizations',
  organizations: 'organizations',
  company: 'organizations',
  task: 'tasks',
  tasks: 'tasks',
  event: 'events',
  events: 'events',
  meeting: 'events',
  meetings: 'events',
  case: 'cases',
  cases: 'cases',
  ticket: 'cases',
  tickets: 'cases',
  quote: 'quotes',
  quotes: 'quotes',
  item: 'items',
  items: 'items',
  product: 'items',
  products: 'items',
});

function detectModuleKeyFromQuery(query = '') {
  const q = String(query || '').toLowerCase();
  for (const [alias, key] of Object.entries(MODULE_ALIASES)) {
    if (new RegExp(`\\b${alias}\\b`, 'i').test(q)) return key;
  }
  return '';
}

/**
 * Related modules for how-to flows (e.g. convert deal → quote).
 */
function detectRelatedModuleKeys(query = '') {
  const q = String(query || '').toLowerCase();
  const keys = [];
  const push = (k) => {
    if (k && !keys.includes(k)) keys.push(k);
  };
  if (/\bconvert\b/.test(q) && /\bdeal/.test(q) && /\bquote/.test(q)) {
    push('deals');
    push('quotes');
  }
  const primary = detectModuleKeyFromQuery(q);
  if (primary) push(primary);
  if (/\bquote/.test(q)) push('quotes');
  if (/\bdeal|\bopportunit/.test(q)) push('deals');
  if (/\bcase|\bticket/.test(q)) push('cases');
  return keys.slice(0, 4);
}

function scoreText(haystack, needles) {
  const h = String(haystack || '').toLowerCase();
  let score = 0;
  for (const n of needles) {
    if (!n) continue;
    if (h.includes(n)) score += n.length >= 4 ? 2 : 1;
  }
  return score;
}

function compactField(field) {
  return {
    key: field.key || field.fieldKey,
    label: field.label || field.key,
    dataType: field.dataType || field.type || '',
    required: Boolean(field.required),
    options: Array.isArray(field.options)
      ? field.options.slice(0, 12).map((o) => (typeof o === 'string' ? o : o?.label || o?.value)).filter(Boolean)
      : undefined,
  };
}

/**
 * Live product catalog: apps, modules, fields the tenant can actually use.
 * Prefer this over LLM memory for product structure questions.
 */
async function executeSearchProductCatalog({
  organizationId,
  user = null,
  query = '',
  moduleKey = '',
  moduleKeys = null,
  preferRequired = false,
  includeApis = true,
  maxModules = 24,
  maxFields = 40,
} = {}) {
  const q = String(query || '').trim();
  const needles = q.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 2);
  const related = Array.isArray(moduleKeys)
    ? moduleKeys.map((k) => String(k || '').toLowerCase()).filter(Boolean).slice(0, 4)
    : detectRelatedModuleKeys(q);
  const wantedModule = String(moduleKey || related[0] || detectModuleKeyFromQuery(q) || '').toLowerCase();
  const wantRequired = preferRequired === true
    || /\brequired\s+fields?\b/i.test(q)
    || /\bwhich\s+fields\b/i.test(q)
    || /\bconvert\b.+\b(deal|quote)/i.test(q);

  let apps = [];
  try {
    apps = await uiCompositionService.getUIAppsForTenant(organizationId, user || { userType: 'INTERNAL' });
  } catch (err) {
    return {
      apps: [],
      modules: [],
      fields: [],
      apis: includeApis ? API_SURFACE : [],
      catalogText: '',
      citations: [],
      error: String(err?.message || err),
    };
  }

  const modules = [];
  for (const app of (apps || []).slice(0, 20)) {
    const appKey = app.appKey || app.key;
    let appModules = [];
    try {
      appModules = await uiCompositionService.getUIModulesForApp(organizationId, appKey);
    } catch {
      appModules = [];
    }
    for (const mod of appModules || []) {
      const mk = String(mod.moduleKey || mod.key || '').toLowerCase();
      const label = mod.name || mod.label || mk;
      const row = {
        appKey: String(appKey || '').toUpperCase(),
        appName: app.name || app.label || appKey,
        moduleKey: mk,
        label,
        route: mod.route || mod.path || '',
      };
      if (wantedModule && mk !== wantedModule && !related.includes(mk)) {
        // keep if query mentions app/module loosely
        const s = scoreText(`${row.appName} ${row.label} ${mk}`, needles);
        if (s === 0 && needles.length) continue;
      }
      modules.push(row);
    }
  }

  // Rank modules by query relevance
  let rankedModules = modules;
  if (needles.length) {
    rankedModules = modules
      .map((m) => ({
        ...m,
        _score: scoreText(`${m.appName} ${m.label} ${m.moduleKey} ${m.appKey}`, needles)
          + (wantedModule && m.moduleKey === wantedModule ? 10 : 0)
          + (related.includes(m.moduleKey) ? 8 : 0),
      }))
      .sort((a, b) => b._score - a._score)
      .slice(0, maxModules)
      .map(({ _score, ...rest }) => rest);
  } else {
    rankedModules = modules.slice(0, maxModules);
  }

  // Fields for requested / related modules (convert deal→quote needs both)
  const modulesForFields = related.length
    ? related
    : (wantedModule ? [wantedModule] : (rankedModules[0]?.moduleKey ? [rankedModules[0].moduleKey] : []));

  /** @type {Array<{ moduleKey: string, fields: object[], requiredFields: object[] }>} */
  const fieldsByModule = [];
  let fields = [];
  let fieldModuleKey = modulesForFields[0] || null;

  for (const mk of modulesForFields.slice(0, 3)) {
    const fieldAppKey = rankedModules.find((m) => m.moduleKey === mk)?.appKey || 'SALES';
    let modFields = [];
    try {
      const merged = await getMergedModuleFieldsForWebform(
        organizationId,
        mk,
        fieldAppKey,
      );
      modFields = (merged || []).map(compactField).filter((f) => f.key);
    } catch {
      modFields = [];
    }
    const requiredFields = modFields.filter((f) => f.required);
    let listed = modFields;
    if (wantRequired && requiredFields.length) {
      const reqKeys = new Set(requiredFields.map((f) => f.key));
      const rest = modFields.filter((f) => !reqKeys.has(f.key));
      if (needles.length) {
        const scored = rest
          .map((f) => ({ f, s: scoreText(`${f.key} ${f.label} ${f.dataType}`, needles) }))
          .sort((a, b) => b.s - a.s);
        listed = [
          ...requiredFields,
          ...scored.filter((x) => x.s > 0).map((x) => x.f),
        ].slice(0, maxFields);
      } else {
        listed = [...requiredFields, ...rest].slice(0, maxFields);
      }
    } else if (needles.length) {
      const scored = modFields
        .map((f) => ({
          f,
          s: scoreText(`${f.key} ${f.label} ${f.dataType}`, needles) + (f.required ? 3 : 0),
        }))
        .sort((a, b) => b.s - a.s);
      const relevant = scored.filter((x) => x.s > 0).map((x) => x.f);
      listed = (relevant.length ? relevant : modFields).slice(0, maxFields);
    } else {
      listed = modFields.slice(0, maxFields);
    }
    fieldsByModule.push({ moduleKey: mk, fields: listed, requiredFields });
    if (!fields.length) {
      fields = listed;
      fieldModuleKey = mk;
    }
  }

  const apis = includeApis
    ? API_SURFACE.filter((a) => {
      if (!needles.length) return true;
      return scoreText(`${a.path} ${a.purpose}`, needles) > 0
        || /\b(api|endpoint|route|rest)\b/i.test(q);
    })
    : [];

  const catalogLines = [
    'LIVE PRODUCT CATALOG (tenant-scoped — facts only)',
    `Apps (${(apps || []).length}): ${(apps || []).map((a) => a.name || a.appKey).join(', ')}`,
    '',
    'Modules:',
    ...rankedModules.slice(0, 20).map(
      (m) => `- [${m.appKey}] ${m.label} (moduleKey=${m.moduleKey})${m.route ? ` route=${m.route}` : ''}`,
    ),
  ];

  for (const block of fieldsByModule) {
    catalogLines.push('', `Fields for module "${block.moduleKey}":`);
    if (!block.fields.length) {
      catalogLines.push('(no fields resolved)');
      continue;
    }
    if (block.requiredFields.length) {
      catalogLines.push(`REQUIRED FIELDS (${block.moduleKey}):`);
      for (const f of block.requiredFields.slice(0, 24)) {
        catalogLines.push(
          `- ${f.key} (${f.label}) type=${f.dataType || '?'} required`,
        );
      }
    }
    catalogLines.push(`All listed fields (${block.moduleKey}):`);
    for (const f of block.fields.slice(0, maxFields)) {
      catalogLines.push(
        `- ${f.key} (${f.label}) type=${f.dataType || '?'}${f.required ? ' required' : ''}`,
      );
    }
  }

  if (apis.length) {
    catalogLines.push('', 'API surfaces (platform):');
    for (const a of apis.slice(0, 16)) {
      catalogLines.push(`- ${a.path} — ${a.purpose}`);
    }
  }

  const catalogText = catalogLines.join('\n');
  const allRequired = fieldsByModule.flatMap((b) => b.requiredFields.map((f) => ({
    ...f,
    moduleKey: b.moduleKey,
  })));
  const citations = [
    ...rankedModules.slice(0, 8).map((m) => ({
      sourceType: 'product_module',
      sourceId: `${m.appKey}:${m.moduleKey}`,
      excerpt: `${m.label} (${m.moduleKey}) in ${m.appName}`,
      score: 1,
    })),
    ...allRequired.slice(0, 10).map((f) => ({
      sourceType: 'product_field_required',
      sourceId: `${f.moduleKey}:${f.key}`,
      excerpt: `REQUIRED ${f.label} (${f.key}) on ${f.moduleKey}`,
      score: 1.2,
    })),
    ...fields.slice(0, 6).map((f) => ({
      sourceType: 'product_field',
      sourceId: `${fieldModuleKey}:${f.key}`,
      excerpt: `${f.label} (${f.key}) type=${f.dataType}`,
      score: 1,
    })),
  ];

  return {
    apps: (apps || []).map((a) => ({
      appKey: a.appKey,
      name: a.name || a.label || a.appKey,
    })),
    modules: rankedModules,
    fields,
    fieldsByModule,
    requiredFields: allRequired,
    fieldModuleKey: fieldModuleKey || null,
    apis,
    catalogText,
    citations,
    query: q,
  };
}


registerTool({
  name: 'SearchProductCatalog',
  description: 'Live tenant product catalog: enabled apps, modules, fields (incl. required), and known API surfaces.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      moduleKey: { type: 'string' },
      moduleKeys: { type: 'array', items: { type: 'string' } },
      preferRequired: { type: 'boolean' },
      includeApis: { type: 'boolean' },
    },
  },
  execute: executeSearchProductCatalog,
});

module.exports = {
  executeSearchProductCatalog,
  detectModuleKeyFromQuery,
  detectRelatedModuleKeys,
  API_SURFACE,
  MODULE_ALIASES,
};
