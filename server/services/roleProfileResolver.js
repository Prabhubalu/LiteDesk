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

  return {
    ...roleLean,
    permissions: profile.permissions || roleLean.permissions,
    appPermissions: profile.appPermissions
      ? toPlainMap(profile.appPermissions)
      : roleLean.appPermissions,
    fieldPermissions: roleFieldOverrides,
    _fieldPermissions: mergeFieldPermissionMaps(profileFieldPermissions, roleFieldOverrides),
    _profileFieldPermissions: profileFieldPermissions,
    _sourceProfileId: profile._id,
    _sourceProfileKey: profile.profileKey
  };
}

module.exports = {
  resolveRoleLeanWithProfile,
  mergeFieldPermissionMaps
};
