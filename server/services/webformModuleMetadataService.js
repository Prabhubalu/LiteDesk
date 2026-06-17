'use strict';

const ModuleDefinition = require('../models/ModuleDefinition');
const Organization = require('../models/Organization');
const TenantModuleConfiguration = require('../models/TenantModuleConfiguration');
const { getEnabledAppsForTenant, getEnabledModulesForApp } = require('../utils/tenantMetadata');

const PLATFORM_MODULE_ORDER = [
  'tasks',
  'events',
  'items',
  'quotes',
  'sales_orders',
  'invoices',
  'payments'
];

const PLATFORM_ONLY_MODULE_KEYS = new Set(PLATFORM_MODULE_ORDER);

const MODULE_APP_KEY_BY_KEY = Object.freeze({
  people: 'SALES',
  organizations: 'SALES',
  deals: 'SALES',
  quotes: 'PLATFORM',
  sales_orders: 'PLATFORM',
  invoices: 'PLATFORM',
  payments: 'PLATFORM',
  tasks: 'PLATFORM',
  events: 'PLATFORM',
  items: 'PLATFORM',
  cases: 'HELPDESK',
  projects: 'PROJECTS',
  audits: 'AUDIT',
  findings: 'AUDIT'
});

const APP_DEFAULT_MODULES = Object.freeze({
  SALES: ['people', 'organizations', 'deals'],
  HELPDESK: ['cases'],
  PROJECTS: ['projects'],
  AUDIT: ['audits'],
  PORTAL: [],
  LMS: [],
  INVENTORY: []
});

const EXCLUDED_MODULE_KEYS = new Set([
  'users',
  'imports',
  'reports',
  'forms',
  'webforms',
  'settings'
]);

function resolveModuleAppKey(moduleKey, fallbackAppKey = null) {
  const key = String(moduleKey || '').toLowerCase();
  if (MODULE_APP_KEY_BY_KEY[key]) return MODULE_APP_KEY_BY_KEY[key];
  if (fallbackAppKey) return String(fallbackAppKey).toUpperCase();
  return null;
}

function moduleScope(moduleKey, appKey) {
  const resolvedAppKey = resolveModuleAppKey(moduleKey, appKey);
  return resolvedAppKey === 'PLATFORM' ? 'platform' : 'app';
}

function moduleEntryKey(moduleKey, appKey) {
  return `${String(appKey || '').toUpperCase()}:${String(moduleKey || '').toLowerCase()}`;
}

function isActiveEnabledAppEntry(entry) {
  if (!entry) return false;
  if (typeof entry === 'string') return entry.trim().length > 0;
  if (typeof entry !== 'object') return false;
  if (!entry.appKey) return false;
  return entry.status === undefined || entry.status === 'ACTIVE';
}

async function getTenantEnabledAppKeys(organizationId) {
  const keys = new Set();

  for (const app of await getEnabledAppsForTenant(organizationId)) {
    if (app?.appKey) keys.add(String(app.appKey).toUpperCase());
  }

  const org = await Organization.findById(organizationId).select('enabledApps').lean();
  const raw = Array.isArray(org?.enabledApps) ? org.enabledApps : [];
  for (const entry of raw) {
    if (!isActiveEnabledAppEntry(entry)) continue;
    const appKey = typeof entry === 'string' ? entry : entry.appKey;
    keys.add(String(appKey).toUpperCase());
  }

  const tenantModules = await TenantModuleConfiguration.find({
    organizationId,
    enabled: true
  })
    .select('appKey')
    .lean()
    .catch(() => []);

  for (const mod of tenantModules) {
    if (mod?.appKey) keys.add(String(mod.appKey).toUpperCase());
  }

  return [...keys];
}

async function loadModuleLabelMap() {
  const defs = await ModuleDefinition.find({
    $or: [
      { appKey: 'platform' },
      { organizationId: null },
      { organizationId: { $exists: false } }
    ]
  })
    .select('moduleKey key label pluralLabel appKey')
    .lean();

  const labels = new Map();
  for (const def of defs) {
    const moduleKey = String(def?.moduleKey || def?.key || '').toLowerCase();
    if (!moduleKey) continue;
    const label = def.pluralLabel || def.label || moduleKey;
    if (!labels.has(moduleKey)) {
      labels.set(moduleKey, label);
    }
  }
  return labels;
}

function resolveModuleLabel(labelByKey, moduleKey, fallback = null) {
  const key = String(moduleKey || '').toLowerCase();
  return fallback || labelByKey.get(key) || key;
}

/**
 * Tenant-scoped webform target modules: platform core modules + enabled app modules.
 */
async function listTenantWebformModules(organizationId) {
  const modules = [];
  const seen = new Set();
  const enabledAppKeys = await getTenantEnabledAppKeys(organizationId);
  const labelByKey = await loadModuleLabelMap();

  const platformDefs = await ModuleDefinition.find({
    appKey: 'platform',
    moduleKey: { $nin: [...EXCLUDED_MODULE_KEYS] }
  })
    .select('moduleKey label pluralLabel enabled')
    .lean();

  const platformByKey = new Map();
  for (const def of platformDefs) {
    const moduleKey = String(def?.moduleKey || '').toLowerCase();
    if (!moduleKey || EXCLUDED_MODULE_KEYS.has(moduleKey)) continue;
    if (def.enabled === false) continue;
    platformByKey.set(moduleKey, def);
  }

  const addModule = ({ moduleKey, appKey, label, scope = null }) => {
    const normalizedKey = String(moduleKey || '').toLowerCase();
    const normalizedAppKey = resolveModuleAppKey(normalizedKey, appKey);
    if (!normalizedKey || !normalizedAppKey) return;
    const resolvedScope = scope || moduleScope(normalizedKey, normalizedAppKey);
    const entryKey = moduleEntryKey(normalizedKey, normalizedAppKey);
    if (seen.has(entryKey)) return;
    seen.add(entryKey);
    modules.push({
      moduleKey: normalizedKey,
      appKey: normalizedAppKey,
      label: String(label || normalizedKey).trim() || normalizedKey,
      scope: resolvedScope
    });
  };

  for (const moduleKey of PLATFORM_MODULE_ORDER) {
    const def = platformByKey.get(moduleKey);
    if (!def || !PLATFORM_ONLY_MODULE_KEYS.has(moduleKey)) continue;
    addModule({
      moduleKey,
      appKey: 'PLATFORM',
      label: def.pluralLabel || def.label || moduleKey,
      scope: 'platform'
    });
  }

  for (const def of platformByKey.values()) {
    const moduleKey = String(def.moduleKey || '').toLowerCase();
    if (!PLATFORM_ONLY_MODULE_KEYS.has(moduleKey)) continue;
    if (PLATFORM_MODULE_ORDER.includes(moduleKey)) continue;
    addModule({
      moduleKey,
      appKey: 'PLATFORM',
      label: def.pluralLabel || def.label || moduleKey,
      scope: 'platform'
    });
  }

  const tenantModules = await TenantModuleConfiguration.find({
    organizationId,
    enabled: true
  })
    .select('moduleKey appKey labelOverride')
    .lean()
    .catch(() => []);

  for (const mod of tenantModules) {
    const moduleKey = String(mod?.moduleKey || '').toLowerCase();
    const appKey = String(mod?.appKey || '').toUpperCase();
    if (!moduleKey || EXCLUDED_MODULE_KEYS.has(moduleKey)) continue;
    if (!appKey) continue;
    if (PLATFORM_ONLY_MODULE_KEYS.has(moduleKey)) continue;
    addModule({
      moduleKey,
      appKey,
      label: resolveModuleLabel(labelByKey, moduleKey, mod.labelOverride),
      scope: 'app'
    });
  }

  for (const appKey of enabledAppKeys) {
    const configured = await getEnabledModulesForApp(organizationId, appKey);
    for (const mod of configured) {
      const moduleKey = String(mod?.moduleKey || '').toLowerCase();
      if (!moduleKey || EXCLUDED_MODULE_KEYS.has(moduleKey)) continue;
      if (PLATFORM_ONLY_MODULE_KEYS.has(moduleKey)) continue;
      addModule({
        moduleKey,
        appKey: mod?.appKey || appKey,
        label: resolveModuleLabel(
          labelByKey,
          moduleKey,
          mod.labelOverride || mod.pluralLabel || mod.label
        ),
        scope: 'app'
      });
    }

    const defaults = APP_DEFAULT_MODULES[appKey] || [];
    for (const moduleKey of defaults) {
      addModule({
        moduleKey,
        appKey,
        label: resolveModuleLabel(labelByKey, moduleKey),
        scope: 'app'
      });
    }
  }

  return modules.sort((a, b) => {
    if (a.scope !== b.scope) return a.scope === 'platform' ? -1 : 1;
    if (a.appKey !== b.appKey) return String(a.appKey).localeCompare(String(b.appKey));
    return String(a.label).localeCompare(String(b.label));
  });
}

async function resolveWebformTargetModule(organizationId, moduleKey, appKey = null) {
  const modules = await listTenantWebformModules(organizationId);
  const normalizedModuleKey = String(moduleKey || '').toLowerCase();
  const normalizedAppKey = appKey ? String(appKey).toUpperCase() : null;

  if (normalizedAppKey) {
    return (
      modules.find(
        (row) => row.moduleKey === normalizedModuleKey && row.appKey === normalizedAppKey
      ) || null
    );
  }

  return modules.find((row) => row.moduleKey === normalizedModuleKey) || null;
}

module.exports = {
  listTenantWebformModules,
  resolveWebformTargetModule,
  resolveModuleAppKey,
  moduleScope,
  getTenantEnabledAppKeys,
  APP_DEFAULT_MODULES
};
