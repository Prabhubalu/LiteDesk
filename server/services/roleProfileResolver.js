/**
 * Resolve Role permissions from linked Profile when privilegeMode === 'profile'.
 */

const Profile = require('../models/Profile');
const { isRbacV2Enabled } = require('../utils/rbacFeatureFlags');

function toPlainMap(value) {
  if (!value) return {};
  if (typeof value.entries === 'function') {
    const out = {};
    for (const [k, v] of value.entries()) {
      out[k] = v;
    }
    return out;
  }
  if (typeof value.toObject === 'function') return value.toObject();
  return { ...value };
}

function mergeFieldPermissionMaps(profileMap, roleMap) {
  const base = toPlainMap(profileMap);
  const overrides = toPlainMap(roleMap);
  return { ...base, ...overrides };
}

function mergeModulePermissionMaps(profilePermissions, rolePermissions) {
  const profile = toPlainMap(profilePermissions);
  const role = toPlainMap(rolePermissions);
  if (!Object.keys(profile).length) return role;
  if (!Object.keys(role).length) return profile;

  const merged = { ...profile };
  for (const [moduleKey, roleGrant] of Object.entries(role)) {
    if (!roleGrant || typeof roleGrant !== 'object') continue;
    merged[moduleKey] = {
      ...(profile[moduleKey] || {}),
      ...roleGrant
    };
  }
  return merged;
}

function grantsEqual(a, b) {
  const left = a && typeof a === 'object' ? a : {};
  const right = b && typeof b === 'object' ? b : {};
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    if (key === 'scope') {
      if ((left.scope || 'own') !== (right.scope || 'own')) return false;
      continue;
    }
    if (Boolean(left[key]) !== Boolean(right[key])) return false;
  }
  return true;
}

function hasAnyModuleGrant(grant) {
  if (!grant || typeof grant !== 'object') return false;
  return Object.entries(grant).some(([key, value]) => key !== 'scope' && Boolean(value));
}

function profileBaselineForModule(profile, moduleKey) {
  if (!profile || !moduleKey) return null;
  if (profile[moduleKey] && typeof profile[moduleKey] === 'object') return profile[moduleKey];
  if (moduleKey === 'people' && profile.contacts && typeof profile.contacts === 'object') {
    return profile.contacts;
  }
  if (moduleKey === 'contacts' && profile.people && typeof profile.people === 'object') {
    return profile.people;
  }
  return null;
}

/**
 * Normalize stored role.permissions for profile mode (plain module grant maps only).
 */
function sanitizeModulePermissionOverrides(_profilePermissions, roleOverrides) {
  const role = toPlainMap(roleOverrides);
  const out = {};
  for (const [key, grant] of Object.entries(role)) {
    if (!grant || typeof grant !== 'object') continue;
    // Skip nested non-grant shapes (e.g. performance.targets).
    const values = Object.values(grant);
    if (values.some((v) => v && typeof v === 'object' && !Array.isArray(v))) continue;
    out[key] = { ...grant };
  }
  return out;
}

/**
 * Keep only module grants that differ from the profile baseline.
 * Used so profile-mode roles store overrides, not a full stale matrix copy.
 */
function pickModulePermissionOverrides(profilePermissions, candidatePermissions) {
  const profile = toPlainMap(profilePermissions);
  const candidate = toPlainMap(candidatePermissions);
  const overrides = {};
  for (const [moduleKey, grant] of Object.entries(candidate)) {
    if (!grant || typeof grant !== 'object') continue;
    const baseline = profileBaselineForModule(profile, moduleKey);
    if (baseline) {
      if (!grantsEqual(baseline, grant)) {
        overrides[moduleKey] = { ...grant };
      }
      continue;
    }
    // Module absent on profile: only persist when the role actually grants something.
    if (hasAnyModuleGrant(grant)) {
      overrides[moduleKey] = { ...grant };
    }
  }
  return sanitizeModulePermissionOverrides(profile, overrides);
}

/**
 * @param {object|null} roleLean
 * @param {object|null|undefined} organization
 * @returns {Promise<object|null>}
 */
async function resolveRoleLeanWithProfile(roleLean, organization = null) {
  if (!roleLean) return null;
  if (!isRbacV2Enabled(organization)) return roleLean;

  const mode = roleLean.privilegeMode || 'inline';
  if (mode !== 'profile' || !roleLean.profileId) {
    return roleLean;
  }

  const profileId =
    typeof roleLean.profileId === 'object' && roleLean.profileId._id
      ? roleLean.profileId._id
      : roleLean.profileId;

  const profile = await Profile.findById(profileId).lean();
  if (!profile) return roleLean;

  const roleFieldOverrides = toPlainMap(roleLean.fieldPermissions);
  const profileFieldPermissions = toPlainMap(profile.fieldPermissions);
  const roleModuleOverrides = sanitizeModulePermissionOverrides(
    profile.permissions,
    roleLean.permissions
  );

  return {
    ...roleLean,
    permissions: mergeModulePermissionMaps(profile.permissions, roleModuleOverrides),
    appPermissions: profile.appPermissions
      ? toPlainMap(profile.appPermissions)
      : toPlainMap(roleLean.appPermissions),
    fieldPermissions: roleFieldOverrides,
    _fieldPermissions: mergeFieldPermissionMaps(profileFieldPermissions, roleFieldOverrides),
    _profileFieldPermissions: profileFieldPermissions,
    _sourceProfileId: profile._id,
    _sourceProfileKey: profile.profileKey
  };
}

module.exports = {
  resolveRoleLeanWithProfile,
  mergeFieldPermissionMaps,
  mergeModulePermissionMaps,
  pickModulePermissionOverrides,
  sanitizeModulePermissionOverrides,
  hasAnyModuleGrant
};
