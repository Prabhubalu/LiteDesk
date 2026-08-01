/**
 * Organization app participation — platform registry.
 *
 * Mirrors people participation: apps declare allowed org roles; availability
 * is gated by tenant-enabled apps. `organization.participations[APP]` is the
 * source of truth; `organization.types` is the denormalized union for
 * field visibility, filters, and backward compatibility.
 *
 * Keep in sync with client/src/platform/organizations/organizationParticipation.ts
 */

/** Apps that contribute organization participation roles (display order). */
const ORGANIZATION_PARTICIPATION_APP_KEYS = Object.freeze([
  'SALES',
  'HELPDESK',
  'INVENTORY',
  'MARKETING',
  'PORTAL',
]);

/**
 * Per-app allowed roles (canonical display labels) + default.
 * Customer may be declared by multiple apps; each app owns its own participation row.
 */
const ORGANIZATION_PARTICIPATION_BY_APP = Object.freeze({
  SALES: Object.freeze({
    allowedTypes: Object.freeze(['Lead', 'Customer']),
    defaultType: 'Customer',
  }),
  HELPDESK: Object.freeze({
    allowedTypes: Object.freeze(['Customer']),
    defaultType: 'Customer',
  }),
  INVENTORY: Object.freeze({
    allowedTypes: Object.freeze(['Vendor']),
    defaultType: 'Vendor',
  }),
  MARKETING: Object.freeze({
    allowedTypes: Object.freeze(['Marketing Lead', 'Customer']),
    defaultType: 'Customer',
  }),
  PORTAL: Object.freeze({
    allowedTypes: Object.freeze(['Partner']),
    defaultType: 'Partner',
  }),
});

/** All distinct role labels across apps (stable order). */
const ORGANIZATION_PARTICIPATION_ROLE_ORDER = Object.freeze([
  'Lead',
  'Customer',
  'Marketing Lead',
  'Vendor',
  'Partner',
]);

/**
 * Roles that drive Customer-scoped CRM fields (status, tier, etc.).
 * Lead / Marketing Lead share the customer field pool.
 */
const ORGANIZATION_CUSTOMER_FIELD_ROLES = Object.freeze([
  'Customer',
  'Lead',
  'Marketing Lead',
]);

/**
 * Map a participation role → legacy type key used by ORGANIZATION_TYPE_FIELDS.
 */
const ORGANIZATION_ROLE_TO_TYPE_FIELD_KEY = Object.freeze({
  Lead: 'Customer',
  Customer: 'Customer',
  'Marketing Lead': 'Customer',
  Vendor: 'Vendor',
  Partner: 'Partner',
});

/**
 * Module Field Configuration virtual keys → participation app.
 * Options for these picklists are stored in settings.organizationParticipationTypes[APP].
 */
const ORGANIZATION_PARTICIPATION_VIRTUAL_FIELD_TO_APP = Object.freeze({
  sales_type: 'SALES',
  helpdesk_role: 'HELPDESK',
  inventory_role: 'INVENTORY',
  marketing_role: 'MARKETING',
  portal_role: 'PORTAL',
});

/**
 * When hydrating participations from a flat `types[]` (legacy / UI multi-select),
 * assign each role to owning apps that declare it (intersect enabled apps).
 */
function appsOwningRole(role, enabledAppKeys) {
  const want = normalizeRole(role);
  if (!want) return [];
  const enabled = normalizeAppKeySet(enabledAppKeys);
  const owners = [];
  for (const appKey of ORGANIZATION_PARTICIPATION_APP_KEYS) {
    if (enabled.size > 0 && !enabled.has(appKey)) continue;
    const cfg = ORGANIZATION_PARTICIPATION_BY_APP[appKey];
    if (!cfg) continue;
    if (cfg.allowedTypes.some((t) => normalizeRole(t) === want)) {
      owners.push(appKey);
    }
  }
  return owners;
}

function normalizeRole(value) {
  return String(value ?? '').trim();
}

function normalizeRoleKey(value) {
  return normalizeRole(value).toLowerCase();
}

function normalizeAppKeySet(enabledAppKeys) {
  const set = new Set();
  if (!Array.isArray(enabledAppKeys)) return set;
  for (const raw of enabledAppKeys) {
    const key =
      typeof raw === 'string'
        ? raw
        : raw && typeof raw === 'object'
          ? raw.appKey || raw.key
          : '';
    const upper = String(key || '')
      .trim()
      .toUpperCase();
    if (!upper) continue;
    const status =
      raw && typeof raw === 'object' && raw.status != null
        ? String(raw.status).toUpperCase()
        : 'ACTIVE';
    const enabledFlag =
      raw && typeof raw === 'object' && typeof raw.enabled === 'boolean'
        ? raw.enabled
        : true;
    if (status !== 'ACTIVE' && status !== 'ENABLED') continue;
    if (!enabledFlag) continue;
    set.add(upper);
  }
  return set;
}

/**
 * Union of roles available from enabled participation apps.
 * @param {string[]|object[]} enabledAppKeys
 * @returns {string[]}
 */
function resolveAvailableOrganizationRoles(enabledAppKeys) {
  const enabled = normalizeAppKeySet(enabledAppKeys);
  const seen = new Set();
  const out = [];

  const apps =
    enabled.size === 0
      ? // No enablement snapshot → Sales-only baseline (Customer + Lead)
        ['SALES']
      : ORGANIZATION_PARTICIPATION_APP_KEYS.filter((k) => enabled.has(k));

  for (const appKey of apps) {
    const cfg = ORGANIZATION_PARTICIPATION_BY_APP[appKey];
    if (!cfg) continue;
    for (const role of cfg.allowedTypes) {
      const key = normalizeRoleKey(role);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(role);
    }
  }

  if (out.length === 0) {
    return ['Customer'];
  }

  // Stable product order
  return ORGANIZATION_PARTICIPATION_ROLE_ORDER.filter((r) =>
    out.some((x) => normalizeRoleKey(x) === normalizeRoleKey(r))
  );
}

/**
 * Filter tenant type defs / picklist options to roles allowed by enabled apps.
 * @param {Array<{value?: string, label?: string, enabled?: boolean}>} typeDefs
 * @param {string[]|object[]} enabledAppKeys
 */
function filterOrganizationTypeDefsByEnabledApps(typeDefs, enabledAppKeys) {
  const allowed = new Set(
    resolveAvailableOrganizationRoles(enabledAppKeys).map(normalizeRoleKey)
  );
  const defs = Array.isArray(typeDefs) ? typeDefs : [];
  return defs.filter((d) => {
    const value = String(d?.value ?? d?.label ?? '').trim();
    if (!value) return false;
    return allowed.has(normalizeRoleKey(value));
  });
}

function typeFieldKeyForRole(role) {
  const direct = ORGANIZATION_ROLE_TO_TYPE_FIELD_KEY[normalizeRole(role)];
  if (direct) return direct;
  const match = Object.keys(ORGANIZATION_ROLE_TO_TYPE_FIELD_KEY).find(
    (k) => normalizeRoleKey(k) === normalizeRoleKey(role)
  );
  return match ? ORGANIZATION_ROLE_TO_TYPE_FIELD_KEY[match] : normalizeRole(role);
}

module.exports = {
  ORGANIZATION_PARTICIPATION_APP_KEYS,
  ORGANIZATION_PARTICIPATION_BY_APP,
  ORGANIZATION_PARTICIPATION_ROLE_ORDER,
  ORGANIZATION_CUSTOMER_FIELD_ROLES,
  ORGANIZATION_ROLE_TO_TYPE_FIELD_KEY,
  ORGANIZATION_PARTICIPATION_VIRTUAL_FIELD_TO_APP,
  appsOwningRole,
  normalizeRole,
  normalizeRoleKey,
  normalizeAppKeySet,
  resolveAvailableOrganizationRoles,
  filterOrganizationTypeDefsByEnabledApps,
  typeFieldKeyForRole,
};
