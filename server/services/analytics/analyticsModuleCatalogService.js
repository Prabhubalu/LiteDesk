const ModuleDefinition = require('../../models/ModuleDefinition');
const {
  getAnalyticsModuleConfig,
  isReportableAnalyticsModule,
  listAnalyticsModules,
} = require('./analyticsModuleRegistry');
const { listTenantWebformModules } = require('../webformModuleMetadataService');

const ANALYTICS_ONLY_MODULES = Object.freeze([
  {
    moduleKey: 'forms',
    appKey: 'PLATFORM',
    label: 'Form Responses',
    scope: 'platform',
  },
]);

const ANALYTICS_EXCLUDED_MODULE_KEYS = new Set([
  'imports',
  'webforms',
  'responses',
  'users',
  'settings',
  'groups',
  'reports',
  'dashboards',
  'analytics',
]);

function normalizeModuleKey(value) {
  return String(value || '').trim().toLowerCase();
}

function moduleEntryKey(moduleKey, appKey) {
  return `${String(appKey || '').toUpperCase()}:${normalizeModuleKey(moduleKey)}`;
}

async function loadModuleLabelMap(organizationId) {
  const orgId = organizationId || null;
  const defs = await ModuleDefinition.find({
    $or: [
      { appKey: 'platform' },
      { organizationId: null },
      { organizationId: { $exists: false } },
      ...(orgId ? [{ organizationId: orgId }] : []),
    ],
  })
    .select('moduleKey key label pluralLabel appKey name')
    .lean();

  const labels = new Map();
  for (const def of defs) {
    const moduleKey = normalizeModuleKey(def?.moduleKey || def?.key);
    if (!moduleKey) continue;
    const label = def.pluralLabel || def.label || def.name || moduleKey;
    if (!labels.has(moduleKey)) {
      labels.set(moduleKey, label);
    }
  }
  return labels;
}

function toCatalogModule(mod, labelByKey) {
  const moduleKey = normalizeModuleKey(mod.moduleKey);
  const cfg = getAnalyticsModuleConfig(moduleKey);
  const label =
    mod.label ||
    labelByKey.get(moduleKey) ||
    cfg?.label ||
    moduleKey;

  return {
    moduleKey,
    appKey: String(mod.appKey || cfg?.appKey || 'PLATFORM').toUpperCase(),
    label,
    collection: cfg?.collection || null,
    defaultFields: cfg?.defaultFields || [],
    reportable: isReportableAnalyticsModule(moduleKey),
    scope: mod.scope || null,
  };
}

async function listTenantAnalyticsModules(organizationId) {
  const labelByKey = await loadModuleLabelMap(organizationId);
  const modules = [];
  const seen = new Set();

  const addModule = (mod) => {
    const moduleKey = normalizeModuleKey(mod?.moduleKey);
    if (!moduleKey || ANALYTICS_EXCLUDED_MODULE_KEYS.has(moduleKey)) return;

    const appKey = String(mod?.appKey || getAnalyticsModuleConfig(moduleKey)?.appKey || 'PLATFORM').toUpperCase();
    const entryKey = moduleEntryKey(moduleKey, appKey);
    if (seen.has(entryKey)) return;
    seen.add(entryKey);

    modules.push(
      toCatalogModule(
        {
          moduleKey,
          appKey,
          label: mod?.label,
          scope: mod?.scope,
        },
        labelByKey,
      ),
    );
  };

  if (organizationId) {
    const tenantModules = await listTenantWebformModules(organizationId);
    for (const mod of tenantModules) {
      addModule(mod);
    }
  } else {
    for (const mod of listAnalyticsModules()) {
      addModule(mod);
    }
  }

  for (const mod of ANALYTICS_ONLY_MODULES) {
    addModule(mod);
  }

  for (const mod of listAnalyticsModules()) {
    addModule(mod);
  }

  return modules.sort((a, b) => {
    if (a.reportable !== b.reportable) return a.reportable ? -1 : 1;
    if (a.appKey !== b.appKey) return String(a.appKey).localeCompare(String(b.appKey));
    return String(a.label).localeCompare(String(b.label));
  });
}

async function getTenantAnalyticsModuleKeys(organizationId) {
  const modules = await listTenantAnalyticsModules(organizationId);
  return new Set(modules.map((mod) => mod.moduleKey));
}

module.exports = {
  listTenantAnalyticsModules,
  getTenantAnalyticsModuleKeys,
};
