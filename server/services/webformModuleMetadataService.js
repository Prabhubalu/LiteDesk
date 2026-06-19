'use strict';

const ModuleDefinition = require('../models/ModuleDefinition');
const Organization = require('../models/Organization');
const TenantModuleConfiguration = require('../models/TenantModuleConfiguration');
const { getEnabledAppsForTenant, getEnabledModulesForApp } = require('../utils/tenantMetadata');
const { getMergedModuleFieldsForWebform } = require('./webformModuleFieldsService');

/** Canonical platform core modules (matches Settings → Core modules). */
const PLATFORM_MODULE_ORDER = [
  'people',
  'organizations',
  'tasks',
  'events',
  'items',
  'quotes',
  'sales_orders',
  'invoices',
  'payments'
];

const PLATFORM_MODULE_KEYS = new Set(PLATFORM_MODULE_ORDER);

/**
 * Runtime app key for webform target metadata.
 * Platform-owned entities use PLATFORM; app-native modules use their app.
 */
const MODULE_APP_KEY_BY_KEY = Object.freeze({
  people: 'PLATFORM',
  organizations: 'PLATFORM',
  tasks: 'PLATFORM',
  events: 'PLATFORM',
  items: 'PLATFORM',
  quotes: 'PLATFORM',
  sales_orders: 'PLATFORM',
  invoices: 'PLATFORM',
  payments: 'PLATFORM',
  deals: 'SALES',
  cases: 'HELPDESK',
  projects: 'PROJECTS',
  audits: 'AUDIT',
  findings: 'AUDIT'
});

const APP_DEFAULT_MODULES = Object.freeze({
  SALES: ['deals'],
  HELPDESK: ['cases'],
  PROJECTS: ['projects'],
  AUDIT: ['audits', 'findings'],
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
  'settings',
  'groups'
]);

const VALID_WEBFORM_APP_KEYS = new Set([
  'SALES',
  'HELPDESK',
  'PROJECTS',
  'PORTAL',
  'AUDIT',
  'LMS',
  'INVENTORY'
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

  return [...keys].filter((appKey) => VALID_WEBFORM_APP_KEYS.has(appKey));
}

async function loadModuleLabelMap(organizationId) {
  const orgId = organizationId || null;
  const defs = await ModuleDefinition.find({
    $or: [
      { appKey: 'platform' },
      { organizationId: null },
      { organizationId: { $exists: false } },
      ...(orgId ? [{ organizationId: orgId }] : [])
    ]
  })
    .select('moduleKey key label pluralLabel appKey name')
    .lean();

  const labels = new Map();
  for (const def of defs) {
    const moduleKey = String(def?.moduleKey || def?.key || '').toLowerCase();
    if (!moduleKey) continue;
    const label = def.pluralLabel || def.label || def.name || moduleKey;
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

function isPlatformModuleKey(moduleKey) {
  return PLATFORM_MODULE_KEYS.has(String(moduleKey || '').toLowerCase());
}

/**
 * Tenant-scoped webform target modules: platform core modules + enabled app modules.
 */
async function listTenantWebformModules(organizationId) {
  const modules = [];
  const seen = new Set();
  const enabledAppKeys = await getTenantEnabledAppKeys(organizationId);
  const labelByKey = await loadModuleLabelMap(organizationId);

  const platformDefs = await ModuleDefinition.find({
    appKey: 'platform',
    moduleKey: { $nin: [...EXCLUDED_MODULE_KEYS] }
  })
    .select('moduleKey label pluralLabel name enabled')
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
    if (!normalizedKey || EXCLUDED_MODULE_KEYS.has(normalizedKey)) return;

    const normalizedAppKey = resolveModuleAppKey(normalizedKey, appKey);
    if (!normalizedAppKey) return;

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

  // Platform section — all core platform modules in canonical order
  for (const moduleKey of PLATFORM_MODULE_ORDER) {
    const def = platformByKey.get(moduleKey);
    addModule({
      moduleKey,
      appKey: 'PLATFORM',
      label: def
        ? (def.pluralLabel || def.label || def.name || moduleKey)
        : resolveModuleLabel(labelByKey, moduleKey),
      scope: 'platform'
    });
  }

  // Any additional platform modules not in the ordered list
  for (const def of platformByKey.values()) {
    const moduleKey = String(def.moduleKey || '').toLowerCase();
    if (!moduleKey || PLATFORM_MODULE_ORDER.includes(moduleKey)) continue;
    addModule({
      moduleKey,
      appKey: 'PLATFORM',
      label: def.pluralLabel || def.label || def.name || moduleKey,
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
    if (!appKey || appKey === 'PLATFORM') continue;
    if (isPlatformModuleKey(moduleKey)) continue;
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
      if (isPlatformModuleKey(moduleKey)) continue;
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
      if (isPlatformModuleKey(moduleKey)) continue;
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

    if (a.scope === 'platform' && b.scope === 'platform') {
      const orderA = PLATFORM_MODULE_ORDER.indexOf(a.moduleKey);
      const orderB = PLATFORM_MODULE_ORDER.indexOf(b.moduleKey);
      const effectiveA = orderA === -1 ? 999 : orderA;
      const effectiveB = orderB === -1 ? 999 : orderB;
      if (effectiveA !== effectiveB) return effectiveA - effectiveB;
      return String(a.label).localeCompare(String(b.label));
    }

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

  if (isPlatformModuleKey(normalizedModuleKey)) {
    return modules.find(
      (row) => row.moduleKey === normalizedModuleKey && row.appKey === 'PLATFORM'
    ) || null;
  }

  return modules.find((row) => row.moduleKey === normalizedModuleKey) || null;
}

function collectDependencyControllerKeys(moduleFields, seedKeys) {
  const keys = new Set(seedKeys);
  const byKey = new Map();
  for (const field of Array.isArray(moduleFields) ? moduleFields : []) {
    const key = String(field?.key || '').trim().toLowerCase();
    if (key) byKey.set(key, field);
  }

  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const key of [...keys]) {
      const field = byKey.get(key);
      if (!field) continue;
      const deps = Array.isArray(field.dependencies) ? field.dependencies : [];
      for (const dep of deps) {
        const conditions = Array.isArray(dep?.conditions) ? dep.conditions : [];
        const candidates = conditions.length
          ? conditions.map((row) => row?.fieldKey || row?.field || row?.sourceFieldKey)
          : [dep?.fieldKey || dep?.field || dep?.sourceFieldKey];
        for (const raw of candidates) {
          const controllerKey = String(raw || '').trim().toLowerCase();
          if (!controllerKey || keys.has(controllerKey)) continue;
          keys.add(controllerKey);
          expanded = true;
        }
      }
    }
  }

  return keys;
}

/**
 * Strip module fields to what the public webform client needs for dependency evaluation.
 */
function serializeModuleFieldsForWebformClient(moduleFields, webformFields) {
  const usedKeys = new Set(
    (Array.isArray(webformFields) ? webformFields : [])
      .map((field) => String(field?.crmFieldKey || '').trim().toLowerCase())
      .filter(Boolean)
  );

  const rows = Array.isArray(moduleFields) ? moduleFields : [];
  const allKeys = collectDependencyControllerKeys(rows, usedKeys);
  const filtered = allKeys.size
    ? rows.filter((field) => allKeys.has(String(field?.key || '').trim().toLowerCase()))
    : rows;

  return filtered.map((field) => ({
    key: field.key,
    label: field.label,
    dataType: field.dataType || field.type,
    type: field.dataType || field.type,
    required: field.required === true,
    readonly: field.readonly === true,
    dependencies: Array.isArray(field.dependencies) ? field.dependencies : [],
    options: field.options,
    lookupSettings: field.lookupSettings || null
  }));
}

async function getModuleFieldsForWebform(organizationId, moduleKey, appKey = null) {
  const resolvedAppKey = resolveModuleAppKey(moduleKey, appKey) || 'PLATFORM';
  return getMergedModuleFieldsForWebform(organizationId, moduleKey, resolvedAppKey);
}

module.exports = {
  listTenantWebformModules,
  resolveWebformTargetModule,
  resolveModuleAppKey,
  moduleScope,
  getTenantEnabledAppKeys,
  getModuleFieldsForWebform,
  serializeModuleFieldsForWebformClient,
  APP_DEFAULT_MODULES,
  PLATFORM_MODULE_ORDER,
  PLATFORM_MODULE_KEYS
};
