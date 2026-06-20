/**
 * Seed default module sharing modes per enabled app (§8.5).
 * Builds entries from tenant enabled apps, core participation, and live UI modules.
 */

const ModuleSharingDefault = require('../models/ModuleSharingDefault');
const uiCompositionService = require('./uiCompositionService');
const {
  resolveEnabledAppKeys,
  getParticipatingAppsForCoreModule,
  normalizeHelpdeskCaseModuleKey,
  CORE_ENTITY_KEYS,
  CORE_MODULE_ORDER,
  PLATFORM_ADMIN_KEYS
} = require('./rolePermissionCatalogService');
const { APP_KEYS } = require('../constants/appKeys');

/** Default mode by module (RBAC §8.5). App-specific overrides win. */
const DEFAULT_MODE_BY_MODULE = {
  people: 'private',
  contacts: 'private',
  organizations: 'private',
  deals: 'private',
  tasks: 'private',
  events: 'private',
  cases: 'private',
  items: 'public_read',
  reports: 'public_read',
  quotes: 'record_level',
  sales_orders: 'record_level',
  invoices: 'record_level',
  forms: 'record_level',
  documents: 'record_level',
  payments: 'record_level',
  audits: 'private',
  findings: 'private',
  responses: 'record_level'
};

/** Legacy per-app overrides (kept for explicit SALES/CRM seeds). */
const DEFAULT_MODE_BY_APP_MODULE = {
  [APP_KEYS.SALES]: {
    contacts: 'private'
  },
  [APP_KEYS.CRM]: {
    contacts: 'private',
    deals: 'private'
  }
};

/** App-exclusive modules — remove rows under other apps when owner app is enabled. */
const MODULE_EXCLUSIVE_APP = {
  cases: APP_KEYS.HELPDESK
};

const FALLBACK_CORE_PRIVATE = ['people', 'contacts', 'organizations', 'deals', 'tasks', 'events'];

const PLATFORM_SHARING_MODULE_KEYS = ['reports'];

function resolveDefaultMode(appKey, moduleKey) {
  const upper = String(appKey || '').toUpperCase();
  const mod = String(moduleKey || '').toLowerCase();
  return DEFAULT_MODE_BY_APP_MODULE[upper]?.[mod] || DEFAULT_MODE_BY_MODULE[mod] || 'private';
}

function resolvePlatformHostApp(enabledApps) {
  if (enabledApps.includes(APP_KEYS.SALES)) return APP_KEYS.SALES;
  return enabledApps[0] || null;
}

/**
 * @param {string|import('mongoose').Types.ObjectId} organizationId
 * @param {object} organization
 * @returns {Promise<Array<{ appKey: string, moduleKey: string, mode: string }>>}
 */
async function buildDefaultSharingEntries(organizationId, organization) {
  const enabledApps = resolveEnabledAppKeys(organization);
  const moduleOverrides = organization?.moduleOverrides || {};
  const entries = [];
  const seen = new Set();

  const pushEntry = (appKey, moduleKey, mode = null) => {
    const upper = String(appKey || '').toUpperCase();
    const mod = String(moduleKey || '').toLowerCase();
    if (!upper || !mod) return;
    const key = `${upper}:${mod}`;
    if (seen.has(key)) return;
    seen.add(key);
    entries.push({
      appKey: upper,
      moduleKey: mod,
      mode: mode || resolveDefaultMode(upper, mod)
    });
  };

  for (const moduleKey of CORE_MODULE_ORDER) {
    const participatingApps = getParticipatingAppsForCoreModule(
      moduleKey,
      enabledApps,
      moduleOverrides
    );
    for (const appKey of participatingApps) {
      pushEntry(appKey, moduleKey);
    }
  }

  for (const appKey of enabledApps) {
    let uiModules = [];
    try {
      uiModules = await uiCompositionService.getUIModulesForApp(organizationId, appKey);
    } catch (error) {
      console.warn(`[SharingSeed] UI modules unavailable for ${appKey}:`, error.message);
    }

    for (const uiMod of uiModules || []) {
      const moduleKey = normalizeHelpdeskCaseModuleKey(String(uiMod.moduleKey || '').toLowerCase());
      if (!moduleKey || CORE_ENTITY_KEYS.has(moduleKey)) continue;
      if (PLATFORM_ADMIN_KEYS.includes(moduleKey)) continue;
      pushEntry(appKey, moduleKey);
    }
  }

  const platformHostApp = resolvePlatformHostApp(enabledApps);
  if (platformHostApp) {
    for (const moduleKey of PLATFORM_SHARING_MODULE_KEYS) {
      pushEntry(platformHostApp, moduleKey);
    }
  }

  if (entries.length === 0) {
    const appKey = APP_KEYS.SALES;
    for (const moduleKey of FALLBACK_CORE_PRIVATE) {
      pushEntry(appKey, moduleKey);
    }
  }

  // Cross-functional core modules must always appear in sharing defaults.
  for (const appKey of enabledApps) {
    const override = moduleOverrides?.documents?.[appKey];
    if (override === false) continue;
    pushEntry(appKey, 'documents');
  }

  return entries;
}

async function removeMisplacedSharingDefaults(organizationId, enabledApps, Model) {
  for (const [moduleKey, ownerApp] of Object.entries(MODULE_EXCLUSIVE_APP)) {
    if (!enabledApps.includes(ownerApp)) continue;
    await Model.deleteMany({
      organizationId,
      moduleKey,
      appKey: { $ne: ownerApp }
    });
  }
}

/**
 * @param {string|import('mongoose').Types.ObjectId} organizationId
 * @param {object} organization
 * @param {{ updatedBy?: import('mongoose').Types.ObjectId, ModuleSharingDefaultModel?: import('mongoose').Model }} [options]
 */
async function seedSharingDefaultsForOrganization(organizationId, organization, options = {}) {
  const ModuleSharingDefaultModel = options.ModuleSharingDefaultModel || ModuleSharingDefault;
  const enabledApps = resolveEnabledAppKeys(organization);

  await removeMisplacedSharingDefaults(organizationId, enabledApps, ModuleSharingDefaultModel);

  const entries = await buildDefaultSharingEntries(organizationId, organization);
  const created = [];
  const skipped = [];

  for (const entry of entries) {
    const result = await ModuleSharingDefaultModel.updateOne(
      {
        organizationId,
        appKey: entry.appKey,
        moduleKey: entry.moduleKey
      },
      {
        $setOnInsert: {
          organizationId,
          appKey: entry.appKey,
          moduleKey: entry.moduleKey,
          mode: entry.mode,
          updatedBy: options.updatedBy || null
        }
      },
      { upsert: true }
    );

    if (result.upsertedCount > 0) {
      created.push(entry);
    } else {
      skipped.push(entry);
    }
  }

  return { created, skipped, total: entries.length };
}

module.exports = {
  CORE_MODULE_ORDER,
  DEFAULT_MODE_BY_APP_MODULE,
  DEFAULT_MODE_BY_MODULE,
  MODULE_EXCLUSIVE_APP,
  buildDefaultSharingEntries,
  seedSharingDefaultsForOrganization
};
