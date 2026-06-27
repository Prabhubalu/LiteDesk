/**
 * ============================================================================
 * Runtime Permission Resolver
 * ============================================================================
 *
 * Single authority for permission checks at request time:
 * - Merges Role.permissions (legacy) + Role.appPermissions
 * - Projects into the existing user.permissions envelope shape
 * - Applies org-level enabledApps + moduleOverrides guards (defense in depth)
 *
 * Backward compatibility:
 * - contacts/people translation preserved
 * - Legacy envelope keys (view/create/edit/delete) unchanged
 * ============================================================================
 */

const Organization = require('../models/Organization');
const { APP_KEYS } = require('../constants/appKeys');
const {
  resolveEnabledAppKeys,
  normalizeHelpdeskCaseModuleKey,
  CORE_ENTITY_KEYS,
  PLATFORM_ADMIN_KEYS
} = require('./rolePermissionCatalogService');
const {
  projectRoleToUserPermissions,
  buildCasesEnvelopeFromAppAccess,
  ensurePermissionEnvelopeDefaults
} = require('../utils/rolePermissionProjection');
const { isTenantPrivilegedUser } = require('../utils/tenantPrivilegedAccess');
const {
  withoutLegacyCapabilitiesWhenRbacV2
} = require('../utils/rbacFeatureFlags');

function viewAllForModule(mod, rolePlain) {
  const m = toPlainObject(mod);
  if (rolePlain?.canViewAllData === true) return true;
  return m.scope === 'all' || m.viewAll === true;
}

const SALES_NATIVE_MODULES = new Set(['deals', 'projects']);
const INVENTORY_NATIVE_MODULES = new Set(['inventory']);
const AUDIT_APP_MODULES = new Set(['audits', 'schedule', 'findings']);
const PLATFORM_ADMIN_MODULES = new Set(PLATFORM_ADMIN_KEYS);
const {
  isCommercialPlatformModuleKey,
  commercialParticipationActive,
  COMMERCIAL_PARTICIPATION_APP_KEYS
} = require('../constants/commercialPlatformParticipation');
const { isInventoryEnabledForOrg } = require('./inventoryCapabilityService');
/** Cross-app capabilities that are not owned by a single business app. */
const CROSS_FUNCTIONAL_MODULES = new Set(['imports', 'documents']);

/** In-memory org context cache for a single request materialization burst */
const orgContextCache = new Map();
const ORG_CONTEXT_TTL_MS = 60 * 1000;

function toPlainObject(value) {
  if (!value) return {};
  if (typeof value.toObject === 'function') return value.toObject();
  return { ...value };
}

function toPlainAppPermissionsMap(value) {
  if (!value) return {};
  if (typeof value.entries === 'function') {
    const out = {};
    for (const [appKey, modules] of value.entries()) {
      out[String(appKey).toUpperCase()] = toPlainObject(modules);
    }
    return out;
  }
  const plain = toPlainObject(value);
  const out = {};
  for (const [appKey, modules] of Object.entries(plain)) {
    out[String(appKey).toUpperCase()] = toPlainObject(modules);
  }
  return out;
}

function normalizeStorageModuleKey(moduleKey) {
  const k = String(moduleKey || '').toLowerCase();
  if (k === 'people') return 'contacts';
  return normalizeHelpdeskCaseModuleKey(k);
}

function normalizeOrgModuleKey(moduleKey) {
  const k = String(moduleKey || '').toLowerCase();
  if (k === 'contacts') return 'people';
  return normalizeHelpdeskCaseModuleKey(k);
}

/**
 * @param {object|null|undefined} organization
 */
function buildOrgPermissionContext(organization) {
  const enabledAppKeys = resolveEnabledAppKeys(organization || {});
  const enabledAppsSet = new Set(enabledAppKeys);
  const moduleOverrides = organization?.moduleOverrides || {};

  const inventoryEnabled = isInventoryEnabledForOrg(organization);

  return {
    enabledAppKeys,
    enabledAppsSet,
    moduleOverrides,
    inventoryEnabled,
    isAppEnabled(appKey) {
      if (!appKey) return true;
      return enabledAppsSet.has(String(appKey).toUpperCase());
    },
    isModuleEnabledForApp(moduleKey, appKey) {
      if (!appKey) return true;
      const upper = String(appKey).toUpperCase();
      if (!enabledAppsSet.has(upper)) return false;

      const mod = normalizeOrgModuleKey(moduleKey);
      if (PLATFORM_ADMIN_MODULES.has(mod)) return true;

      if (isCommercialPlatformModuleKey(mod)) {
        if (!commercialParticipationActive(enabledAppKeys)) return false;
        if (!COMMERCIAL_PARTICIPATION_APP_KEYS.includes(upper)) return false;
        const override = moduleOverrides[mod]?.[upper];
        if (override !== undefined) return override === true;
        return true;
      }

      if (CORE_ENTITY_KEYS.has(mod)) {
        const override = moduleOverrides[mod]?.[upper];
        if (override !== undefined) return override === true;
        return true;
      }

      return true;
    }
  };
}

async function getOrgPermissionContextForUser(user, organizationHint = null) {
  const orgId = user?.organizationId;
  if (!orgId) {
    return buildOrgPermissionContext(null);
  }

  if (organizationHint) {
    return buildOrgPermissionContext(organizationHint);
  }

  if (user._orgPermissionContext) {
    return user._orgPermissionContext;
  }

  const cacheKey = String(orgId);
  const cached = orgContextCache.get(cacheKey);
  if (cached && Date.now() - cached.at < ORG_CONTEXT_TTL_MS) {
    return cached.data;
  }

  const organization = await Organization.findById(orgId).select('enabledApps moduleOverrides').lean();
  const ctx = buildOrgPermissionContext(organization);
  orgContextCache.set(cacheKey, { at: Date.now(), data: ctx });
  return ctx;
}

function mapMiddlewareActionToEnvelope(action) {
  const a = String(action || '').toLowerCase();
  if (a === 'read' || a === 'view') return 'view';
  if (a === 'create') return 'create';
  if (a === 'update' || a === 'edit') return 'edit';
  if (a === 'delete') return 'delete';
  if (a === 'export' || a === 'exportdata') return 'exportData';
  if (a === 'import') return 'import';
  if (a === 'manageusers') return 'manageUsers';
  if (a === 'manageroles') return 'manageRoles';
  if (a === 'managebilling') return 'manageBilling';
  if (a === 'customizefields') return 'customizeFields';
  if (a === 'viewstandard' || a === 'viewcustom') return a === 'viewstandard' ? 'viewStandard' : 'viewCustom';
  if (a === 'createcustom') return 'createCustom';
  if (a === 'exportreports') return 'exportReports';
  return a;
}

function roleMatrixToEnvelopeGrant(perms, rolePlain) {
  const p = toPlainObject(perms);
  const grant = {
    view: p.read === true || p.view === true,
    create: p.create === true,
    edit: p.update === true || p.edit === true,
    delete: p.delete === true,
    viewAll: viewAllForModule(p, rolePlain)
  };
  if (p.export === true) grant.exportData = true;
  if (p.import === true) grant.import = true;
  if (p.execution === true) grant.execution = true;
  if (p.review === true) grant.review = true;
  if (p.approve === true) grant.approve = true;
  if (p.manageRoles === true) grant.manageRoles = true;
  if (p.manageBilling === true) grant.manageBilling = true;
  if (p.manageUsers === true) grant.manageUsers = true;
  if (p.customizeFields === true) grant.customizeFields = true;
  return grant;
}

function resolveLegacyModuleAppKey(storageModuleKey) {
  const mod = storageModuleKey;
  if (PLATFORM_ADMIN_MODULES.has(mod)) return null;
  if (SALES_NATIVE_MODULES.has(mod)) return APP_KEYS.SALES;
  if (INVENTORY_NATIVE_MODULES.has(mod)) return APP_KEYS.INVENTORY;
  if (mod === 'cases') return APP_KEYS.HELPDESK;
  if (AUDIT_APP_MODULES.has(mod)) return APP_KEYS.AUDIT;
  if (mod === 'contacts' || CORE_ENTITY_KEYS.has(mod)) {
    return null;
  }
  return APP_KEYS.SALES;
}

/**
 * Build per-app permission grants from role.permissions + role.appPermissions.
 * @param {object} rolePlain
 */
function buildModulesByAppFromRole(rolePlain) {
  const modulesByApp = {};
  const legacy = toPlainObject(rolePlain?.permissions);

  const ensureApp = (appKey) => {
    const upper = String(appKey).toUpperCase();
    if (!modulesByApp[upper]) modulesByApp[upper] = {};
    return modulesByApp[upper];
  };

  for (const [rawMod, perms] of Object.entries(legacy)) {
    const storageMod = normalizeStorageModuleKey(rawMod);
    const appKey = resolveLegacyModuleAppKey(storageMod);
    if (!appKey) continue;
    ensureApp(appKey)[storageMod] = roleMatrixToEnvelopeGrant(perms, rolePlain);
  }

  const appPerms = toPlainAppPermissionsMap(rolePlain?.appPermissions);
  for (const [appKey, modules] of Object.entries(appPerms)) {
    const bucket = ensureApp(appKey);
    for (const [rawMod, perms] of Object.entries(modules)) {
      const storageMod = normalizeStorageModuleKey(rawMod);
      bucket[storageMod] = roleMatrixToEnvelopeGrant(perms, rolePlain);
    }
  }

  return modulesByApp;
}

function buildFlatPermissionIndex(envelope, modulesByApp) {
  const flat = {};

  const add = (compoundKey, grant) => {
    if (!grant || typeof grant !== 'object') return;
    for (const [action, allowed] of Object.entries(grant)) {
      if (allowed === true) {
        flat[`${compoundKey}.${action}`] = true;
      }
    }
  };

  for (const [mod, grant] of Object.entries(envelope || {})) {
    add(mod, grant);
  }

  for (const [appKey, modules] of Object.entries(modulesByApp || {})) {
    for (const [mod, grant] of Object.entries(modules)) {
      add(`${appKey}:${mod}`, grant);
    }
  }

  return flat;
}

/**
 * Resolve which app context governs a permission check.
 */
function resolveEffectiveAppKey(storageModuleKey, requestAppKey) {
  const mod = storageModuleKey;
  if (PLATFORM_ADMIN_MODULES.has(mod) || CROSS_FUNCTIONAL_MODULES.has(mod)) return null;

  if (SALES_NATIVE_MODULES.has(mod)) return APP_KEYS.SALES;
  if (INVENTORY_NATIVE_MODULES.has(mod)) return APP_KEYS.INVENTORY;
  if (mod === 'cases') return APP_KEYS.HELPDESK;

  if (isCommercialPlatformModuleKey(mod)) {
    const req = requestAppKey ? String(requestAppKey).toUpperCase() : null;
    if (req && COMMERCIAL_PARTICIPATION_APP_KEYS.includes(req)) return req;
    return APP_KEYS.SALES;
  }

  if (mod === 'contacts' || CORE_ENTITY_KEYS.has(mod)) {
    return requestAppKey ? String(requestAppKey).toUpperCase() : APP_KEYS.SALES;
  }

  return requestAppKey ? String(requestAppKey).toUpperCase() : APP_KEYS.SALES;
}

function passesOrgAuthorizationGuards(orgContext, storageModuleKey, effectiveAppKey) {
  if (!orgContext) return true;

  if (PLATFORM_ADMIN_MODULES.has(storageModuleKey)) {
    return true;
  }

  const orgMod = normalizeOrgModuleKey(storageModuleKey);

  if (isCommercialPlatformModuleKey(orgMod)) {
    if (!commercialParticipationActive(orgContext.enabledAppKeys)) return false;
    const participating = orgContext.enabledAppKeys.filter((appKey) =>
      COMMERCIAL_PARTICIPATION_APP_KEYS.includes(String(appKey).toUpperCase())
    );
    if (!participating.length) return false;
    return participating.some(
      (appKey) =>
        orgContext.isAppEnabled(appKey) &&
        orgContext.isModuleEnabledForApp(storageModuleKey, appKey)
    );
  }

  if (INVENTORY_NATIVE_MODULES.has(orgMod)) {
    if (!orgContext.isAppEnabled(APP_KEYS.INVENTORY)) return false;
    return orgContext.isModuleEnabledForApp(storageModuleKey, APP_KEYS.INVENTORY);
  }

  if (effectiveAppKey && !orgContext.isAppEnabled(effectiveAppKey)) {
    return false;
  }

  if (effectiveAppKey && !orgContext.isModuleEnabledForApp(storageModuleKey, effectiveAppKey)) {
    return false;
  }

  return true;
}

function readGrantFromRuntime(runtime, storageModuleKey, envelopeAction, effectiveAppKey) {
  if (effectiveAppKey && runtime?.modulesByApp?.[effectiveAppKey]?.[storageModuleKey]) {
    const grant = runtime.modulesByApp[effectiveAppKey][storageModuleKey];
    if (grant[envelopeAction] === true) return true;
    if (envelopeAction === 'edit' && grant.customizeFields === true) return true;
    return false;
  }

  const envelope = runtime?.envelope || {};
  const modGrant = envelope[storageModuleKey];
  if (!modGrant) {
    if (storageModuleKey === 'contacts' && envelope.people) {
      return envelope.people[envelopeAction] === true;
    }
    if (storageModuleKey === 'responses' && envelope.forms) {
      return envelope.forms[envelopeAction] === true;
    }
  } else {
    if (modGrant[envelopeAction] === true) return true;
    if (storageModuleKey === 'settings' && envelopeAction === 'edit' && modGrant.customizeFields === true) {
      return true;
    }
  }

  if (CROSS_FUNCTIONAL_MODULES.has(storageModuleKey) && runtime?.modulesByApp) {
    for (const appModules of Object.values(runtime.modulesByApp)) {
      const grant = appModules?.[storageModuleKey];
      if (!grant) continue;
      if (grant[envelopeAction] === true) return true;
      if (storageModuleKey === 'settings' && envelopeAction === 'edit' && grant.customizeFields === true) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Authoritative runtime permission check.
 */
function resolveRuntimePermission(user, module, action, options = {}) {
  if (!user) return false;

  const storageModule = normalizeStorageModuleKey(module);
  const envelopeAction = mapMiddlewareActionToEnvelope(action);
  const requestAppKey = options.appKey || options.req?.appKey || null;
  const effectiveAppKey = resolveEffectiveAppKey(storageModule, requestAppKey);

  const orgContext = options.orgContext || user._orgPermissionContext || null;

  if (!passesOrgAuthorizationGuards(orgContext, storageModule, effectiveAppKey)) {
    return false;
  }

  if (effectiveAppKey && requestAppKey && String(requestAppKey).toUpperCase() !== effectiveAppKey) {
    if (
      SALES_NATIVE_MODULES.has(storageModule) ||
      INVENTORY_NATIVE_MODULES.has(storageModule) ||
      storageModule === 'cases'
    ) {
      return false;
    }
  }

  if (
    SALES_NATIVE_MODULES.has(storageModule) ||
    INVENTORY_NATIVE_MODULES.has(storageModule) ||
    storageModule === 'cases'
  ) {
    if (requestAppKey && String(requestAppKey).toUpperCase() !== effectiveAppKey) {
      return false;
    }
  }

  if (isTenantPrivilegedUser(user)) {
    return true;
  }

  const runtime = user._permissionRuntime;
  if (runtime) {
    return readGrantFromRuntime(runtime, storageModule, envelopeAction, effectiveAppKey);
  }

  const legacyMod = storageModule === 'contacts' ? 'contacts' : storageModule;
  let perms = user.permissions?.[legacyMod] || user.permissions?.people;
  if (!perms && storageModule === 'responses') {
    perms = user.permissions?.forms;
  }
  if (!perms) return false;
  if (perms[envelopeAction] === true) return true;
  if (storageModule === 'settings' && envelopeAction === 'edit' && perms.customizeFields === true) {
    return true;
  }
  return false;
}

/**
 * Materialize runtime permissions on user (mutates user in place).
 * @param {object} user
 * @param {{ roleLean?: object, organization?: object|null, appAccess?: object[] }} options
 */
async function materializeRuntimePermissionsOnUser(user, options = {}) {
  if (!user) return;

  const organization =
    options.organization ||
    (await Organization.findById(user.organizationId).select('enabledApps moduleOverrides').lean());

  const orgContext = buildOrgPermissionContext(organization);
  user._orgPermissionContext = orgContext;

  const roleLeanRaw = options.roleLean;
  const roleLean = roleLeanRaw
    ? withoutLegacyCapabilitiesWhenRbacV2(roleLeanRaw, organization)
    : null;
  const appAccess = options.appAccess || user.appAccess || [];

  let envelope;
  if (roleLean) {
    envelope = projectRoleToUserPermissions(roleLean, appAccess);
  } else if (user.permissions && typeof user.permissions === 'object') {
    envelope = toPlainObject(user.permissions);
    ensurePermissionEnvelopeDefaults(envelope);
  } else {
    envelope = {};
    ensurePermissionEnvelopeDefaults(envelope);
  }

  const modulesByApp = roleLean ? buildModulesByAppFromRole(roleLean) : {};
  const flat = buildFlatPermissionIndex(envelope, modulesByApp);

  user.permissions = envelope;
  user._permissionRuntime = {
    envelope,
    modulesByApp,
    flat
  };
}

function invalidateOrgPermissionContextCache(organizationId) {
  if (organizationId) {
    orgContextCache.delete(String(organizationId));
  }
}

const APP_KEY_ALIASES = {
  sales: APP_KEYS.SALES,
  crm: APP_KEYS.SALES,
  helpdesk: APP_KEYS.HELPDESK,
  projects: APP_KEYS.PROJECTS,
  portal: APP_KEYS.PORTAL,
  audit: APP_KEYS.AUDIT,
  lms: APP_KEYS.LMS,
  marketing: 'MARKETING'
};

function normalizeAppKeyFromPermissionSegment(segment) {
  if (!segment) return null;
  const raw = String(segment).trim();
  const upper = raw.toUpperCase();
  if (Object.values(APP_KEYS).includes(upper)) return upper;
  return APP_KEY_ALIASES[raw.toLowerCase()] || upper;
}

/**
 * Parse canonical permission strings (e.g. people.attach.sales) into resolver input.
 * @param {string} permission
 * @returns {{ module: string, action: string, appKey: string|null }|null}
 */
function parsePermissionString(permission) {
  const key = String(permission || '').trim().toLowerCase();
  if (!key) return null;

  const parts = key.split('.');
  if (parts.length < 2) return null;

  const module = parts[0];

  if (parts.length === 2) {
    if (parts[1] === 'view') return { module, action: 'view', appKey: null };
    if (parts[1] === 'edit') return { module, action: 'edit', appKey: null };
    if (parts[1] === 'attach') return { module, action: 'create', appKey: null };
  }

  if (parts[1] === 'attach') {
    return {
      module,
      action: 'create',
      appKey: parts[2] ? normalizeAppKeyFromPermissionSegment(parts[2]) : null
    };
  }

  if (parts[1] === 'participation' && parts[2] === 'edit') {
    return {
      module,
      action: 'edit',
      appKey: parts[3] ? normalizeAppKeyFromPermissionSegment(parts[3]) : null
    };
  }

  if (parts[1] === 'lifecycle' && parts[2] === 'manage') {
    return {
      module,
      action: 'edit',
      appKey: parts[3] ? normalizeAppKeyFromPermissionSegment(parts[3]) : null
    };
  }

  return null;
}

function userHasAppSeatAccess(user, appKey) {
  if (!appKey) return true;
  const upper = String(appKey).toUpperCase();
  const fromAccess = (user.appAccess || []).some(
    (entry) => String(entry.appKey || '').toUpperCase() === upper && entry.status === 'ACTIVE'
  );
  if (fromAccess) return true;

  const allowed = user.allowedApps || [];
  return allowed.some((app) => String(app).toUpperCase() === upper);
}

/**
 * Org guards for a parsed string permission (enabled app + core module participation).
 */
function passesOrgGuardsForStringPermission(orgContext, parsed) {
  if (!orgContext || !parsed) return true;

  const storageModule = normalizeStorageModuleKey(parsed.module);
  const effectiveAppKey =
    parsed.appKey || resolveEffectiveAppKey(storageModule, parsed.appKey);

  return passesOrgAuthorizationGuards(orgContext, storageModule, effectiveAppKey);
}

/**
 * Resolve a canonical permission string via the runtime resolver.
 * @param {object} user
 * @param {string} permission
 * @param {{ appKey?: string, orgContext?: object, req?: object }} [options]
 */
function resolveStringPermission(user, permission, options = {}) {
  if (!user) return false;

  const parsed = parsePermissionString(permission);
  if (!parsed) {
    if (Array.isArray(user.permissions)) {
      return user.permissions.includes(permission);
    }
    if (user.permissions && typeof user.permissions === 'object') {
      return user.permissions[permission] === true;
    }
    return false;
  }

  const orgContext = options.orgContext || user._orgPermissionContext || null;
  if (!passesOrgGuardsForStringPermission(orgContext, parsed)) {
    return false;
  }

  if (isTenantPrivilegedUser(user)) {
    return true;
  }

  const effectiveAppKey =
    parsed.appKey ||
    (options.appKey ? String(options.appKey).toUpperCase() : null) ||
    null;

  if (effectiveAppKey && !userHasAppSeatAccess(user, effectiveAppKey)) {
    return false;
  }

  const requestAppKey = effectiveAppKey || options.appKey || null;

  return resolveRuntimePermission(user, parsed.module, parsed.action, {
    appKey: requestAppKey,
    orgContext
  });
}

module.exports = {
  buildOrgPermissionContext,
  getOrgPermissionContextForUser,
  buildModulesByAppFromRole,
  materializeRuntimePermissionsOnUser,
  resolveRuntimePermission,
  resolveStringPermission,
  parsePermissionString,
  passesOrgGuardsForStringPermission,
  userHasAppSeatAccess,
  resolveEffectiveAppKey,
  passesOrgAuthorizationGuards,
  mapMiddlewareActionToEnvelope,
  normalizeStorageModuleKey,
  normalizeAppKeyFromPermissionSegment,
  invalidateOrgPermissionContextCache
};
