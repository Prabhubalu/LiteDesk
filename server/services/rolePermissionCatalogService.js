/**
 * ============================================================================
 * Role Permission Catalog Service
 * ============================================================================
 *
 * Builds the Roles & Permissions module matrix from live tenant configuration:
 * - Organization enabled apps
 * - Core module participation (moduleOverrides)
 * - Platform ModuleDefinition metadata
 * - Per-app UI modules (TenantModuleConfiguration + app definitions)
 *
 * The catalog is the single source of truth for GET /roles/modules.
 * ============================================================================
 */

const Organization = require('../models/Organization');
const ModuleDefinition = require('../models/ModuleDefinition');
const AppDefinition = require('../models/AppDefinition');
const uiCompositionService = require('./uiCompositionService');
const { APP_KEYS, VALID_APP_KEYS } = require('../constants/appKeys');

const CORE_MODULE_ORDER = [
  'people',
  'organizations',
  'tasks',
  'events',
  'items',
  'forms',
  'documents',
  'quotes',
  'sales_orders',
  'invoices',
  'payments'
];
const {
  isCommercialPlatformModuleKey,
  commercialParticipationActive,
  COMMERCIAL_PARTICIPATION_APP_KEYS
} = require('../constants/commercialPlatformParticipation');
const CORE_ENTITY_KEYS = new Set(CORE_MODULE_ORDER);
const PLATFORM_ADMIN_KEYS = ['reports', 'users', 'settings', 'performance', 'webforms'];

/** Modules stored on Role.permissions (flat legacy envelope). */
const LEGACY_FLAT_STORAGE_KEYS = new Set([
  'people',
  'organizations',
  'deals',
  'tasks',
  'events',
  'forms',
  'webforms',
  'items',
  'documents',
  'reports',
  'users',
  'settings',
  'cases'
]);

const HELPDESK_CASE_MODULE_KEYS = new Set(['cases', 'ticket', 'tickets', 'ticklets']);

const APP_DISPLAY_NAMES = {
  sales: 'Sales',
  helpdesk: 'Helpdesk',
  projects: 'Projects',
  portal: 'Portal',
  audit: 'Audit',
  lms: 'Learning',
  inventory: 'Inventory'
};

/** @type {Map<string, { at: number, data: object }>} */
const catalogCache = new Map();
const CATALOG_TTL_MS = 60 * 1000;

const DEFAULT_ACTIONS_BY_KIND = {
  crud: ['read', 'create', 'update', 'delete'],
  crudExport: ['read', 'create', 'update', 'delete', 'export'],
  crudImport: ['read', 'create', 'update', 'delete', 'export', 'import'],
  reports: ['read', 'create', 'update', 'delete', 'export'],
  users: ['read', 'create', 'update', 'delete', 'manageRoles'],
  settings: ['read', 'edit', 'manageRoles', 'manageBilling']
};

function capitalizeFirst(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function normalizeHelpdeskCaseModuleKey(moduleKey) {
  const k = String(moduleKey || '').toLowerCase();
  return HELPDESK_CASE_MODULE_KEYS.has(k) ? 'cases' : k;
}

/**
 * Resolve UI + storage key for a catalog row.
 * @param {string|null} appKey - Uppercase app key or null for platform rows
 * @param {string} moduleKey
 */
function resolveCatalogKey(appKey, moduleKey) {
  const mod = normalizeHelpdeskCaseModuleKey(moduleKey);
  const upper = appKey ? String(appKey).toUpperCase() : null;

  if (!upper) {
    return mod === 'people' ? 'people' : mod;
  }

  if (upper === APP_KEYS.HELPDESK && mod === 'cases') {
    return 'cases';
  }

  if (CORE_ENTITY_KEYS.has(mod)) {
    return mod === 'people' ? 'people' : mod;
  }

  if (LEGACY_FLAT_STORAGE_KEYS.has(mod) && upper === APP_KEYS.SALES) {
    return mod;
  }

  return `${upper}:${mod}`;
}

/**
 * Map ModuleDefinition.permissions flags to role-editor action verbs.
 * @param {object} moduleDefPermissions
 * @param {string} moduleKey
 * @param {string} kind - catalog kind
 */
function buildActionsFromDefinition(moduleDefPermissions = {}, moduleKey, kind) {
  if (kind === 'users') return [...DEFAULT_ACTIONS_BY_KIND.users];
  if (kind === 'settings') return ['read', 'update', 'manageRoles', 'manageBilling'];
  if (kind === 'performance') return ['view', 'create', 'edit', 'activate', 'manageTypes', 'manageOrgSettings'];
  if (kind === 'reports') return [...DEFAULT_ACTIONS_BY_KIND.reports];
  if (moduleKey === 'imports') return ['read', 'create', 'delete'];
  if (moduleKey === 'documents') return ['read', 'create', 'update', 'delete'];

  const actions = [];
  const p = moduleDefPermissions || {};

  if (p.view !== false) actions.push('read');
  if (p.create !== false) actions.push('create');
  if (p.edit !== false) actions.push('update');
  if (p.delete === true) actions.push('delete');

  if (
    [
      'people',
      'organizations',
      'deals',
      'quotes',
      'sales_orders',
      'invoices',
      'payments',
      'tasks',
      'forms',
      'items'
    ].includes(moduleKey)
  ) {
    actions.push('export', 'import');
  } else if (moduleKey === 'events') {
    // events: no import in legacy schema
  } else if (moduleKey === 'cases') {
    // cases: CRUD only
  } else {
    actions.push('export');
  }

  if (p.execution === true) actions.push('execution');
  if (p.review === true) actions.push('review');
  if (p.approve === true) actions.push('approve');

  const unique = [...new Set(actions)];
  return unique.length ? unique : [...DEFAULT_ACTIONS_BY_KIND.crud];
}

function moduleKindForKey(moduleKey) {
  if (moduleKey === 'users') return 'users';
  if (moduleKey === 'settings') return 'settings';
  if (moduleKey === 'performance') return 'performance';
  if (moduleKey === 'reports') return 'reports';
  return 'crud';
}

function getParticipatingAppsForCoreModule(moduleKey, enabledAppKeys, moduleOverrides) {
  const mod = String(moduleKey || '').toLowerCase();

  if (isCommercialPlatformModuleKey(mod)) {
    const participatingEnabled = enabledAppKeys.filter((appKey) =>
      COMMERCIAL_PARTICIPATION_APP_KEYS.includes(String(appKey).toUpperCase())
    );
    if (!commercialParticipationActive(enabledAppKeys)) return [];
    return participatingEnabled.filter((appKey) => {
      const override = moduleOverrides?.[mod]?.[appKey];
      if (override !== undefined) return override === true;
      return true;
    });
  }

  return enabledAppKeys.filter((appKey) => {
    const override = moduleOverrides?.[mod]?.[appKey];
    if (override !== undefined) return override === true;
    return true;
  });
}

function isCoreModuleEnabledForOrg(moduleKey, enabledAppKeys, moduleOverrides) {
  return getParticipatingAppsForCoreModule(moduleKey, enabledAppKeys, moduleOverrides).length > 0;
}

function resolveEnabledAppKeys(organization) {
  const rawApps = Array.isArray(organization?.enabledApps) ? organization.enabledApps : [];
  const keys = rawApps
    .filter((app) => app != null && (typeof app === 'object' ? app.status === 'ACTIVE' : typeof app === 'string'))
    .map((app) => (typeof app === 'string' ? app : app.appKey))
    .filter(Boolean)
    .map((k) => String(k).toUpperCase())
    .filter((k) => VALID_APP_KEYS.includes(k) && k !== APP_KEYS.CONTROL_PLANE);

  if (keys.length === 0) {
    return [APP_KEYS.SALES];
  }
  return [...new Set(keys)];
}

async function resolveAppDisplayName(appKey) {
  const lower = String(appKey || '').toLowerCase();
  const platform = await AppDefinition.findOne({ appKey: lower, enabled: true })
    .select('name')
    .lean();
  return platform?.name || APP_DISPLAY_NAMES[lower] || String(appKey).toUpperCase();
}

function buildPlatformAdminCatalogEntries() {
  const entries = [
    {
      key: 'imports',
      moduleKey: 'imports',
      label: 'Import',
      description: 'Import data across modules and applications',
      kind: 'crud',
      scope: 'platform',
      appKey: null,
      order: 199,
      hasScope: false,
      supportsViewAll: false
    },
    {
      key: 'reports',
      moduleKey: 'reports',
      label: 'Reports',
      description: 'View and create reports',
      kind: 'reports',
      scope: 'platform',
      appKey: null,
      order: 200,
      hasScope: false,
      supportsViewAll: false
    },
    {
      key: 'users',
      moduleKey: 'users',
      label: 'User Management',
      description: 'Manage users and seat assignments',
      kind: 'users',
      scope: 'platform',
      appKey: null,
      order: 201,
      hasScope: false,
      supportsViewAll: false
    },
    {
      key: 'settings',
      moduleKey: 'settings',
      label: 'Settings',
      description: 'System configuration, modules, and billing',
      kind: 'settings',
      scope: 'platform',
      appKey: null,
      order: 202,
      hasScope: false,
      supportsViewAll: false
    },
    {
      key: 'performance',
      moduleKey: 'performance',
      label: 'Performance (Targets & Quotas)',
      description: 'Platform targets, quotas, and performance configuration',
      kind: 'performance',
      scope: 'platform',
      appKey: null,
      order: 203,
      hasScope: false,
      supportsViewAll: false
    },
    {
      key: 'webforms',
      moduleKey: 'webforms',
      label: 'Web Forms',
      description: 'Create and manage public web forms',
      kind: 'crud',
      scope: 'platform',
      appKey: null,
      order: 204,
      hasScope: false,
      supportsViewAll: false
    }
  ];

  return entries.map((row) => ({
    ...row,
    actions: buildActionsFromDefinition({}, row.moduleKey, row.kind)
  }));
}

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
      out[appKey] = toPlainObject(modules);
    }
    return out;
  }
  return toPlainObject(value);
}

function incomingPayloadTouchesKey(incomingKeys, storageKey, uiKey) {
  if (incomingKeys.has(uiKey) || incomingKeys.has(storageKey)) return true;
  if (storageKey === 'contacts' && incomingKeys.has('people')) return true;
  return false;
}

function normalizeModulePerms(mod, raw = {}) {
  const read = raw.read !== undefined ? raw.read : (raw.view || false);
  const update = raw.update !== undefined ? raw.update : (raw.edit || false);
  const exp = raw.export !== undefined ? raw.export : (raw.exportData || false);
  const imp = raw.import || false;
  const create = !!raw.create;
  const del = raw.delete || false;
  const scope = raw.scope;

  if (mod === 'reports') {
    return { create, read, update, delete: del, export: exp };
  }
  if (mod === 'users') {
    return { create, read, update, delete: del, manageRoles: !!raw.manageRoles };
  }
  if (mod === 'settings') {
    return {
      view: !!raw.view || !!raw.read,
      edit: !!raw.edit || !!raw.update,
      manageRoles: !!raw.manageRoles,
      manageBilling: !!raw.manageBilling
    };
  }
  if (mod === 'performance') {
    const nested = raw.targets || raw;
    return {
      targets: {
        view: !!(nested.view || nested.read),
        create: !!nested.create,
        edit: !!nested.edit || !!nested.update,
        activate: !!nested.activate,
        manageTypes: !!nested.manageTypes,
        manageOrgSettings: !!nested.manageOrgSettings
      }
    };
  }
  if (mod === 'cases') {
    const base = { create, read, update, delete: del };
    if (scope) base.scope = scope;
    if (raw.viewAll) base.viewAll = true;
    return base;
  }

  const base = { create, read, update, delete: del };
  if (['contacts', 'organizations', 'deals', 'tasks', 'forms', 'items'].includes(mod)) {
    base.export = exp;
    base.import = imp;
    if (scope) base.scope = scope;
    if (raw.viewAll) base.viewAll = true;
  } else if (mod === 'events') {
    if (scope) base.scope = scope;
    if (raw.viewAll) base.viewAll = true;
  } else {
    if (scope) base.scope = scope;
    if (raw.viewAll) base.viewAll = true;
    if (exp) base.export = exp;
    if (imp) base.import = imp;
  }

  if (raw.execution) base.execution = true;
  if (raw.review) base.review = true;
  if (raw.approve) base.approve = true;

  return base;
}

/**
 * Normalize UI payload into Role.permissions + Role.appPermissions.
 * @param {object} input
 */
function normalizeRolePermissions(input) {
  const src = { ...(input || {}) };
  if (src.people && !src.contacts) {
    src.contacts = src.people;
  }

  const legacy = {};
  const appPermissions = {};

  for (const [uiKey, rawPerms] of Object.entries(src)) {
    if (!rawPerms || typeof rawPerms !== 'object') continue;

    if (uiKey.includes(':')) {
      const [appKey, moduleKey] = uiKey.split(':');
      const upper = String(appKey || '').toUpperCase();
      const mod = moduleKey.toLowerCase();
      if (!appPermissions[upper]) appPermissions[upper] = {};
      appPermissions[upper][mod] = normalizeModulePerms(mod, rawPerms);
      continue;
    }

    const storageKey = uiKey === 'people' ? 'contacts' : uiKey.toLowerCase();
    legacy[storageKey] = normalizeModulePerms(storageKey, rawPerms);
  }

  return {
    permissions: legacy,
    appPermissions: Object.keys(appPermissions).length > 0 ? appPermissions : undefined
  };
}

/**
 * Merge UI edits onto stored role permissions.
 * Only keys present in the incoming UI payload are updated; hidden/disabled modules are preserved.
 *
 * @param {object} existingRole - Mongoose doc or plain role
 * @param {object} incomingRaw - req.body.permissions from role editor
 */
function mergeIncomingRolePermissions(existingRole, incomingRaw) {
  const incomingKeys = new Set(Object.keys(incomingRaw || {}));
  const normalized = normalizeRolePermissions(incomingRaw);

  const mergedLegacy = toPlainObject(existingRole?.permissions);
  for (const [storageKey, value] of Object.entries(normalized.permissions)) {
    const uiKey = storageKey === 'contacts' ? 'people' : storageKey;
    if (incomingPayloadTouchesKey(incomingKeys, storageKey, uiKey)) {
      mergedLegacy[storageKey] = value;
    }
  }

  const mergedApp = toPlainAppPermissionsMap(existingRole?.appPermissions);
  if (normalized.appPermissions) {
    for (const [appKey, modules] of Object.entries(normalized.appPermissions)) {
      if (!mergedApp[appKey]) mergedApp[appKey] = {};
      for (const [mod, value] of Object.entries(modules)) {
        const catalogKey = `${appKey}:${mod}`;
        const flatKey = resolveCatalogKey(appKey, mod);
        if (
          incomingKeys.has(catalogKey) ||
          incomingKeys.has(mod) ||
          incomingKeys.has(flatKey)
        ) {
          mergedApp[appKey][mod] = value;
        }
      }
    }
  }

  return {
    permissions: mergedLegacy,
    appPermissions: Object.keys(mergedApp).length > 0 ? mergedApp : undefined
  };
}

async function loadModuleDefinitionsForPairs(pairs) {
  if (!pairs.length) return new Map();

  const defs = await ModuleDefinition.find({
    $or: pairs.map((p) => ({
      appKey: p.appKey,
      moduleKey: p.moduleKey,
      $or: [{ organizationId: null }, { organizationId: { $exists: false } }]
    }))
  })
    .select('appKey moduleKey permissions description label')
    .lean();

  const map = new Map();
  for (const def of defs) {
    map.set(`${String(def.appKey).toLowerCase()}:${String(def.moduleKey).toLowerCase()}`, def);
  }
  return map;
}

const PLATFORM_ADMIN_MODULE_KEYS = new Set([
  'imports',
  'reports',
  'users',
  'settings',
  'performance',
  'webforms'
]);

const FIELD_RBAC_EXCLUDED_KEYS = new Set([
  'deletedat',
  'deletedby',
  'deletionreason',
  'source',
  'appointment',
  'playbookstate',
  '_id',
  '__v',
  'organizationid',
  'participations',
  'activitylogs',
  'descriptionversions',
  'derivedstatus',
  'legacycontactid'
]);

function normalizeFieldKeyForRbac(fieldKey) {
  return String(fieldKey || '')
    .toLowerCase()
    .trim()
    .replace(/[\s._-]+/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function fieldKeyFromDefinition(field) {
  return String(field?.key || field?.name || '').trim();
}

function resolveFieldCatalogLookupKeys(moduleKey) {
  const norm = normalizeHelpdeskCaseModuleKey(String(moduleKey || '').toLowerCase());
  if (norm === 'people') return ['people', 'contacts'];
  return [norm];
}

function resolveFieldCatalogAppKeys(mod, enabledAppKeys = []) {
  if (mod.scope === 'app' && mod.appKey) {
    return [String(mod.appKey).toLowerCase(), 'platform'];
  }
  if (mod.scope === 'core') {
    const participating = Array.isArray(mod.participatingApps)
      ? mod.participatingApps.map((a) => String(a).toLowerCase())
      : enabledAppKeys.map((a) => String(a).toLowerCase());
    return [...new Set([...participating, 'platform'])];
  }
  return ['platform'];
}

function isFieldEligibleForRbacCatalog(field) {
  const key = fieldKeyFromDefinition(field);
  if (!key) return false;
  const norm = normalizeFieldKeyForRbac(key);
  if (!norm || FIELD_RBAC_EXCLUDED_KEYS.has(norm)) return false;
  if (field?.isVisibleInConfig === false) return false;
  return true;
}

function mapFieldCatalogEntries(rawFields) {
  if (!Array.isArray(rawFields)) return [];
  return rawFields
    .filter((f) => isFieldEligibleForRbacCatalog(f))
    .map((f) => {
      const key = fieldKeyFromDefinition(f);
      return {
        key,
        label: f.label || f.name || key,
        defaultAccess: 'write'
      };
    })
    .sort((a, b) => String(a.label).localeCompare(String(b.label)));
}

async function buildFieldCatalogLookup(organizationId) {
  const [orgDefs, platformDefs] = await Promise.all([
    organizationId
      ? ModuleDefinition.find({ organizationId }).select('key moduleKey appKey fields').lean()
      : Promise.resolve([]),
    ModuleDefinition.find({
      $or: [{ organizationId: null }, { organizationId: { $exists: false } }]
    })
      .select('key moduleKey appKey fields')
      .lean()
  ]);

  const orgByModuleKey = new Map();
  for (const def of orgDefs) {
    const mk = String(def.moduleKey || def.key || '').toLowerCase();
    if (!mk || !Array.isArray(def.fields) || !def.fields.length) continue;
    orgByModuleKey.set(mk, def.fields);
    if (mk === 'people') orgByModuleKey.set('contacts', def.fields);
  }

  const platformByAppModule = new Map();
  const platformByModuleKey = new Map();
  for (const def of platformDefs) {
    const mk = String(def.moduleKey || def.key || '').toLowerCase();
    if (!mk || !Array.isArray(def.fields) || !def.fields.length) continue;
    const ak = String(def.appKey || 'platform').toLowerCase();
    platformByAppModule.set(`${ak}:${mk}`, def.fields);
    if (!platformByModuleKey.has(mk)) platformByModuleKey.set(mk, def.fields);
    if (mk === 'people') {
      platformByAppModule.set(`${ak}:contacts`, def.fields);
      if (!platformByModuleKey.has('contacts')) platformByModuleKey.set('contacts', def.fields);
    }
  }

  return { orgByModuleKey, platformByAppModule, platformByModuleKey };
}

function resolveFieldCatalogForModule(mod, lookup, enabledAppKeys = []) {
  if (!mod || mod.scope === 'platform') return [];
  if (PLATFORM_ADMIN_MODULE_KEYS.has(String(mod.moduleKey || '').toLowerCase())) return [];

  const lookupKeys = resolveFieldCatalogLookupKeys(mod.moduleKey);
  for (const mk of lookupKeys) {
    const orgFields = lookup.orgByModuleKey.get(mk);
    if (orgFields) {
      const mapped = mapFieldCatalogEntries(orgFields);
      if (mapped.length) return mapped;
    }
  }

  const appKeys = resolveFieldCatalogAppKeys(mod, enabledAppKeys);
  for (const mk of lookupKeys) {
    for (const ak of appKeys) {
      const fields =
        lookup.platformByAppModule.get(`${ak}:${mk}`) || lookup.platformByModuleKey.get(mk);
      if (fields) {
        const mapped = mapFieldCatalogEntries(fields);
        if (mapped.length) return mapped;
      }
    }
  }

  for (const mk of lookupKeys) {
    const schemaCatalog = resolveSchemaFallbackFieldCatalog(mk);
    if (schemaCatalog.length) return schemaCatalog;
  }

  return [];
}

const SCHEMA_FIELD_CATALOG_ALIASES = Object.freeze({
  audits: 'events'
});

/** Modules that are navigation/workflow surfaces — no field-level RBAC catalog. */
const SCHEMA_FIELD_CATALOG_SKIP_KEYS = new Set(['schedule']);

function resolveSchemaFieldCatalogModuleKey(moduleKey) {
  const mk = String(moduleKey || '').toLowerCase();
  if (SCHEMA_FIELD_CATALOG_SKIP_KEYS.has(mk)) return null;
  return SCHEMA_FIELD_CATALOG_ALIASES[mk] || mk;
}

let cachedGetBaseFieldsForKey = null;

function resolveSchemaFallbackFieldCatalog(moduleKey) {
  const schemaKey = resolveSchemaFieldCatalogModuleKey(moduleKey);
  if (!schemaKey) return [];
  if (!cachedGetBaseFieldsForKey) {
    ({ getBaseFieldsForKey: cachedGetBaseFieldsForKey } = require('../controllers/moduleController'));
  }
  const fields = cachedGetBaseFieldsForKey(schemaKey);
  return mapFieldCatalogEntries(fields);
}

function attachFieldPermissionAppKey(mod, enabledAppKeys = []) {
  if (mod.scope === 'app' && mod.appKey) {
    mod.fieldPermissionAppKey = String(mod.appKey).toUpperCase();
    return;
  }
  if (mod.scope === 'core') {
    const participating = mod.participatingApps || enabledAppKeys;
    mod.fieldPermissionAppKey = participating.includes('SALES')
      ? 'SALES'
      : (participating[0] || null);
    return;
  }
  mod.fieldPermissionAppKey = null;
}

/**
 * Field catalog for RBAC v2 field permission editor.
 * @param {string|import('mongoose').Types.ObjectId} organizationId
 * @param {string} moduleKey
 * @param {{ appKey?: string|null, scope?: string, participatingApps?: string[] }} [options]
 */
async function loadModuleFieldCatalog(organizationId, moduleKey, options = {}) {
  const lookup = await buildFieldCatalogLookup(organizationId);
  return resolveFieldCatalogForModule(
    {
      moduleKey,
      scope: options.scope || 'core',
      appKey: options.appKey || null,
      participatingApps: options.participatingApps || []
    },
    lookup,
    options.participatingApps || []
  );
}

/**
 * @param {string|import('mongoose').Types.ObjectId} organizationId
 */
async function buildRolePermissionCatalog(organizationId) {
  try {
    const { ensurePlatformDocumentsModuleDefinition } = require('../controllers/settingsController');
    await ensurePlatformDocumentsModuleDefinition();
  } catch (_) { /* non-fatal */ }

  const organization = await Organization.findById(organizationId).lean();
  if (!organization) {
    return { sections: [], modules: [], enabledApps: [] };
  }

  const enabledAppKeys = resolveEnabledAppKeys(organization);
  const moduleOverrides = organization.moduleOverrides || {};
  const sections = [];
  const modules = [];
  const seenKeys = new Set();

  const pushModule = (entry, sectionId) => {
    if (!entry?.key || seenKeys.has(entry.key)) return;
    seenKeys.add(entry.key);
    modules.push({ ...entry, sectionId });
  };

  // --- Platform administration ---
  const platformSection = {
    id: 'platform',
    label: 'Platform Administration',
    description: 'Cross-app access for administration and configuration',
    order: 0
  };
  sections.push(platformSection);
  for (const entry of buildPlatformAdminCatalogEntries()) {
    pushModule(entry, platformSection.id);
  }

  // --- Core modules (platform-owned) ---
  const coreKeysForQuery = [...CORE_MODULE_ORDER];
  const platformModulesRaw = await ModuleDefinition.find({
    appKey: 'platform',
    moduleKey: { $in: coreKeysForQuery }
  }).lean();

  const platformByKey = new Map();
  for (const mod of platformModulesRaw) {
    const key = String(mod.moduleKey || '').toLowerCase();
    if (!key) continue;
    const existing = platformByKey.get(key);
    if (!existing || (mod.label && !existing.label)) {
      platformByKey.set(key, mod);
    }
  }

  const orgOverrides = await ModuleDefinition.find({
    organizationId,
    $or: [{ key: { $in: coreKeysForQuery } }, { moduleKey: { $in: coreKeysForQuery } }]
  })
    .select('key moduleKey name label description')
    .lean();

  const displayNameByKey = {};
  for (const o of orgOverrides) {
    const name = typeof o.name === 'string' ? o.name.trim() : (o.label || '').trim();
    const key = String(o.moduleKey || o.key || '').toLowerCase();
    if (key && name) displayNameByKey[key] = name;
  }

  const coreSection = {
    id: 'core',
    label: 'Core Modules',
    description: 'Shared entities enabled for your organization’s applications',
    order: 10
  };
  sections.push(coreSection);

  coreKeysForQuery.forEach((moduleKey, index) => {
    const participatingApps = getParticipatingAppsForCoreModule(
      moduleKey,
      enabledAppKeys,
      moduleOverrides
    );
    if (!participatingApps.length) {
      return;
    }
    const def = platformByKey.get(moduleKey);
    const label =
      displayNameByKey[moduleKey] ||
      def?.label ||
      def?.name ||
      capitalizeFirst(moduleKey);
    const description =
      def?.description || `${label} — shared across enabled applications`;

    pushModule(
      {
        key: resolveCatalogKey(null, moduleKey),
        moduleKey,
        label,
        description,
        kind: 'crud',
        scope: 'core',
        appKey: null,
        participatingApps,
        order: index,
        hasScope: true,
        supportsViewAll: true,
        actions: buildActionsFromDefinition(def?.permissions, moduleKey, 'crud')
      },
      coreSection.id
    );
  });

  // --- Per-app modules ---
  let appSectionOrder = 20;
  const defPairs = [];
  const uiModulesByApp = new Map();

  for (const appKey of enabledAppKeys) {
    const uiModules = await uiCompositionService.getUIModulesForApp(organizationId, appKey);
    uiModulesByApp.set(appKey, uiModules);
    for (const uiMod of uiModules) {
      const rawKey = String(uiMod.moduleKey || '').toLowerCase();
      if (!rawKey || CORE_ENTITY_KEYS.has(rawKey)) continue;
      defPairs.push({ appKey: appKey.toLowerCase(), moduleKey: rawKey });
    }
  }

  const moduleDefByPair = await loadModuleDefinitionsForPairs(defPairs);

  for (const appKey of enabledAppKeys) {
    const uiModules = uiModulesByApp.get(appKey) || [];
    if (!uiModules.length) continue;

    const appName = await resolveAppDisplayName(appKey);
    const section = {
      id: `app-${appKey.toLowerCase()}`,
      label: appName,
      description: `Modules available in the ${appName} application`,
      appKey,
      order: appSectionOrder
    };
    appSectionOrder += 1;
    sections.push(section);

    const sorted = [...uiModules].sort(
      (a, b) => (a.sidebarOrder ?? 0) - (b.sidebarOrder ?? 0) || String(a.label).localeCompare(String(b.label))
    );

    for (const uiMod of sorted) {
      const rawKey = String(uiMod.moduleKey || '').toLowerCase();
      if (!rawKey || CORE_ENTITY_KEYS.has(rawKey)) continue;

      const moduleKey = normalizeHelpdeskCaseModuleKey(rawKey);
      const catalogKey = resolveCatalogKey(appKey, moduleKey);

      if (seenKeys.has(catalogKey)) continue;

      const def =
        moduleDefByPair.get(`${appKey.toLowerCase()}:${rawKey}`) || null;

      pushModule(
        {
          key: catalogKey,
          moduleKey,
          label: uiMod.label || capitalizeFirst(moduleKey),
          description:
            def?.description ||
            `${uiMod.label || capitalizeFirst(moduleKey)} — ${appName} module`,
          kind: moduleKindForKey(moduleKey),
          scope: 'app',
          appKey,
          order: uiMod.sidebarOrder ?? 999,
          hasScope: !['reports', 'users', 'settings'].includes(moduleKey),
          supportsViewAll: !['reports', 'users', 'settings'].includes(moduleKey),
          actions: buildActionsFromDefinition(def?.permissions, moduleKey, moduleKindForKey(moduleKey))
        },
        section.id
      );
    }
  }

  sections.sort((a, b) => a.order - b.order);
  modules.sort((a, b) => {
    const secA = sections.find((s) => s.id === a.sectionId)?.order ?? 0;
    const secB = sections.find((s) => s.id === b.sectionId)?.order ?? 0;
    if (secA !== secB) return secA - secB;
    return (a.order ?? 999) - (b.order ?? 999);
  });

  const fieldCatalogLookup = await buildFieldCatalogLookup(organizationId);
  for (const mod of modules) {
    if (mod.scope !== 'core' && mod.scope !== 'app') continue;

    const fieldCatalog = resolveFieldCatalogForModule(mod, fieldCatalogLookup, enabledAppKeys);
    mod.fieldCatalog = fieldCatalog;
    mod.supportsFieldPermissions = fieldCatalog.length > 0;
    if (!mod.supportsFieldPermissions) continue;

    attachFieldPermissionAppKey(mod, enabledAppKeys);
  }

  return {
    sections,
    modules,
    enabledApps: enabledAppKeys.map((appKey) => ({
      appKey,
      appName: APP_DISPLAY_NAMES[appKey.toLowerCase()] || appKey
    }))
  };
}

/**
 * Cached tenant catalog (short TTL — safe for role editor hot path).
 * @param {string|import('mongoose').Types.ObjectId} organizationId
 */
async function getRolePermissionCatalog(organizationId) {
  const cacheKey = String(organizationId);
  const cached = catalogCache.get(cacheKey);
  if (cached && Date.now() - cached.at < CATALOG_TTL_MS) {
    return cached.data;
  }

  const data = await buildRolePermissionCatalog(organizationId);
  catalogCache.set(cacheKey, { at: Date.now(), data });
  return data;
}

function invalidateRolePermissionCatalogCache(organizationId) {
  catalogCache.delete(String(organizationId));
}

/** Invalidate catalog + runtime org-context caches after tenant settings change. */
function invalidateTenantPermissionCaches(organizationId) {
  invalidateRolePermissionCatalogCache(organizationId);
  try {
    const { invalidateOrgPermissionContextCache } = require('./runtimePermissionResolver');
    invalidateOrgPermissionContextCache(organizationId);
  } catch (_e) {
    /* runtime resolver optional during partial deploy */
  }
}

/**
 * Expand stored role permissions into UI form keys (includes app-scoped keys).
 * @param {object} rolePlain
 */
function expandRolePermissionsForUI(rolePlain) {
  const out = {};
  const legacy = rolePlain?.permissions || {};

  for (const [mod, perms] of Object.entries(legacy)) {
    if (!perms || typeof perms !== 'object') continue;
    const uiKey = mod === 'contacts' ? 'people' : mod;
    out[uiKey] = { ...perms };
    if (mod === 'contacts') {
      out.people = { ...perms };
    }
  }

  const appPerms = rolePlain?.appPermissions;
  if (appPerms && typeof appPerms === 'object') {
    const entries =
      typeof appPerms.entries === 'function'
        ? [...appPerms.entries()]
        : Object.entries(appPerms);

    for (const [appKey, modules] of entries) {
      if (!modules || typeof modules !== 'object') continue;
      const upper = String(appKey).toUpperCase();
      for (const [mod, perms] of Object.entries(modules)) {
        if (!perms || typeof perms !== 'object') continue;
        const uiKey = resolveCatalogKey(upper, mod);
        if (!out[uiKey]) {
          out[uiKey] = { ...perms };
        }
      }
    }
  }

  return out;
}

module.exports = {
  getRolePermissionCatalog,
  buildRolePermissionCatalog,
  expandRolePermissionsForUI,
  normalizeRolePermissions,
  mergeIncomingRolePermissions,
  invalidateRolePermissionCatalogCache,
  invalidateTenantPermissionCaches,
  resolveCatalogKey,
  resolveEnabledAppKeys,
  buildActionsFromDefinition,
  normalizeHelpdeskCaseModuleKey,
  normalizeModulePerms,
  loadModuleFieldCatalog,
  buildFieldCatalogLookup,
  resolveFieldCatalogForModule,
  mapFieldCatalogEntries,
  CORE_MODULE_ORDER,
  CORE_ENTITY_KEYS,
  LEGACY_FLAT_STORAGE_KEYS,
  PLATFORM_ADMIN_KEYS,
  getParticipatingAppsForCoreModule
};
