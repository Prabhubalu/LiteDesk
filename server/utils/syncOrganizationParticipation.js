/**
 * Organization participations ↔ types sync.
 *
 * participations[APP] = { role } is source of truth when present.
 * types[] remains the denormalized union for field visibility / filters / BC.
 */

const {
  ORGANIZATION_PARTICIPATION_APP_KEYS,
  ORGANIZATION_PARTICIPATION_ROLE_ORDER,
  appsOwningRole,
  normalizeRole,
  normalizeRoleKey,
  normalizeAppKeySet,
} = require('../constants/organizationParticipation');

/**
 * Build participations from a flat types[] selection + enabled apps.
 * Each selected role is attached to every enabled app that declares it.
 *
 * @param {string[]} types
 * @param {string[]|object[]} enabledAppKeys
 * @param {object} [existingParticipations]
 * @returns {object}
 */
function buildParticipationsFromTypes(types, enabledAppKeys, existingParticipations = {}) {
  const next = {};
  const roles = Array.isArray(types)
    ? types.map(normalizeRole).filter(Boolean)
    : [];

  for (const role of roles) {
    const owners = appsOwningRole(role, enabledAppKeys);
    for (const appKey of owners) {
      const prev = existingParticipations?.[appKey];
      next[appKey] = {
        ...(prev && typeof prev === 'object' ? prev : {}),
        role,
      };
    }
  }

  // Preserve participation rows for apps whose role was not in the flat types
  // only when that role is still represented (multi-app Customer). Already covered.
  // Drop apps with no role.
  for (const appKey of Object.keys(next)) {
    if (!next[appKey]?.role) delete next[appKey];
  }

  return next;
}

/**
 * Derive flat types[] from participations (unique roles, product order).
 * @param {object} participations
 * @returns {string[]}
 */
function deriveTypesFromParticipations(participations) {
  if (!participations || typeof participations !== 'object') return [];
  const seen = new Set();
  const roles = [];
  for (const appKey of ORGANIZATION_PARTICIPATION_APP_KEYS) {
    const role = normalizeRole(participations[appKey]?.role);
    if (!role) continue;
    const key = normalizeRoleKey(role);
    if (seen.has(key)) continue;
    seen.add(key);
    roles.push(role);
  }
  // Include any unknown app keys
  for (const [appKey, entry] of Object.entries(participations)) {
    if (ORGANIZATION_PARTICIPATION_APP_KEYS.includes(appKey)) continue;
    const role = normalizeRole(entry?.role);
    if (!role) continue;
    const key = normalizeRoleKey(role);
    if (seen.has(key)) continue;
    seen.add(key);
    roles.push(role);
  }
  const ordered = ORGANIZATION_PARTICIPATION_ROLE_ORDER.filter((r) =>
    roles.some((x) => normalizeRoleKey(x) === normalizeRoleKey(r))
  );
  const extras = roles.filter(
    (r) => !ORGANIZATION_PARTICIPATION_ROLE_ORDER.some((o) => normalizeRoleKey(o) === normalizeRoleKey(r))
  );
  return [...ordered, ...extras];
}

/**
 * Apply types write: set participations + canonical types.
 * @returns {{ types: string[], participations: object }}
 */
function applyTypesWrite({ types, enabledAppKeys, existingParticipations }) {
  const participations = buildParticipationsFromTypes(
    types,
    enabledAppKeys,
    existingParticipations
  );
  const derived = deriveTypesFromParticipations(participations);
  // Prefer caller's label casing when present
  const canonical = (Array.isArray(types) ? types : [])
    .map(normalizeRole)
    .filter(Boolean);
  const merged = [];
  const seen = new Set();
  for (const role of [...canonical, ...derived]) {
    const key = normalizeRoleKey(role);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(role);
  }
  const ordered = ORGANIZATION_PARTICIPATION_ROLE_ORDER.filter((r) =>
    merged.some((x) => normalizeRoleKey(x) === normalizeRoleKey(r))
  );
  const extras = merged.filter(
    (r) => !ORGANIZATION_PARTICIPATION_ROLE_ORDER.some((o) => normalizeRoleKey(o) === normalizeRoleKey(r))
  );
  return { types: [...ordered, ...extras], participations };
}

/**
 * Ensure org document has participations aligned with types (read/normalize path).
 * Mutates plain object or mongoose doc fields via assignment return.
 */
function syncOrganizationParticipation(org, enabledAppKeys) {
  if (!org || typeof org !== 'object') return org;
  const hasParticipations =
    org.participations &&
    typeof org.participations === 'object' &&
    Object.keys(org.participations).some((k) => org.participations[k]?.role);

  if (hasParticipations) {
    const types = deriveTypesFromParticipations(org.participations);
    if (Array.isArray(org.types)) {
      // Keep types in sync if empty or drifted
      const currentKeys = new Set((org.types || []).map(normalizeRoleKey));
      const nextKeys = new Set(types.map(normalizeRoleKey));
      const same =
        currentKeys.size === nextKeys.size &&
        [...currentKeys].every((k) => nextKeys.has(k));
      if (!same || !(org.types || []).length) {
        org.types = types;
      }
    } else {
      org.types = types;
    }
    return org;
  }

  // Legacy: types only → build participations
  const { types, participations } = applyTypesWrite({
    types: org.types || [],
    enabledAppKeys,
    existingParticipations: org.participations || {},
  });
  org.types = types;
  org.participations = participations;
  return org;
}

/**
 * Validate selected types against apps enabled for the tenant.
 * @returns {{ valid: boolean, allowedTypes: string[], message?: string, invalid?: string[] }}
 */
function validateOrganizationTypesForEnabledApps(types, allowedRoles) {
  const allowed = new Set((allowedRoles || []).map(normalizeRoleKey));
  const selected = Array.isArray(types) ? types.map(normalizeRole).filter(Boolean) : [];
  if (selected.length === 0) {
    return { valid: true, allowedTypes: allowedRoles || [] };
  }
  const invalid = selected.filter((t) => !allowed.has(normalizeRoleKey(t)));
  if (invalid.length) {
    return {
      valid: false,
      allowedTypes: allowedRoles || [],
      invalid,
      message: `Organization type(s) not available for enabled apps: ${invalid.join(', ')}`,
    };
  }
  return { valid: true, allowedTypes: allowedRoles || [] };
}

/**
 * Active app keys for a tenant — prefer Organization.enabledApps (same as client UI),
 * fall back to TenantAppConfiguration.
 * @param {string|ObjectId} organizationId
 * @returns {Promise<string[]>}
 */
async function resolveTenantParticipationAppKeys(organizationId) {
  if (!organizationId) return ['SALES'];
  try {
    const Organization = require('../models/Organization');
    const org = await Organization.findById(organizationId).select('enabledApps').lean();
    const fromOrg = [...normalizeAppKeySet(org?.enabledApps)];
    if (fromOrg.length > 0) return fromOrg;

    const { getEnabledAppsForTenant } = require('./tenantMetadata');
    const apps = await getEnabledAppsForTenant(organizationId);
    const keys = (apps || []).map((a) => String(a.appKey || '').toUpperCase()).filter(Boolean);
    return keys.length ? keys : ['SALES'];
  } catch (err) {
    console.error('[syncOrganizationParticipation] resolveTenantParticipationAppKeys:', err?.message || err);
    return ['SALES'];
  }
}

/**
 * Validate participations map: each app enabled + role allowed for that app.
 * @returns {{ valid: boolean, message?: string, invalid?: string[] }}
 */
function validateOrganizationParticipations(participations, enabledAppKeys) {
  const {
    ORGANIZATION_PARTICIPATION_BY_APP,
    ORGANIZATION_PARTICIPATION_APP_KEYS,
  } = require('../constants/organizationParticipation');
  const enabled = normalizeAppKeySet(enabledAppKeys);
  const invalid = [];
  if (!participations || typeof participations !== 'object') {
    return { valid: true };
  }
  for (const [rawApp, entry] of Object.entries(participations)) {
    const appKey = String(rawApp || '').toUpperCase();
    if (!ORGANIZATION_PARTICIPATION_APP_KEYS.includes(appKey)) {
      invalid.push(`${appKey}`);
      continue;
    }
    if (enabled.size > 0 && !enabled.has(appKey)) {
      invalid.push(appKey);
      continue;
    }
    const role = normalizeRole(entry?.role);
    if (!role) continue;
    const allowed = ORGANIZATION_PARTICIPATION_BY_APP[appKey]?.allowedTypes || [];
    if (!allowed.some((t) => normalizeRoleKey(t) === normalizeRoleKey(role))) {
      invalid.push(`${role} (${appKey})`);
    }
  }
  if (invalid.length) {
    return {
      valid: false,
      invalid,
      message: `Organization participation not available for enabled apps: ${invalid.join(', ')}`,
    };
  }
  return { valid: true };
}

module.exports = {
  buildParticipationsFromTypes,
  deriveTypesFromParticipations,
  applyTypesWrite,
  syncOrganizationParticipation,
  validateOrganizationTypesForEnabledApps,
  validateOrganizationParticipations,
  resolveTenantParticipationAppKeys,
  normalizeAppKeySet,
};
