/**
 * ============================================================================
 * Tenant Metadata Utilities
 * ============================================================================
 * 
 * Helper functions for reading tenant-level app and module configurations.
 * All functions combine platform metadata with tenant overrides.
 * 
 * Rules:
 * - Platform definitions + tenant overrides = effective behavior
 * - Tenant cannot reference unknown platform definitions
 * - Disabled modules hide relationships automatically
 * - All queries are scoped by organizationId
 * 
 * See PLATFORM_ARCHITECTURE.md for details.
 * ============================================================================
 */

const TenantAppConfiguration = require('../models/TenantAppConfiguration');
const TenantModuleConfiguration = require('../models/TenantModuleConfiguration');
const ModuleDefinition = require('../models/ModuleDefinition');
const TenantRelationshipConfiguration = require('../models/TenantRelationshipConfiguration');
const AppDefinition = require('../models/AppDefinition');
const RelationshipDefinition = require('../models/RelationshipDefinition');
const {
  isRetiredOrganizationType,
  stripRetiredOrganizationTypesFromModuleFields,
} = require('../constants/organizationTypeDefaults');
const {
  mergeOrganizationStatusPicklistsWithDefaults,
  getDefaultOrganizationStatusFieldOptions,
} = require('../constants/organizationStatusDefaults');

/**
 * Get enabled apps for a tenant
 * @param {string|ObjectId} organizationId - The organization ID
 * @returns {Promise<Array>} - Array of enabled app configurations
 */
async function getEnabledAppsForTenant(organizationId) {
  try {
    const tenantAppConfigs = await TenantAppConfiguration.find({
      organizationId,
      enabled: true
    }).sort({ appKey: 1 });

    // Validate against platform definitions
    const enabledApps = [];
    for (const config of tenantAppConfigs) {
      const platformApp = await AppDefinition.findOne({ 
        appKey: config.appKey.toLowerCase() 
      });
      
      if (platformApp && platformApp.enabled) {
        enabledApps.push({
          appKey: config.appKey,
          enabled: config.enabled,
          settings: config.settings || {},
          platform: {
            name: platformApp.name,
            description: platformApp.description,
            icon: platformApp.icon,
            capabilities: platformApp.capabilities
          }
        });
      }
    }

    return enabledApps;
  } catch (error) {
    console.error(`[tenantMetadata] Error getting enabled apps for tenant ${organizationId}:`, error);
    return [];
  }
}

/**
 * Get enabled modules for an app within a tenant
 * @param {string|ObjectId} organizationId - The organization ID
 * @param {string} appKey - The app key (e.g., 'CRM', 'AUDIT', 'PORTAL')
 * @returns {Promise<Array>} - Array of enabled module configurations
 */
async function getEnabledModulesForApp(organizationId, appKey) {
  try {
    const tenantModuleConfigs = await TenantModuleConfiguration.find({
      organizationId,
      appKey: appKey.toUpperCase(),
      enabled: true
    }).sort({ 'ui.order': 1, moduleKey: 1 });

    // Validate against platform definitions
    const enabledModules = [];
    for (const config of tenantModuleConfigs) {
      const platformModule = await ModuleDefinition.findOne({
        appKey: appKey.toLowerCase(),
        moduleKey: config.moduleKey
      });

      if (platformModule) {
        enabledModules.push({
          moduleKey: config.moduleKey,
          appKey: config.appKey,
          enabled: config.enabled,
          labelOverride: config.labelOverride || platformModule.label,
          pluralLabel: platformModule.pluralLabel,
          peopleMode: config.peopleMode || null,
          requiredRelationships: config.requiredRelationships || [],
          ui: {
            showInSidebar: config.ui?.showInSidebar !== false,
            order: config.ui?.order || null
          },
          platform: {
            entityType: platformModule.entityType,
            primaryField: platformModule.primaryField,
            peopleConstraints: platformModule.peopleConstraints,
            organizationConstraints: platformModule.organizationConstraints,
            lifecycle: platformModule.lifecycle,
            supports: platformModule.supports,
            permissions: platformModule.permissions
          }
        });
      }
    }

    return enabledModules;
  } catch (error) {
    console.error(`[tenantMetadata] Error getting enabled modules for tenant ${organizationId}, app ${appKey}:`, error);
    return [];
  }
}

/**
 * Get tenant module configuration (with platform defaults)
 * @param {string|ObjectId} organizationId - The organization ID
 * @param {string} appKey - The app key
 * @param {string} moduleKey - The module key
 * @returns {Promise<Object|null>} - Module configuration or null if not found/disabled
 */
async function getTenantModuleConfig(organizationId, appKey, moduleKey) {
  try {
    // Get tenant configuration
    const tenantConfig = await TenantModuleConfiguration.findOne({
      organizationId,
      appKey: appKey.toUpperCase(),
      moduleKey: moduleKey.toLowerCase()
    });

    // Get platform definition (platform = no tenant: organizationId null or missing)
    const normApp = appKey.toLowerCase();
    const normMod = moduleKey.toLowerCase();
    let platformModule = await ModuleDefinition.findOne({
      appKey: normApp,
      moduleKey: normMod,
      $or: [
        { organizationId: null },
        { organizationId: { $exists: false } }
      ]
    });
    if (!platformModule) {
      const all = await ModuleDefinition.find({ appKey: normApp, moduleKey: normMod }).lean();
      platformModule = all.find((m) => m.organizationId == null || m.organizationId === undefined) || null;
    }

    if (!platformModule) {
      return null; // Module doesn't exist in platform
    }

    // If tenant config exists and is disabled, return null
    if (tenantConfig && !tenantConfig.enabled) {
      return null;
    }

    // Merge platform defaults with tenant overrides
    return {
      moduleKey: moduleKey.toLowerCase(),
      appKey: appKey.toUpperCase(),
      enabled: tenantConfig?.enabled !== false,
      label: tenantConfig?.labelOverride || platformModule.label,
      pluralLabel: platformModule.pluralLabel,
      peopleMode: tenantConfig?.peopleMode || null,
      requiredRelationships: tenantConfig?.requiredRelationships || [],
      ui: {
        showInSidebar: tenantConfig?.ui?.showInSidebar !== false,
        order: tenantConfig?.ui?.order || null
      },
      platform: {
        entityType: platformModule.entityType,
        primaryField: platformModule.primaryField,
        peopleConstraints: platformModule.peopleConstraints,
        organizationConstraints: platformModule.organizationConstraints,
        lifecycle: platformModule.lifecycle,
        supports: platformModule.supports,
        permissions: platformModule.permissions
      }
    };
  } catch (error) {
    console.error(`[tenantMetadata] Error getting module config for tenant ${organizationId}, ${appKey}.${moduleKey}:`, error);
    return null;
  }
}

/**
 * Get effective relationships for a module within a tenant/app context
 * @param {string|ObjectId} organizationId - The organization ID
 * @param {string} appKey - The app key
 * @param {string} moduleKey - The module key
 * @returns {Promise<Array>} - Array of effective relationship configurations
 */
async function getEffectiveRelationships(organizationId, appKey, moduleKey) {
  try {
    // Get all platform relationships for this module
    const platformRelationships = await RelationshipDefinition.find({
      $or: [
        { 'source.appKey': appKey.toLowerCase(), 'source.moduleKey': moduleKey.toLowerCase() },
        { 'target.appKey': appKey.toLowerCase(), 'target.moduleKey': moduleKey.toLowerCase() }
      ],
      enabled: true
    });

    // Get tenant relationship overrides
    const tenantRelationshipConfigs = await TenantRelationshipConfiguration.find({
      organizationId,
      relationshipKey: { $in: platformRelationships.map(r => r.relationshipKey) }
    });

    const relationshipConfigMap = new Map(
      tenantRelationshipConfigs.map(config => [config.relationshipKey, config])
    );

    // Build effective relationships
    const effectiveRelationships = [];
    for (const platformRel of platformRelationships) {
      const tenantConfig = relationshipConfigMap.get(platformRel.relationshipKey);

      // Skip only if tenant explicitly disabled this relationship
      if (tenantConfig && tenantConfig.enabled === false) {
        continue;
      }

      // Include relationship whenever not explicitly disabled (do not skip when module config missing)

      // Merge platform defaults with tenant overrides
      effectiveRelationships.push({
        relationshipKey: platformRel.relationshipKey,
        source: {
          appKey: platformRel.source.appKey.toUpperCase(),
          moduleKey: platformRel.source.moduleKey,
          ...(tenantConfig?.uiOverride?.source || {}),
          ...(tenantConfig?.uiOverride?.source?.showAs === undefined ? { showAs: platformRel.ui.source.showAs } : {}),
          ...(tenantConfig?.uiOverride?.source?.label === undefined ? { label: platformRel.ui.source.label } : {})
        },
        target: {
          appKey: platformRel.target.appKey.toUpperCase(),
          moduleKey: platformRel.target.moduleKey,
          ...(tenantConfig?.uiOverride?.target || {}),
          ...(tenantConfig?.uiOverride?.target?.showAs === undefined ? { showAs: platformRel.ui.target.showAs } : {}),
          ...(tenantConfig?.uiOverride?.target?.label === undefined ? { label: platformRel.ui.target.label } : {})
        },
        cardinality: platformRel.cardinality,
        relationshipType: platformRel.relationshipType || platformRel.cardinality,
        ownership: platformRel.ownership,
        required:
          tenantConfig && tenantConfig.requiredOverride !== null && tenantConfig.requiredOverride !== undefined
            ? tenantConfig.requiredOverride
            : platformRel.required,
        localField: platformRel.localField || null,
        foreignField: platformRel.foreignField || null,
        userLinkable: platformRel.userLinkable !== undefined ? platformRel.userLinkable : true,
        display: platformRel.display || null,
        constraints: platformRel.constraints || null,
        isDefault: !!platformRel.isDefault,
        isAdvanced: !!platformRel.isAdvanced,
        activateWhenModuleExists: !!platformRel.activateWhenModuleExists,
        status: platformRel.status || 'ACTIVE',
        cascade: platformRel.cascade,
        ui: {
          source: {
            showAs: tenantConfig?.uiOverride?.source?.showAs || platformRel.ui.source.showAs,
            label: tenantConfig?.uiOverride?.source?.label || platformRel.ui.source.label
          },
          target: {
            showAs: tenantConfig?.uiOverride?.target?.showAs || platformRel.ui.target.showAs,
            label: tenantConfig?.uiOverride?.target?.label || platformRel.ui.target.label
          },
          picker: platformRel.ui.picker
        },
        automation: platformRel.automation,
        enabled: true
      });
    }

    return effectiveRelationships;
  } catch (error) {
    console.error(`[tenantMetadata] Error getting effective relationships for tenant ${organizationId}, ${appKey}.${moduleKey}:`, error);
    return [];
  }
}

/**
 * Check if an app is enabled for a tenant
 * @param {string|ObjectId} organizationId - The organization ID
 * @param {string} appKey - The app key
 * @returns {Promise<boolean>} - True if app is enabled
 */
async function isAppEnabledForTenant(organizationId, appKey) {
  try {
    const config = await TenantAppConfiguration.findOne({
      organizationId,
      appKey: appKey.toUpperCase(),
      enabled: true
    });

    if (!config) {
      return false;
    }

    // Validate against platform definition
    const platformApp = await AppDefinition.findOne({
      appKey: appKey.toLowerCase(),
      enabled: true
    });

    return !!platformApp;
  } catch (error) {
    console.error(`[tenantMetadata] Error checking if app ${appKey} is enabled for tenant ${organizationId}:`, error);
    return false;
  }
}

/**
 * Check if a module is enabled for a tenant/app
 * @param {string|ObjectId} organizationId - The organization ID
 * @param {string} appKey - The app key
 * @param {string} moduleKey - The module key
 * @returns {Promise<boolean>} - True if module is enabled
 */
async function isModuleEnabledForTenant(organizationId, appKey, moduleKey) {
  try {
    const config = await getTenantModuleConfig(organizationId, appKey, moduleKey);
    return !!config && config.enabled;
  } catch (error) {
    console.error(`[tenantMetadata] Error checking if module ${appKey}.${moduleKey} is enabled for tenant ${organizationId}:`, error);
    return false;
  }
}

/** Defaults when tenant has no peopleTypes for that app key */
const DEFAULT_PEOPLE_TYPES = {
  SALES: ['Lead', 'Contact'],
  HELPDESK: ['Customer', 'Agent'],
  MARKETING: ['Customer', 'Subscriber']
};

const PEOPLE_TYPE_COLOR_ROTATION = [
  'indigo',
  'blue',
  'emerald',
  'amber',
  'violet',
  'rose',
  'cyan',
  'orange',
  'teal',
  'pink',
  'green',
  'purple'
];
const PEOPLE_TYPE_COLOR_SET = new Set([
  ...PEOPLE_TYPE_COLOR_ROTATION,
  'slate',
  'red',
  'yellow',
  'gray'
]);

function normalizeHexPeopleTypeColor(input) {
  const s = String(input || '').trim();
  const m = /^#?([0-9A-Fa-f]{6})$/.exec(s);
  if (!m) return null;
  return `#${m[1].toLowerCase()}`;
}

/** Semantic keys → hex (align with client picklist / BadgeCell). */
const PEOPLE_TYPE_SEMANTIC_HEX = {
  indigo: '#6366f1',
  blue: '#3b82f6',
  emerald: '#10b981',
  amber: '#f59e0b',
  violet: '#8b5cf6',
  rose: '#f43f5e',
  cyan: '#06b6d4',
  orange: '#ea580c',
  teal: '#14b8a6',
  pink: '#ec4899',
  green: '#22c55e',
  purple: '#a855f7',
  slate: '#64748b',
  red: '#ef4444',
  yellow: '#eab308',
  gray: '#6b7280'
};

function peopleParticipationStoredColorToHex(color) {
  const hex = normalizeHexPeopleTypeColor(color);
  if (hex) return hex;
  const k = String(color || '')
    .toLowerCase()
    .trim();
  return PEOPLE_TYPE_SEMANTIC_HEX[k] || '#64748b';
}

/**
 * Picklist-shaped options for People `type` field (must match Types tab + forms).
 * @param {Array<{ value: string, color?: string }>} typeDefs
 * @returns {Array<{ value: string, label: string, color: string }>}
 */
function typeDefsToPeopleTypePicklistOptions(typeDefs) {
  if (!Array.isArray(typeDefs) || typeDefs.length === 0) {
    return [
      { value: 'Lead', label: 'Lead', color: '#f59e0b' },
      { value: 'Contact', label: 'Contact', color: '#22c55e' }
    ];
  }
  return typeDefs.map((d) => ({
    value: d.value,
    label: d.value,
    color: peopleParticipationStoredColorToHex(d.color)
  }));
}

function normalizePeopleTypeStoredColor(input, fallbackIndex) {
  const hex = normalizeHexPeopleTypeColor(input);
  if (hex) return hex;
  const k = String(input || '')
    .toLowerCase()
    .trim();
  if (PEOPLE_TYPE_COLOR_SET.has(k)) return k;
  const i = Number.isFinite(fallbackIndex) ? fallbackIndex : 0;
  return PEOPLE_TYPE_COLOR_ROTATION[i % PEOPLE_TYPE_COLOR_ROTATION.length];
}

function typeDefsFromStringArray(strings) {
  return strings.map((value, i) => ({
    value,
    color: normalizePeopleTypeStoredColor(undefined, i)
  }));
}

/** Virtual role / type picker keys — not shown as "participation detail" field picks */
const PARTICIPATION_TYPE_VIRTUAL_KEYS = new Set(['sales_type', 'helpdesk_role', 'type']);

/**
 * Fallback participation field keys when platform/tenant module definitions are empty (aligned with client peopleFieldModel).
 */
const PARTICIPATION_FIELD_FALLBACK_BY_APP = {
  SALES: [
    'lead_status',
    'contact_status',
    'lead_owner',
    'lead_score',
    'interest_products',
    'qualification_date',
    'qualification_notes',
    'estimated_value',
    'role',
    'birthday',
    'preferred_contact_method'
  ],
  HELPDESK: []
};

/**
 * Union of module field keys scoped to an app (People module), excluding virtual type pickers.
 * @param {string|import('mongoose').Types.ObjectId} organizationId
 * @param {string} appKeyUpper - e.g. SALES
 * @returns {Promise<Set<string>>}
 */
async function collectAllowedPeopleParticipationFieldKeys(organizationId, appKeyUpper) {
  const upper = String(appKeyUpper || '').toUpperCase();
  const allowed = new Set();
  const appLower = upper.toLowerCase();

  try {
    const platformMod = await ModuleDefinition.findOne({
      appKey: appLower,
      moduleKey: 'people'
    })
      .select('fields')
      .lean();

    const addFields = (fields) => {
      if (!Array.isArray(fields)) return;
      for (const f of fields) {
        const key = String(f?.key ?? '').trim();
        if (!key) continue;
        const fk =
          f.appKey != null && String(f.appKey).trim() !== '' ? String(f.appKey).toUpperCase() : '';
        if (fk !== upper) continue;
        if (PARTICIPATION_TYPE_VIRTUAL_KEYS.has(key.toLowerCase())) continue;
        allowed.add(key);
      }
    };

    addFields(platformMod?.fields);

    const tenantRows = await TenantModuleConfiguration.find({
      organizationId,
      moduleKey: 'people'
    })
      .select('fields')
      .lean();

    for (const row of tenantRows) {
      addFields(row.fields);
    }
  } catch (error) {
    console.error('[tenantMetadata] collectAllowedPeopleParticipationFieldKeys:', error);
  }

  const fallback = PARTICIPATION_FIELD_FALLBACK_BY_APP[upper];
  if (Array.isArray(fallback)) {
    for (const k of fallback) {
      allowed.add(k);
    }
  }

  return allowed;
}

function typeDefsFromStoredTypesArray(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const first = arr[0];
  const isObjectShape =
    first != null &&
    typeof first === 'object' &&
    !Array.isArray(first) &&
    (first.value != null || first.label != null);

  if (isObjectShape) {
    const out = [];
    for (let i = 0; i < arr.length; i++) {
      const item = arr[i];
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      const value = String(item.value ?? item.label ?? '').trim();
      if (!value) continue;
      const row = {
        value,
        color: normalizePeopleTypeStoredColor(item.color, out.length)
      };
      if (Array.isArray(item.fields)) {
        if (item.fields.length === 0) {
          row.fields = [];
        } else {
          const fields = [];
          const seenF = new Set();
          for (const x of item.fields) {
            const fk = String(x ?? '').trim();
            if (!fk) continue;
            const low = fk.toLowerCase();
            if (seenF.has(low)) continue;
            seenF.add(low);
            fields.push(fk);
          }
          row.fields = fields;
        }
      }
      out.push(row);
    }
    return out.length ? out : null;
  }

  const strings = arr.map((t) => String(t).trim()).filter(Boolean);
  if (strings.length === 0) return null;
  return typeDefsFromStringArray(strings);
}

/**
 * Validate and normalize people type rows from API PUT body.
 * Accepts string[] or { value, color, fields?: string[] }[] (mixed allowed).
 * @param {unknown} typesIn
 * @param {{ allowedFieldKeys?: Set<string> }} [options] - when provided and non-empty, `fields` entries must match (case-insensitive).
 * @returns {{ ok: true, typeDefs: Array<{value: string, color: string, fields?: string[]}> } | { ok: false, message: string }}
 */
function sanitizePeopleTypeDefsForSave(typesIn, options = {}) {
  if (!Array.isArray(typesIn)) {
    return { ok: false, message: 'types must be an array' };
  }
  const allowedFieldKeys = options.allowedFieldKeys;
  const validateFields = allowedFieldKeys instanceof Set && allowedFieldKeys.size > 0;

  const normalizedDefs = [];
  const seen = new Set();
  for (let i = 0; i < typesIn.length; i++) {
    const item = typesIn[i];
    let value;
    let color;
    /** @type {string[] | undefined} */
    let fieldsArr;
    if (typeof item === 'string') {
      value = item.trim();
      color = normalizePeopleTypeStoredColor(undefined, normalizedDefs.length);
    } else if (item && typeof item === 'object' && !Array.isArray(item)) {
      value = String(item.value ?? '').trim();
      color = normalizePeopleTypeStoredColor(item.color, normalizedDefs.length);
      if (Array.isArray(item.fields)) {
        if (item.fields.length > 0 && !validateFields) {
          return {
            ok: false,
            message:
              'Per-type fields are not available until participation fields exist for this app in Modules & Fields.'
          };
        }
        fieldsArr = [];
        const seenF = new Set();
        for (let j = 0; j < item.fields.length; j++) {
          const raw = item.fields[j];
          const fk = String(raw ?? '').trim();
          if (!fk) continue;
          const flo = fk.toLowerCase();
          if (seenF.has(flo)) continue;
          seenF.add(flo);
          if (validateFields) {
            let canon = null;
            for (const ak of allowedFieldKeys) {
              if (String(ak).toLowerCase() === flo) {
                canon = ak;
                break;
              }
            }
            if (!canon) {
              return {
                ok: false,
                message: `Invalid field "${fk}" for role "${value}"`
              };
            }
            fieldsArr.push(canon);
          } else {
            fieldsArr.push(fk);
          }
        }
      }
    } else {
      return { ok: false, message: 'Each entry must be a string or an object with value' };
    }
    if (!value) {
      return { ok: false, message: 'Role names cannot be empty' };
    }
    const low = value.toLowerCase();
    if (seen.has(low)) {
      return { ok: false, message: 'Duplicate role names are not allowed' };
    }
    seen.add(low);
    const row = { value, color };
    if (fieldsArr !== undefined) {
      row.fields = fieldsArr;
    }
    normalizedDefs.push(row);
  }
  if (normalizedDefs.length < 1) {
    return { ok: false, message: 'At least one role is required' };
  }
  return { ok: true, typeDefs: normalizedDefs };
}

function defaultPeopleTypeDefsForApp(upperKey) {
  const fb = DEFAULT_PEOPLE_TYPES[upperKey] || DEFAULT_PEOPLE_TYPES.SALES;
  return typeDefsFromStringArray([...fb]);
}

/**
 * Normalize one app's peopleTypes value from tenant config.
 * Legacy: string[] — implicit default = first item; colors rotate by index.
 * Stored: { types: (string | { value, color })[], default: string }
 *
 * @param {unknown} raw
 * @param {string} upperKey - e.g. 'SALES'
 * @returns {{ types: string[], defaultRole: string, typeDefs: Array<{value: string, color: string}> } | null}
 */
function normalizePeopleTypesAppEntry(raw, _upperKey) {
  if (raw == null) return null;

  if (Array.isArray(raw)) {
    if (raw.length === 0) return null;
    const strings = raw.map((t) => String(t).trim()).filter(Boolean);
    if (strings.length === 0) return null;
    const typeDefs = typeDefsFromStringArray(strings);
    const types = typeDefs.map((d) => d.value);
    return { types, defaultRole: types[0], typeDefs };
  }

  if (typeof raw === 'object' && Array.isArray(raw.types)) {
    const typeDefs = typeDefsFromStoredTypesArray(raw.types);
    if (!typeDefs || typeDefs.length === 0) return null;
    const types = typeDefs.map((d) => d.value);
    let def =
      raw.default != null && String(raw.default).trim()
        ? String(raw.default).trim()
        : raw.defaultRole != null && String(raw.defaultRole).trim()
          ? String(raw.defaultRole).trim()
          : '';
    if (!def) def = types[0];
    const match = types.find((t) => t.toLowerCase() === def.toLowerCase());
    const defaultRole = match || types[0];
    return { types, defaultRole, typeDefs };
  }

  return null;
}

function pickPeopleTypesEntry(peopleTypesMap, upper) {
  if (!peopleTypesMap || typeof peopleTypesMap !== 'object') return null;
  const raw = peopleTypesMap[upper];
  return normalizePeopleTypesAppEntry(raw, upper);
}

/**
 * Resolved types + explicit default for an app (tenant config + fallbacks).
 * @param {string|ObjectId} organizationId
 * @param {string} appKey
 * @returns {Promise<{ types: string[], defaultRole: string, typeDefs: Array<{value: string, color: string}> }>}
 */
async function getPeopleTypesConfig(organizationId, appKey) {
  const upper = (appKey || 'SALES').toUpperCase();

  try {
    let tenantConfig = await TenantModuleConfiguration.findOne({
      organizationId,
      appKey: upper,
      moduleKey: 'people'
    }).lean();

    let entry = pickPeopleTypesEntry(tenantConfig?.settings?.peopleTypes, upper);
    if (entry) return entry;

    const salesRow = await TenantModuleConfiguration.findOne({
      organizationId,
      appKey: 'SALES',
      moduleKey: 'people'
    }).lean();
    entry = pickPeopleTypesEntry(salesRow?.settings?.peopleTypes, upper);
    if (entry) return entry;

    const crmRow = await TenantModuleConfiguration.findOne({
      organizationId,
      appKey: 'CRM',
      moduleKey: 'people'
    }).lean();
    entry = pickPeopleTypesEntry(crmRow?.settings?.peopleTypes, upper);
    if (entry) return entry;

    const anyRow = await TenantModuleConfiguration.findOne({
      organizationId,
      moduleKey: 'people',
      'settings.peopleTypes': { $exists: true, $ne: null }
    }).lean();
    entry = pickPeopleTypesEntry(anyRow?.settings?.peopleTypes, upper);
    if (entry) return entry;

    const typeDefs = defaultPeopleTypeDefsForApp(upper);
    const types = typeDefs.map((d) => d.value);
    return { types, defaultRole: types[0] || 'Lead', typeDefs };
  } catch (error) {
    console.error(`[tenantMetadata] Error getting people types config for ${organizationId}, ${appKey}:`, error);
    const typeDefs = defaultPeopleTypeDefsForApp(upper);
    const types = typeDefs.map((d) => d.value);
    return { types, defaultRole: types[0] || 'Lead', typeDefs };
  }
}

/**
 * Get people types for an app from TenantModuleConfiguration.settings.peopleTypes
 * The map is usually stored on the primary sales/CRM people module row; we fall back across common appKeys.
 * @param {string|ObjectId} organizationId
 * @param {string} appKey - e.g. 'SALES', 'HELPDESK'
 * @returns {Promise<string[]>} - Array of type strings
 */
async function getPeopleTypes(organizationId, appKey) {
  const { types } = await getPeopleTypesConfig(organizationId, appKey);
  return types;
}

/**
 * Validate and normalize a people type value against tenant config.
 * @param {string|ObjectId} organizationId
 * @param {string} appKey - e.g. 'SALES'
 * @param {string} typeValue - Incoming type (e.g. 'LEAD', 'Lead', 'Contact')
 * @returns {Promise<{valid: boolean, canonicalValue?: string, allowedTypes: string[], message?: string}>}
 */
async function validatePeopleType(organizationId, appKey, typeValue) {
  const allowedTypes = await getPeopleTypes(organizationId, appKey);
  if (!typeValue || typeof typeValue !== 'string') {
    return { valid: false, allowedTypes, message: 'Type is required' };
  }
  const trimmed = typeValue.trim();
  if (!trimmed) {
    return { valid: false, allowedTypes, message: 'Type is required' };
  }
  // Normalize legacy keys: LEAD -> Lead, CONTACT -> Contact
  let canonical = trimmed;
  if (trimmed.toUpperCase() === 'LEAD') canonical = 'Lead';
  else if (trimmed.toUpperCase() === 'CONTACT') canonical = 'Contact';
  else {
    // Match against allowed types (case-insensitive)
    const match = allowedTypes.find(t => t.toLowerCase() === trimmed.toLowerCase());
    canonical = match || trimmed;
  }
  const isValid = allowedTypes.some(t => t === canonical);
  if (!isValid) {
    return {
      valid: false,
      allowedTypes,
      message: `Type "${typeValue}" is not allowed. Allowed types: ${allowedTypes.join(', ')}`
    };
  }
  return { valid: true, canonicalValue: canonical, allowedTypes };
}

const {
  ORGANIZATION_ALWAYS_VISIBLE_FIELD_KEYS,
  normalizeFieldKey: normalizeOrgFieldKey,
  getOrganizationTypeScopedFieldPool
} = require('../constants/organizationTypeDefaults');

const ORGANIZATION_SYSTEM_EXCLUDED_KEYS = new Set([
  'organizationid',
  '_id',
  '__v',
  'createdat',
  'updatedat',
  'createdby',
  'modifiedby',
  'derivedstatus',
  'deletedat',
  'deletedby',
  'deletionreason',
  'legacyorganizationid',
  'istenant',
  'slug',
  'enabledapps',
  'enabledmodules'
]);

/**
 * Field keys tenants may assign per organization type in Status & Types settings.
 */
async function collectAllowedOrganizationTypeScopedFieldKeys(organizationId) {
  const allowed = new Set(getOrganizationTypeScopedFieldPool());

  try {
    const platformMod = await ModuleDefinition.findOne({
      moduleKey: 'organizations'
    })
      .select('fields')
      .lean();

    const addFields = (fields) => {
      if (!Array.isArray(fields)) return;
      for (const f of fields) {
        const key = String(f?.key ?? '').trim();
        if (!key) continue;
        const nk = normalizeOrgFieldKey(key);
        if (ORGANIZATION_ALWAYS_VISIBLE_FIELD_KEYS.has(nk)) continue;
        if (ORGANIZATION_SYSTEM_EXCLUDED_KEYS.has(nk)) continue;
        if (nk.startsWith('subscription') || nk.startsWith('limits') || nk.startsWith('settings')) continue;
        allowed.add(key);
      }
    };

    addFields(platformMod?.fields);

    const tenantRows = await TenantModuleConfiguration.find({
      organizationId,
      moduleKey: 'organizations'
    })
      .select('fields')
      .lean();

    for (const row of tenantRows) {
      addFields(row.fields);
    }
  } catch (error) {
    console.error('[tenantMetadata] collectAllowedOrganizationTypeScopedFieldKeys:', error);
  }

  return allowed;
}

/**
 * Validate organization type rows from status-types PATCH (fields per type).
 * @param {unknown} typesIn
 * @param {{ allowedFieldKeys?: Set<string> }} [options]
 */
function sanitizeOrganizationTypeDefsForSave(typesIn, options = {}) {
  if (!Array.isArray(typesIn)) {
    return { ok: false, message: 'organizationTypes must be an array' };
  }
  const allowedFieldKeys = options.allowedFieldKeys;
  const validateFields = allowedFieldKeys instanceof Set && allowedFieldKeys.size > 0;

  const normalizedDefs = [];
  const seen = new Set();

  for (let i = 0; i < typesIn.length; i++) {
    const item = typesIn[i];
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return { ok: false, message: 'Each organization type must be an object with value' };
    }

    const value = String(item.value ?? item.label ?? '').trim();
    if (!value) {
      return { ok: false, message: 'Organization type names cannot be empty' };
    }
    if (isRetiredOrganizationType(value)) {
      continue;
    }
    const low = value.toLowerCase();
    if (seen.has(low)) {
      return { ok: false, message: 'Duplicate organization type names are not allowed' };
    }
    seen.add(low);

    const row = {
      value,
      label: String(item.label ?? value).trim() || value,
      enabled: item.enabled !== undefined ? Boolean(item.enabled) : true
    };

    if (Array.isArray(item.fields)) {
      if (item.fields.length > 0 && !validateFields) {
        return {
          ok: false,
          message:
            'Per-type fields are not available until organization fields exist in Modules & Fields.'
        };
      }
      const fieldsArr = [];
      const seenF = new Set();
      for (let j = 0; j < item.fields.length; j++) {
        const raw = item.fields[j];
        const fk = String(raw ?? '').trim();
        if (!fk) continue;
        const flo = fk.toLowerCase();
        if (seenF.has(flo)) continue;
        seenF.add(flo);
        if (validateFields) {
          let canon = null;
          for (const ak of allowedFieldKeys) {
            if (String(ak).toLowerCase() === flo) {
              canon = ak;
              break;
            }
          }
          if (!canon) {
            return { ok: false, message: `Invalid field "${fk}" for organization type "${value}"` };
          }
          fieldsArr.push(canon);
        } else {
          fieldsArr.push(fk);
        }
      }
      row.fields = fieldsArr;
    }

    normalizedDefs.push(row);
  }

  if (normalizedDefs.length < 1) {
    return { ok: false, message: 'At least one organization type is required' };
  }

  return { ok: true, typeDefs: normalizedDefs };
}

function normalizeOrganizationTypesFromConfig(rawTypes) {
  if (!Array.isArray(rawTypes) || rawTypes.length === 0) return [];
  const out = [];
  for (let i = 0; i < rawTypes.length; i++) {
    const item = rawTypes[i];
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const value = String(item.value ?? item.label ?? '').trim();
    if (!value) continue;
    if (isRetiredOrganizationType(value)) continue;
    const row = {
      value,
      label: String(item.label ?? value).trim() || value,
      enabled: item.enabled !== undefined ? Boolean(item.enabled) : true
    };
    if (Array.isArray(item.fields)) {
      row.fields = item.fields.map((x) => String(x ?? '').trim()).filter(Boolean);
    }
    out.push(row);
  }
  return out;
}

async function findOrganizationsTenantConfig(organizationId) {
  const appPriority = ['SALES', 'HELPDESK', 'AUDIT', 'PORTAL', 'LMS'];
  for (const appKey of appPriority) {
    const row = await TenantModuleConfiguration.findOne({
      organizationId,
      appKey,
      moduleKey: 'organizations'
    }).lean();
    if (row) return row;
  }
  return TenantModuleConfiguration.findOne({
    organizationId,
    moduleKey: 'organizations'
  }).lean();
}

async function maybeCleanupRetiredOrganizationTypesForTenant(organizationId) {
  if (!organizationId) return false;
  let changed = false;

  const tenantConfig = await findOrganizationsTenantConfig(organizationId);
  if (tenantConfig?._id && Array.isArray(tenantConfig.settings?.statusTypes?.organizationTypes)) {
    const raw = tenantConfig.settings.statusTypes.organizationTypes;
    const filtered = raw.filter(
      (item) => !isRetiredOrganizationType(item?.value ?? item?.label)
    );
    if (filtered.length !== raw.length) {
      await TenantModuleConfiguration.updateOne(
        { _id: tenantConfig._id },
        {
          $set: {
            'settings.statusTypes.organizationTypes': normalizeOrganizationTypesFromConfig(filtered),
          },
        }
      );
      changed = true;
    }
  }

  const mod = await ModuleDefinition.findOne({
    organizationId,
    key: 'organizations',
  }).select('+fields');
  if (mod?.fields) {
    const { fields: nextFields, removed } = stripRetiredOrganizationTypesFromModuleFields(mod.fields);
    if (removed) {
      mod.fields = nextFields;
      mod.markModified('fields');
      await mod.save();
      changed = true;
    }
  }

  return changed;
}

/**
 * Resolved organization type definitions for runtime field visibility.
 * @returns {Promise<{ typeDefs: Array<{value: string, label: string, enabled: boolean, fields?: string[]}> }>}
 */
async function getOrganizationTypesConfig(organizationId) {
  try {
    await maybeCleanupRetiredOrganizationTypesForTenant(organizationId);
    const tenantConfig = await findOrganizationsTenantConfig(organizationId);
    const statusTypes = tenantConfig?.settings?.statusTypes;
    const typeDefs = normalizeOrganizationTypesFromConfig(statusTypes?.organizationTypes);
    const rawStatusPicklists =
      statusTypes?.statusPicklists && typeof statusTypes.statusPicklists === 'object'
        ? statusTypes.statusPicklists
        : null;
    const statusPicklists = mergeOrganizationStatusPicklistsWithDefaults(rawStatusPicklists);
    if (typeDefs.length > 0 || rawStatusPicklists) {
      return { typeDefs, statusPicklists };
    }
    if (
      statusPicklists.customerStatus.length > 0 ||
      statusPicklists.partnerStatus.length > 0 ||
      statusPicklists.vendorStatus.length > 0
    ) {
      return { typeDefs, statusPicklists };
    }
  } catch (error) {
    console.error('[tenantMetadata] getOrganizationTypesConfig:', error);
  }
  return { typeDefs: [], statusPicklists: mergeOrganizationStatusPicklistsWithDefaults(null) };
}

const DEFAULT_ORGANIZATION_TYPE_OPTIONS = [
  'Lead',
  'Customer',
  'Marketing Lead',
  'Vendor',
  'Partner',
];

/**
 * Picklist options for Organizations `types` field (enabled types only).
 */
function typeDefsToOrganizationTypePicklistOptions(typeDefs) {
  const defs = (Array.isArray(typeDefs) ? typeDefs : []).filter(
    (d) => d && !isRetiredOrganizationType(d.value ?? d.label)
  );
  const enabled = defs.filter((d) => d && d.enabled !== false);
  const source = enabled.length > 0 ? enabled : DEFAULT_ORGANIZATION_TYPE_OPTIONS.map((value) => ({ value, label: value, enabled: true }));
  return source.map((d) => {
    if (typeof d === 'string') {
      return { value: d, label: d };
    }
    const value = String(d.value ?? d.label ?? '').trim();
    if (!value) return null;
    return {
      value,
      label: String(d.label ?? value).trim() || value,
      ...(d.color ? { color: d.color } : {}),
    };
  }).filter(Boolean);
}

function normalizePicklistOptionValue(option) {
  if (option == null) return '';
  if (typeof option === 'object') return String(option.value ?? option.label ?? '').trim();
  return String(option).trim();
}

/**
 * Enabled status values from Status & Types policy, merged with field catalog colors.
 * Returns null when no tenant policy exists (caller keeps module catalog options).
 */
function statusPicklistPolicyToOptions(policyRows, fieldOptions) {
  if (!Array.isArray(policyRows)) return null;
  const enabledRows = policyRows.filter((row) => row && row.enabled !== false);
  if (policyRows.length === 0) return null;
  const catalog = Array.isArray(fieldOptions) ? fieldOptions : [];
  return enabledRows.map((row) => {
    const value = String(row.value ?? row.label ?? '').trim();
    if (!value) return null;
    const catalogMatch = catalog.find(
      (opt) => normalizePicklistOptionValue(opt).toLowerCase() === value.toLowerCase()
    );
    const color =
      row.color ||
      (catalogMatch && typeof catalogMatch === 'object' ? catalogMatch.color : null) ||
      null;
    return {
      value,
      label: String(row.label ?? value).trim() || value,
      ...(color ? { color } : {}),
    };
  }).filter(Boolean);
}

/**
 * Map module field picklist options → statusTypes.statusPicklists rows.
 * @param {unknown} options
 * @returns {Array<{ value: string, label: string, enabled: boolean, color?: string }>}
 */
function moduleFieldOptionsToStatusPicklistRows(options) {
  if (!Array.isArray(options)) return [];
  const rows = [];
  for (const opt of options) {
    const value =
      typeof opt === 'string' || typeof opt === 'number'
        ? String(opt).trim()
        : String(opt?.value ?? opt?.label ?? '').trim();
    if (!value) continue;
    const label =
      typeof opt === 'object' && opt
        ? String(opt.label ?? value).trim() || value
        : value;
    const row = {
      value,
      label,
      enabled: !(typeof opt === 'object' && opt && opt.enabled === false),
    };
    if (typeof opt === 'object' && opt?.color) row.color = opt.color;
    rows.push(row);
  }
  return rows;
}

/**
 * Persist Field Configuration status picklist edits into tenant statusTypes.statusPicklists
 * (source of truth) before enrichOrganizationsModuleFields on module save.
 * Preserves previously disabled policy rows that are absent from the field payload
 * (Field Config only receives enabled options after enrichment).
 *
 * @param {Array} fields
 * @param {string|import('mongoose').Types.ObjectId} organizationId
 * @returns {Promise<boolean>} true when a picklist was written
 */
async function syncOrganizationStatusPicklistsFromModuleFields(fields, organizationId) {
  if (!Array.isArray(fields) || !organizationId) return false;
  const { ORGANIZATION_STATUS_FIELD_KEYS } = require('../constants/organizationStatusDefaults');

  const incomingByKey = {};
  for (const field of fields) {
    const key = String(field?.key || '').trim();
    if (!ORGANIZATION_STATUS_FIELD_KEYS.includes(key)) continue;
    const rows = moduleFieldOptionsToStatusPicklistRows(field.options);
    if (rows.length > 0) incomingByKey[key] = rows;
  }
  if (Object.keys(incomingByKey).length === 0) return false;

  let tenantConfig = null;
  const appPriority = ['SALES', 'HELPDESK', 'AUDIT', 'PORTAL', 'LMS'];
  for (const appKey of appPriority) {
    tenantConfig = await TenantModuleConfiguration.findOne({
      organizationId,
      appKey,
      moduleKey: 'organizations',
    });
    if (tenantConfig) break;
  }
  if (!tenantConfig) {
    tenantConfig = await TenantModuleConfiguration.findOne({
      organizationId,
      moduleKey: 'organizations',
    });
  }
  if (!tenantConfig) {
    tenantConfig = new TenantModuleConfiguration({
      organizationId,
      appKey: 'SALES',
      moduleKey: 'organizations',
      enabled: true,
      settings: {},
    });
  }

  if (!tenantConfig.settings) tenantConfig.settings = {};
  const prevStatusTypes = tenantConfig.settings.statusTypes || {};
  const prevPicklists =
    prevStatusTypes.statusPicklists && typeof prevStatusTypes.statusPicklists === 'object'
      ? prevStatusTypes.statusPicklists
      : {};

  const nextPicklists = { ...prevPicklists };
  for (const key of ORGANIZATION_STATUS_FIELD_KEYS) {
    const incoming = incomingByKey[key];
    if (!incoming) continue;
    const incomingValues = new Set(incoming.map((r) => r.value.toLowerCase()));
    const preservedDisabled = (Array.isArray(prevPicklists[key]) ? prevPicklists[key] : []).filter(
      (row) =>
        row &&
        row.enabled === false &&
        !incomingValues.has(String(row.value ?? '').trim().toLowerCase())
    );
    nextPicklists[key] = [...incoming, ...preservedDisabled];
  }

  tenantConfig.settings.statusTypes = {
    ...prevStatusTypes,
    statusPicklists: nextPicklists,
  };
  tenantConfig.markModified('settings');
  tenantConfig.markModified('settings.statusTypes');
  await tenantConfig.save();
  return true;
}

/**
 * Persist Field Configuration participation role picklist edits into
 * settings.organizationParticipationTypes (SoT used by create/edit).
 *
 * @param {Array} fields
 * @param {string|import('mongoose').Types.ObjectId} organizationId
 * @returns {Promise<boolean>}
 */
async function syncOrganizationParticipationTypesFromModuleFields(fields, organizationId) {
  if (!Array.isArray(fields) || !organizationId) return false;
  const {
    ORGANIZATION_PARTICIPATION_VIRTUAL_FIELD_TO_APP,
    ORGANIZATION_PARTICIPATION_BY_APP,
  } = require('../constants/organizationParticipation');

  const incomingByApp = {};
  for (const field of fields) {
    const key = String(field?.key || '').trim();
    const appKey = ORGANIZATION_PARTICIPATION_VIRTUAL_FIELD_TO_APP[key];
    if (!appKey) continue;
    const rows = moduleFieldOptionsToStatusPicklistRows(field.options);
    if (rows.length > 0) incomingByApp[appKey] = rows;
  }
  if (Object.keys(incomingByApp).length === 0) return false;

  let tenantConfig = null;
  const appPriority = ['SALES', 'HELPDESK', 'AUDIT', 'PORTAL', 'LMS'];
  for (const appKey of appPriority) {
    tenantConfig = await TenantModuleConfiguration.findOne({
      organizationId,
      appKey,
      moduleKey: 'organizations',
    });
    if (tenantConfig) break;
  }
  if (!tenantConfig) {
    tenantConfig = await TenantModuleConfiguration.findOne({
      organizationId,
      moduleKey: 'organizations',
    });
  }
  if (!tenantConfig) {
    tenantConfig = new TenantModuleConfiguration({
      organizationId,
      appKey: 'SALES',
      moduleKey: 'organizations',
      enabled: true,
      settings: {},
    });
  }

  if (!tenantConfig.settings) tenantConfig.settings = {};
  if (
    !tenantConfig.settings.organizationParticipationTypes ||
    typeof tenantConfig.settings.organizationParticipationTypes !== 'object'
  ) {
    tenantConfig.settings.organizationParticipationTypes = {};
  }

  const map = tenantConfig.settings.organizationParticipationTypes;
  let changed = false;

  for (const [appKey, rows] of Object.entries(incomingByApp)) {
    const prevEntry = pickPeopleTypesEntry(map, appKey);
    const prevDefs = Array.isArray(prevEntry?.typeDefs) ? prevEntry.typeDefs : [];
    const prevByValue = new Map(
      prevDefs.map((d) => [String(d.value || '').trim().toLowerCase(), d])
    );

    const typeDefs = rows.map((row, index) => {
      const prev = prevByValue.get(row.value.toLowerCase());
      const color =
        row.color ||
        (prev && prev.color) ||
        normalizePeopleTypeStoredColor(null, index);
      const def = { value: row.value, color };
      if (prev && Array.isArray(prev.fields)) {
        def.fields = prev.fields;
      }
      return def;
    });

    let defaultRole = prevEntry?.defaultRole || ORGANIZATION_PARTICIPATION_BY_APP[appKey]?.defaultType;
    if (
      !defaultRole ||
      !typeDefs.some((d) => d.value.toLowerCase() === String(defaultRole).toLowerCase())
    ) {
      defaultRole = typeDefs[0]?.value;
    } else {
      const match = typeDefs.find(
        (d) => d.value.toLowerCase() === String(defaultRole).toLowerCase()
      );
      defaultRole = match?.value || typeDefs[0]?.value;
    }

    map[appKey] = {
      types: typeDefs,
      default: defaultRole,
    };
    changed = true;
  }

  if (!changed) return false;
  tenantConfig.markModified('settings');
  tenantConfig.markModified('settings.organizationParticipationTypes');
  await tenantConfig.save();
  return true;
}

module.exports = {
  getEnabledAppsForTenant,
  getEnabledModulesForApp,
  getTenantModuleConfig,
  getEffectiveRelationships,
  isAppEnabledForTenant,
  isModuleEnabledForTenant,
  getPeopleTypes,
  getPeopleTypesConfig,
  validatePeopleType,
  sanitizePeopleTypeDefsForSave,
  collectAllowedPeopleParticipationFieldKeys,
  sanitizeOrganizationTypeDefsForSave,
  collectAllowedOrganizationTypeScopedFieldKeys,
  getOrganizationTypesConfig,
  maybeCleanupRetiredOrganizationTypesForTenant,
  getDefaultOrganizationStatusFieldOptions,
  mergeOrganizationStatusPicklistsWithDefaults,
  normalizeOrganizationTypesFromConfig,
  typeDefsToOrganizationTypePicklistOptions,
  statusPicklistPolicyToOptions,
  moduleFieldOptionsToStatusPicklistRows,
  syncOrganizationStatusPicklistsFromModuleFields,
  syncOrganizationParticipationTypesFromModuleFields,
  normalizePicklistOptionValue,
  typeDefsToPeopleTypePicklistOptions,
  DEFAULT_PEOPLE_TYPES
};

/**
 * Defaults for organization participation types per app.
 * Canonical source: organizationParticipation.js registry.
 */
function defaultOrganizationParticipationTypeDefsForApp(upperKey) {
  const {
    ORGANIZATION_PARTICIPATION_BY_APP,
  } = require('../constants/organizationParticipation');
  const cfg = ORGANIZATION_PARTICIPATION_BY_APP[upperKey];
  const roles = cfg?.allowedTypes ? [...cfg.allowedTypes] : ['Customer'];
  return typeDefsFromStringArray(roles);
}

async function collectAllowedOrganizationParticipationFieldKeys(_organizationId, _appKeyUpper) {
  const {
    ORGANIZATION_TYPE_FIELDS,
  } = require('../constants/organizationTypeDefaults');
  const allowed = new Set();
  for (const fields of Object.values(ORGANIZATION_TYPE_FIELDS)) {
    for (const f of fields) allowed.add(f);
  }
  return allowed;
}

/**
 * @returns {Promise<{ types: string[], defaultRole: string, typeDefs: Array<{value: string, color: string, fields?: string[]}> }>}
 */
async function getOrganizationParticipationTypesConfig(organizationId, appKey) {
  const upper = (appKey || 'SALES').toUpperCase();
  const {
    ORGANIZATION_PARTICIPATION_BY_APP,
    ORGANIZATION_PARTICIPATION_APP_KEYS,
  } = require('../constants/organizationParticipation');

  if (!ORGANIZATION_PARTICIPATION_APP_KEYS.includes(upper)) {
    const typeDefs = defaultOrganizationParticipationTypeDefsForApp('SALES');
    const types = typeDefs.map((d) => d.value);
    return {
      types,
      defaultRole: ORGANIZATION_PARTICIPATION_BY_APP.SALES?.defaultType || types[0],
      typeDefs,
    };
  }

  try {
    let tenantConfig = await TenantModuleConfiguration.findOne({
      organizationId,
      moduleKey: 'organizations',
      'settings.organizationParticipationTypes': { $exists: true, $ne: null },
    }).lean();

    let entry = pickPeopleTypesEntry(
      tenantConfig?.settings?.organizationParticipationTypes,
      upper
    );
    if (entry) return entry;

    const salesRow = await TenantModuleConfiguration.findOne({
      organizationId,
      appKey: 'SALES',
      moduleKey: 'organizations',
    }).lean();
    entry = pickPeopleTypesEntry(
      salesRow?.settings?.organizationParticipationTypes,
      upper
    );
    if (entry) return entry;

    const anyRow = await TenantModuleConfiguration.findOne({
      organizationId,
      moduleKey: 'organizations',
      'settings.organizationParticipationTypes': { $exists: true, $ne: null },
    }).lean();
    entry = pickPeopleTypesEntry(
      anyRow?.settings?.organizationParticipationTypes,
      upper
    );
    if (entry) return entry;

    const typeDefs = defaultOrganizationParticipationTypeDefsForApp(upper);
    const types = typeDefs.map((d) => d.value);
    return {
      types,
      defaultRole: ORGANIZATION_PARTICIPATION_BY_APP[upper]?.defaultType || types[0],
      typeDefs,
    };
  } catch (error) {
    console.error(
      `[tenantMetadata] getOrganizationParticipationTypesConfig ${organizationId} ${appKey}:`,
      error
    );
    const typeDefs = defaultOrganizationParticipationTypeDefsForApp(upper);
    const types = typeDefs.map((d) => d.value);
    return {
      types,
      defaultRole: ORGANIZATION_PARTICIPATION_BY_APP[upper]?.defaultType || types[0],
      typeDefs,
    };
  }
}

module.exports = {
  getEnabledAppsForTenant,
  getEnabledModulesForApp,
  getTenantModuleConfig,
  getEffectiveRelationships,
  isAppEnabledForTenant,
  isModuleEnabledForTenant,
  getPeopleTypes,
  getPeopleTypesConfig,
  validatePeopleType,
  sanitizePeopleTypeDefsForSave,
  collectAllowedPeopleParticipationFieldKeys,
  sanitizeOrganizationTypeDefsForSave,
  collectAllowedOrganizationTypeScopedFieldKeys,
  getOrganizationTypesConfig,
  maybeCleanupRetiredOrganizationTypesForTenant,
  getDefaultOrganizationStatusFieldOptions,
  mergeOrganizationStatusPicklistsWithDefaults,
  normalizeOrganizationTypesFromConfig,
  typeDefsToOrganizationTypePicklistOptions,
  statusPicklistPolicyToOptions,
  moduleFieldOptionsToStatusPicklistRows,
  syncOrganizationStatusPicklistsFromModuleFields,
  syncOrganizationParticipationTypesFromModuleFields,
  normalizePicklistOptionValue,
  typeDefsToPeopleTypePicklistOptions,
  DEFAULT_PEOPLE_TYPES,
  getOrganizationParticipationTypesConfig,
  collectAllowedOrganizationParticipationFieldKeys,
  defaultOrganizationParticipationTypeDefsForApp,
};
