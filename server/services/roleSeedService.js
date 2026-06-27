/**
 * RBAC v2 — seed system profiles + SALES-first role hierarchy for a tenant.
 */

const Profile = require('../models/Profile');
const Role = require('../models/Role');
const { SYSTEM_PROFILE_DEFINITIONS } = require('./profileMatrixBuilders');
const { SYSTEM_PROFILE_KEYS } = require('../permissions/profileKeys');
const { buildAppEntitlementsForOrg } = require('./roleEntitlementService');
const {
  isAppEnabledForOrg,
  validateAppRole,
  getDefaultRoleForApp
} = require('../utils/appAccessUtils');
const { APP_KEYS } = require('../constants/appKeys');

const PRIVILEGED_FLAGS = {
  canViewAllData: false,
  canManageTeam: false,
  canExportData: false
};

async function seedSystemProfiles(organizationId, ProfileModel = Profile) {
  const created = [];
  const existing = await ProfileModel.find({ organizationId }).select('profileKey name').lean();
  const existingKeys = new Set(existing.map((p) => p.profileKey).filter(Boolean));

  for (const def of SYSTEM_PROFILE_DEFINITIONS) {
    if (existingKeys.has(def.profileKey)) continue;
    const payload = typeof def.permissions === 'function' ? def.permissions() : def.permissions;
    const permissions = payload?.permissions ?? payload;
    const appPermissions = payload?.appPermissions;
    const doc = await ProfileModel.create({
      organizationId,
      profileKey: def.profileKey,
      name: def.name,
      description: def.description,
      isSystemProfile: def.isSystemProfile,
      permissions,
      ...(appPermissions ? { appPermissions } : {})
    });
    created.push(doc);
  }

  return { created, skipped: existing.length };
}

async function syncSystemProfilePermissions(organizationId, ProfileModel = Profile) {
  let updated = 0;
  for (const def of SYSTEM_PROFILE_DEFINITIONS) {
    if (!def.isSystemProfile || !def.profileKey) continue;
    const payload = typeof def.permissions === 'function' ? def.permissions() : def.permissions;
    const permissions = payload?.permissions ?? payload;
    const appPermissions = payload?.appPermissions;
    const result = await ProfileModel.updateOne(
      {
        organizationId,
        profileKey: def.profileKey,
        updatedBy: { $in: [null, undefined] }
      },
      {
        $set: {
          permissions,
          ...(appPermissions ? { appPermissions } : {})
        }
      }
    );
    if (result.modifiedCount) updated += 1;
  }
  return { updated };
}

async function getProfileIdByKey(organizationId, profileKey, ProfileModel = Profile) {
  const p = await ProfileModel.findOne({ organizationId, profileKey }).select('_id').lean();
  return p?._id || null;
}

function resolveAppRoleKeyForEntitlement(appKey, preferredRoleKey) {
  const normalizedAppKey = String(appKey || '').toUpperCase();
  const preferred = String(preferredRoleKey || '').toUpperCase();
  if (preferred && validateAppRole(normalizedAppKey, preferred)) {
    return preferred;
  }
  return getDefaultRoleForApp(normalizedAppKey) || preferred || 'USER';
}

function buildEntitlementsAllApps(organization, appRoleKey, seatConsuming = true) {
  const entitlements = [];
  const apps = organization?.enabledApps || [];
  for (const entry of apps) {
    const appKey = typeof entry === 'string' ? entry : entry?.appKey;
    const status = typeof entry === 'object' ? String(entry.status || 'ACTIVE') : 'ACTIVE';
    if (!appKey || status.toUpperCase() !== 'ACTIVE') continue;
    if (!isAppEnabledForOrg(organization, appKey)) continue;
    entitlements.push({
      appKey: String(appKey).toUpperCase(),
      enabled: true,
      seatConsuming,
      appRoleKey: resolveAppRoleKeyForEntitlement(appKey, appRoleKey)
    });
  }
  if (entitlements.length === 0 && isAppEnabledForOrg(organization, APP_KEYS.SALES)) {
    entitlements.push({
      appKey: APP_KEYS.SALES,
      enabled: true,
      seatConsuming,
      appRoleKey: resolveAppRoleKeyForEntitlement(APP_KEYS.SALES, appRoleKey)
    });
  }
  return entitlements;
}

/**
 * Ensure Owner / Administrator system roles include entitlement for a newly enabled app.
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @param {string} appKey
 */
async function syncPrivilegedRoleEntitlementsForApp(organizationId, appKey, options = {}) {
  const RoleModel = options.RoleModel || Role;
  const normalizedAppKey = String(appKey || '').trim().toUpperCase();
  if (!organizationId || !normalizedAppKey) return { updated: 0 };

  const privilegedRoles = await RoleModel.find({
    organizationId,
    isSystemRole: true,
    name: { $in: ['Owner', 'Administrator'] }
  });

  let updated = 0;
  for (const role of privilegedRoles) {
    const entitlements = Array.isArray(role.appEntitlements) ? [...role.appEntitlements] : [];
    const alreadyPresent = entitlements.some(
      (entry) => String(entry?.appKey || '').toUpperCase() === normalizedAppKey && entry?.enabled !== false
    );
    if (alreadyPresent) continue;

    entitlements.push({
      appKey: normalizedAppKey,
      enabled: true,
      seatConsuming: role.name !== 'Owner',
      appRoleKey: resolveAppRoleKeyForEntitlement(normalizedAppKey, 'ADMIN')
    });
    role.appEntitlements = entitlements;
    await role.save();
    updated += 1;
  }

  return { updated };
}

/**
 * Seed Owner, Administrator, Sales Manager, Sales Executive for organization.
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @param {object} organization — full or partial org with enabledApps
 */
async function seedRolesAndProfilesForOrganization(organizationId, organization, options = {}) {
  const RoleModel = options.RoleModel || Role;
  const ProfileModel = options.ProfileModel || Profile;
  const orgId = organizationId;
  const roleCount = await RoleModel.countDocuments({ organizationId: orgId });
  if (roleCount > 0) {
    return { profiles: { created: [], skipped: 0 }, roles: { created: [], skipped: roleCount } };
  }

  const profileResult = await seedSystemProfiles(orgId, ProfileModel);
  const platformProfileId = await getProfileIdByKey(orgId, SYSTEM_PROFILE_KEYS.PLATFORM_FULL, ProfileModel);
  const managerProfileId = await getProfileIdByKey(orgId, SYSTEM_PROFILE_KEYS.SALES_MANAGER, ProfileModel);
  const standardProfileId = await getProfileIdByKey(orgId, SYSTEM_PROFILE_KEYS.SALES_STANDARD, ProfileModel);

  const rolesToCreate = [
    {
      organizationId: orgId,
      name: 'Owner',
      description: 'Full system access with all permissions',
      isSystemRole: true,
      isTemplateSeed: false,
      level: 0,
      parentRole: null,
      userType: 'INTERNAL',
      privilegeMode: 'profile',
      profileId: platformProfileId,
      appEntitlements: buildEntitlementsAllApps(organization, 'ADMIN', false),
      color: '#9333ea',
      icon: 'crown',
      ...PRIVILEGED_FLAGS
    },
    {
      organizationId: orgId,
      name: 'Administrator',
      description: 'Full administrative access with all permissions',
      isSystemRole: true,
      isTemplateSeed: false,
      level: 1,
      parentRole: null,
      userType: 'INTERNAL',
      privilegeMode: 'profile',
      profileId: platformProfileId,
      appEntitlements: buildEntitlementsAllApps(organization, 'ADMIN', true),
      color: '#ef4444',
      icon: 'shield',
      ...PRIVILEGED_FLAGS
    },
    {
      organizationId: orgId,
      name: 'Sales Manager',
      description: 'Sales team lead with team-level access',
      isSystemRole: false,
      isTemplateSeed: true,
      level: 2,
      parentRole: null,
      userType: 'INTERNAL',
      privilegeMode: 'profile',
      profileId: managerProfileId,
      appEntitlements: buildAppEntitlementsForOrg(organization, { salesRoleKey: 'MANAGER' }),
      color: '#3b82f6',
      icon: 'users',
      canViewAllData: false,
      canManageTeam: false,
      canExportData: false
    },
    {
      organizationId: orgId,
      name: 'Sales Executive',
      description: 'Sales representative with own record access',
      isSystemRole: false,
      isTemplateSeed: true,
      level: 3,
      parentRole: null,
      userType: 'INTERNAL',
      privilegeMode: 'profile',
      profileId: standardProfileId,
      appEntitlements: buildAppEntitlementsForOrg(organization, { salesRoleKey: 'USER' }),
      color: '#10b981',
      icon: 'user',
      canViewAllData: false,
      canManageTeam: false,
      canExportData: false
    }
  ];

  const inserted = await RoleModel.insertMany(rolesToCreate);

  const ownerRole = inserted.find((r) => r.name === 'Owner');
  const adminRole = inserted.find((r) => r.name === 'Administrator');
  const managerRole = inserted.find((r) => r.name === 'Sales Manager');
  const executiveRole = inserted.find((r) => r.name === 'Sales Executive');

  if (adminRole && ownerRole) {
    adminRole.parentRole = ownerRole._id;
    adminRole.level = 1;
    await adminRole.save();
  }
  if (managerRole && adminRole) {
    managerRole.parentRole = adminRole._id;
    managerRole.level = 2;
    await managerRole.save();
  }
  if (executiveRole && managerRole) {
    executiveRole.parentRole = managerRole._id;
    executiveRole.level = 3;
    await executiveRole.save();
  }

  let sharingResult = null;
  const { isSharingV1Enabled } = require('../utils/rbacFeatureFlags');
  if (isSharingV1Enabled(organization)) {
    const { seedSharingDefaultsForOrganization } = require('./sharingSeedService');
    sharingResult = await seedSharingDefaultsForOrganization(orgId, organization);
  }

  return {
    profiles: profileResult,
    roles: { created: inserted, skipped: 0 },
    roleIds: {
      owner: ownerRole?._id,
      administrator: adminRole?._id,
      salesManager: managerRole?._id,
      salesExecutive: executiveRole?._id
    },
    sharing: sharingResult
  };
}

module.exports = {
  seedSystemProfiles,
  syncSystemProfilePermissions,
  seedRolesAndProfilesForOrganization,
  getProfileIdByKey,
  buildEntitlementsAllApps,
  resolveAppRoleKeyForEntitlement,
  syncPrivilegedRoleEntitlementsForApp
};
