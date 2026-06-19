/**
 * RBAC v2 tenant migration — profiles, role renames, entitlements, user backfill.
 */

const Profile = require('../models/Profile');
const Role = require('../models/Role');
const User = require('../models/User');
const Organization = require('../models/Organization');
const { SYSTEM_PROFILE_KEYS } = require('../permissions/profileKeys');
const { seedSystemProfiles, buildEntitlementsAllApps } = require('./roleSeedService');
const {
  deriveAppAccessFromRole,
  buildAppEntitlementsForOrg,
  mapRoleNameToLegacyEnum
} = require('./roleEntitlementService');
const { recalculateOrganizationRoleLevels, repairStandardRoleHierarchy } = require('./roleHierarchyService');
const { hydrateUserPermissionsFromRole } = require('../utils/rolePermissionProjection');

/** @typedef {'rename'|'merge'|'skip'} LegacyRenameAction */

const LEGACY_ROLE_RENAME_RULES = {
  Admin: {
    targetName: 'Administrator',
    profileKey: SYSTEM_PROFILE_KEYS.PLATFORM_FULL,
    privileged: true,
    isSystemRole: true,
    isTemplateSeed: false,
    appRoleKey: 'ADMIN'
  },
  Manager: {
    targetName: 'Sales Manager',
    profileKey: SYSTEM_PROFILE_KEYS.SALES_MANAGER,
    privileged: false,
    isSystemRole: false,
    isTemplateSeed: true,
    appRoleKey: 'MANAGER',
    canManageTeam: true,
    canExportData: true
  },
  User: {
    targetName: 'Sales Executive',
    profileKey: SYSTEM_PROFILE_KEYS.SALES_STANDARD,
    privileged: false,
    isSystemRole: false,
    isTemplateSeed: true,
    appRoleKey: 'USER'
  }
};

const {
  ZERO_LEGACY_ROLE_CAPABILITIES
} = require('../utils/rbacFeatureFlags');

function normalizeRoleName(name) {
  return String(name || '').trim();
}

function roleNameSet(roles) {
  return new Set((roles || []).map((r) => normalizeRoleName(r.name)));
}

/**
 * @param {string} legacyName
 * @param {Set<string>} existingNames
 * @returns {{ action: LegacyRenameAction, targetName?: string, rule?: object }}
 */
function resolveLegacyRoleRename(legacyName, existingNames) {
  const rule = LEGACY_ROLE_RENAME_RULES[legacyName];
  if (!rule) return { action: 'skip' };

  if (existingNames.has(rule.targetName)) {
    return { action: 'merge', targetName: rule.targetName, rule };
  }
  return { action: 'rename', targetName: rule.targetName, rule };
}

/**
 * @param {object|null} viewerRole
 * @param {object|null} salesExecutiveRole
 * @returns {{ strategy: 'rename_to_executive'|'reassign_to_read_only_role', readOnlyRoleName: string }}
 */
function resolveViewerMigrationStrategy(viewerRole, salesExecutiveRole) {
  if (!viewerRole) return { strategy: 'skip', readOnlyRoleName: 'Read Only' };
  if (!salesExecutiveRole) {
    return { strategy: 'rename_to_executive', readOnlyRoleName: 'Sales Executive' };
  }
  return { strategy: 'reassign_to_read_only_role', readOnlyRoleName: 'Read Only' };
}

function mapLegacyUserEnumToRoleName(legacyEnum) {
  const value = String(legacyEnum || '').trim().toLowerCase();
  if (value === 'owner') return 'Owner';
  if (value === 'admin') return 'Administrator';
  if (value === 'manager') return 'Sales Manager';
  if (value === 'user') return 'Sales Executive';
  if (value === 'viewer') return 'Viewer';
  return null;
}

function buildEntitlementsForRoleTier(roleName, organization, options = {}) {
  const name = normalizeRoleName(roleName).toLowerCase();
  if (name === 'owner' || name === 'administrator' || name === 'admin') {
    const seatConsuming = name !== 'owner';
    return buildEntitlementsAllApps(organization, 'ADMIN', seatConsuming);
  }
  if (name === 'sales manager' || name === 'manager') {
    return buildAppEntitlementsForOrg(organization, { salesRoleKey: 'MANAGER' });
  }
  return buildAppEntitlementsForOrg(organization, { salesRoleKey: options.appRoleKey || 'USER' });
}

function applyRoleV2Backfill(role, profileIdByKey, organization, rule = null) {
  const updates = {};
  const profileKey = rule?.profileKey;
  if (profileKey && profileIdByKey[profileKey]) {
    updates.privilegeMode = 'profile';
    updates.profileId = profileIdByKey[profileKey];
  } else if (!role.privilegeMode) {
    updates.privilegeMode = 'inline';
  }

  if (rule?.isSystemRole !== undefined) updates.isSystemRole = rule.isSystemRole;
  if (rule?.isTemplateSeed !== undefined) updates.isTemplateSeed = rule.isTemplateSeed;

  Object.assign(updates, ZERO_LEGACY_ROLE_CAPABILITIES);

  if (!Array.isArray(role.appEntitlements) || role.appEntitlements.length === 0) {
    updates.appEntitlements = buildEntitlementsForRoleTier(
      rule?.targetName || role.name,
      organization,
      { appRoleKey: rule?.appRoleKey }
    );
  }

  if (!role.userType) updates.userType = 'INTERNAL';
  if (!role.recordAssignment) {
    updates.recordAssignment = {
      users: 'same_role_or_hierarchy',
      groups: 'member_groups',
      selectedGroupIds: []
    };
  }

  return updates;
}

function createEmptyMigrationStats() {
  return {
    profilesCreated: 0,
    profilesSkipped: 0,
    rolesRenamed: [],
    rolesMerged: [],
    rolesCreated: [],
    rolesUpdated: 0,
    rolesDeleted: [],
    usersUpdated: 0,
    usersReassigned: 0,
    hierarchyLevelsRecalculated: false,
    sharingSeeded: false,
    flagsUpdated: false,
    skipped: false,
    reason: null
  };
}

/**
 * @param {string|import('mongoose').Types.ObjectId} organizationId
 * @param {{
 *   dryRun?: boolean,
 *   enableRbac?: boolean,
 *   enableSharing?: boolean,
 *   OrganizationModel?: typeof Organization,
 *   RoleModel?: typeof Role,
 *   ProfileModel?: typeof Profile,
 *   UserModel?: typeof User
 * }} [options]
 */
async function migrateOrganizationRbacV2(organizationId, options = {}) {
  const dryRun = options.dryRun === true;
  const OrganizationModel = options.OrganizationModel || Organization;
  const RoleModel = options.RoleModel || Role;
  const ProfileModel = options.ProfileModel || Profile;
  const UserModel = options.UserModel || User;

  const stats = createEmptyMigrationStats();
  const organization = await OrganizationModel.findById(organizationId);
  if (!organization) {
    stats.skipped = true;
    stats.reason = 'organization_not_found';
    return stats;
  }
  if (!organization.isTenant) {
    stats.skipped = true;
    stats.reason = 'not_tenant_organization';
    return stats;
  }

  const orgId = organization._id;
  const log = (message) => {
    if (options.logger) options.logger(message);
  };

  const profileSeed = await seedSystemProfiles(orgId, ProfileModel);
  stats.profilesCreated = profileSeed.created.length;
  stats.profilesSkipped = profileSeed.skipped;

  const profiles = await ProfileModel.find({ organizationId: orgId }).select('_id profileKey name').lean();
  const profileIdByKey = {};
  for (const profile of profiles) {
    if (profile.profileKey) profileIdByKey[profile.profileKey] = profile._id;
  }

  let roles = await RoleModel.find({ organizationId: orgId });
  const rolesByName = new Map(roles.map((r) => [normalizeRoleName(r.name), r]));
  const rolesById = new Map(roles.map((r) => [String(r._id), r]));

  const existingNames = roleNameSet(roles);

  for (const [legacyName, rule] of Object.entries(LEGACY_ROLE_RENAME_RULES)) {
    const role = rolesByName.get(legacyName);
    if (!role) continue;

    const resolution = resolveLegacyRoleRename(legacyName, existingNames);
    if (resolution.action === 'skip') continue;

    if (resolution.action === 'rename') {
      log(`  Rename role ${legacyName} → ${resolution.targetName}`);
      if (!dryRun) {
        role.name = resolution.targetName;
        Object.assign(role, applyRoleV2Backfill(role, profileIdByKey, organization, resolution.rule));
        await role.save();
      }
      stats.rolesRenamed.push({ from: legacyName, to: resolution.targetName });
      rolesByName.delete(legacyName);
      rolesByName.set(resolution.targetName, role);
      existingNames.delete(legacyName);
      existingNames.add(resolution.targetName);
      continue;
    }

    if (resolution.action === 'merge') {
      log(`  Merge users from legacy ${legacyName} → ${resolution.targetName}`);
      const targetRole = rolesByName.get(resolution.targetName);
      const usersOnLegacy = await UserModel.find({ organizationId: orgId, roleId: role._id }).select('_id');
      stats.usersReassigned += usersOnLegacy.length;

      if (!dryRun) {
        if (usersOnLegacy.length) {
          await UserModel.updateMany(
            { organizationId: orgId, roleId: role._id },
            { $set: { roleId: targetRole._id, role: mapRoleNameToLegacyEnum(targetRole.name) } }
          );
          await RoleModel.findByIdAndUpdate(targetRole._id, { $inc: { userCount: usersOnLegacy.length } });
          await RoleModel.findByIdAndUpdate(role._id, { $inc: { userCount: -usersOnLegacy.length } });
        }
        Object.assign(targetRole, applyRoleV2Backfill(targetRole, profileIdByKey, organization, resolution.rule));
        await targetRole.save();
        await role.deleteOne();
      }

      stats.rolesMerged.push({ from: legacyName, to: resolution.targetName, users: usersOnLegacy.length });
      stats.rolesDeleted.push(legacyName);
      rolesByName.delete(legacyName);
      rolesById.delete(String(role._id));
    }
  }

  roles = await RoleModel.find({ organizationId: orgId });
  const refreshedByName = new Map(roles.map((r) => [normalizeRoleName(r.name), r]));

  const ownerRole = refreshedByName.get('Owner');
  const adminRole = refreshedByName.get('Administrator') || refreshedByName.get('Admin');
  const managerRole = refreshedByName.get('Sales Manager') || refreshedByName.get('Manager');
  let executiveRole = refreshedByName.get('Sales Executive') || refreshedByName.get('User');
  const viewerRole = refreshedByName.get('Viewer');

  if (ownerRole && !dryRun) {
    const ownerUpdates = applyRoleV2Backfill(ownerRole, profileIdByKey, organization, {
      targetName: 'Owner',
      profileKey: SYSTEM_PROFILE_KEYS.PLATFORM_FULL,
      privileged: true,
      isSystemRole: true,
      appRoleKey: 'ADMIN'
    });
    Object.assign(ownerRole, ownerUpdates);
    await ownerRole.save();
    stats.rolesUpdated += 1;
  }

  if (adminRole && !dryRun) {
    const adminUpdates = applyRoleV2Backfill(adminRole, profileIdByKey, organization, LEGACY_ROLE_RENAME_RULES.Admin);
    Object.assign(adminRole, adminUpdates);
    if (ownerRole) {
      adminRole.parentRole = ownerRole._id;
      adminRole.level = 1;
    }
    await adminRole.save();
    stats.rolesUpdated += 1;
  }

  if (managerRole && !dryRun) {
    const managerUpdates = applyRoleV2Backfill(managerRole, profileIdByKey, organization, LEGACY_ROLE_RENAME_RULES.Manager);
    Object.assign(managerRole, managerUpdates);
    if (adminRole || ownerRole) {
      managerRole.parentRole = (adminRole || ownerRole)._id;
      managerRole.level = adminRole ? 2 : 1;
    }
    await managerRole.save();
    stats.rolesUpdated += 1;
  }

  if (executiveRole && !dryRun) {
    const executiveUpdates = applyRoleV2Backfill(executiveRole, profileIdByKey, organization, LEGACY_ROLE_RENAME_RULES.User);
    Object.assign(executiveRole, executiveUpdates);
    if (managerRole) {
      executiveRole.parentRole = managerRole._id;
      executiveRole.level = (managerRole.level || 2) + 1;
    } else if (adminRole || ownerRole) {
      executiveRole.parentRole = (adminRole || ownerRole)._id;
      executiveRole.level = adminRole ? 3 : 2;
    }
    await executiveRole.save();
    stats.rolesUpdated += 1;
  }

  const viewerStrategy = resolveViewerMigrationStrategy(viewerRole, executiveRole);
  if (viewerRole && viewerStrategy.strategy !== 'skip') {
    const readOnlyProfileId = profileIdByKey[SYSTEM_PROFILE_KEYS.READ_ONLY];
    const viewerUsers = await UserModel.find({ organizationId: orgId, roleId: viewerRole._id }).select('_id');

    if (viewerStrategy.strategy === 'rename_to_executive') {
      log('  Dissolve Viewer → Sales Executive with read_only profile');
      if (!dryRun) {
        viewerRole.name = 'Sales Executive';
        viewerRole.privilegeMode = 'profile';
        viewerRole.profileId = readOnlyProfileId;
        viewerRole.isTemplateSeed = true;
        viewerRole.appEntitlements = buildEntitlementsForRoleTier('Sales Executive', organization);
        viewerRole.userType = 'INTERNAL';
        if (managerRole) {
          viewerRole.parentRole = managerRole._id;
          viewerRole.level = (managerRole.level || 2) + 1;
        } else if (adminRole) {
          viewerRole.parentRole = adminRole._id;
          viewerRole.level = (adminRole.level || 1) + 1;
        }
        await viewerRole.save();
        executiveRole = viewerRole;
      }
      stats.rolesRenamed.push({ from: 'Viewer', to: 'Sales Executive', profile: SYSTEM_PROFILE_KEYS.READ_ONLY });
    } else {
      log('  Dissolve Viewer → Read Only role (read_only profile)');
      let readOnlyRole = refreshedByName.get('Read Only');
      if (!readOnlyRole && !dryRun) {
        readOnlyRole = await RoleModel.create({
          organizationId: orgId,
          name: 'Read Only',
          description: 'Read-only access (migrated from Viewer)',
          isSystemRole: false,
          isTemplateSeed: true,
          level: adminRole ? (adminRole.level || 1) + 1 : 2,
          parentRole: adminRole?._id || ownerRole?._id || null,
          userType: 'INTERNAL',
          privilegeMode: 'profile',
          profileId: readOnlyProfileId,
          appEntitlements: buildEntitlementsForRoleTier('Sales Executive', organization),
          color: '#6b7280',
          icon: 'eye',
          canViewAllData: false,
          canManageTeam: false,
          canExportData: false,
          recordAssignment: {
            users: 'same_role_or_hierarchy',
            groups: 'member_groups',
            selectedGroupIds: []
          }
        });
        stats.rolesCreated.push('Read Only');
      }

      if (!dryRun && viewerUsers.length) {
        await UserModel.updateMany(
          { organizationId: orgId, roleId: viewerRole._id },
          { $set: { roleId: readOnlyRole._id, role: mapRoleNameToLegacyEnum(readOnlyRole.name) } }
        );
        await RoleModel.findByIdAndUpdate(readOnlyRole._id, { $inc: { userCount: viewerUsers.length } });
        await RoleModel.findByIdAndUpdate(viewerRole._id, { $inc: { userCount: -viewerUsers.length } });
        await viewerRole.deleteOne();
      }

      stats.usersReassigned += viewerUsers.length;
      stats.rolesDeleted.push('Viewer');
    }
  }

  if (!dryRun) {
    await repairStandardRoleHierarchy(orgId, { RoleModel });
    await recalculateOrganizationRoleLevels(orgId);
    stats.hierarchyLevelsRecalculated = true;
  }

  const finalRoles = await RoleModel.find({ organizationId: orgId }).lean();
  const finalRoleById = new Map(finalRoles.map((r) => [String(r._id), r]));
  const finalRoleByName = new Map(finalRoles.map((r) => [normalizeRoleName(r.name), r]));

  const users = await UserModel.find({ organizationId: orgId });
  for (const user of users) {
    let changed = false;

    if (!user.roleId) {
      const mappedName = mapLegacyUserEnumToRoleName(user.role);
      const fallbackRole = mappedName ? finalRoleByName.get(mappedName) : null;
      if (fallbackRole) {
        if (!dryRun) user.roleId = fallbackRole._id;
        changed = true;
        stats.usersReassigned += 1;
      }
    }

    const roleLean = user.roleId ? finalRoleById.get(String(user.roleId)) : null;
    if (roleLean) {
      const derived = deriveAppAccessFromRole(roleLean, organization);
      if (!dryRun) {
        user.appAccess = derived.appAccess;
        user.allowedApps = derived.allowedApps;
        user.role = mapRoleNameToLegacyEnum(roleLean.name);
        if (!user.userType) user.userType = 'INTERNAL';
        await hydrateUserPermissionsFromRole(user);
        await user.save();
      }
      changed = true;
    }

    if (changed) stats.usersUpdated += 1;
  }

  if (options.enableSharing && !dryRun) {
    const { seedSharingDefaultsForOrganization } = require('./sharingSeedService');
    await seedSharingDefaultsForOrganization(orgId, organization);
    stats.sharingSeeded = true;
  }

  if ((options.enableRbac || options.enableSharing) && !dryRun) {
    if (options.enableRbac) organization.settings.rbacV2Enabled = true;
    if (options.enableSharing) organization.settings.sharingV1Enabled = true;
    organization.markModified('settings');
    await organization.save();
    stats.flagsUpdated = true;
  }

  return stats;
}

module.exports = {
  LEGACY_ROLE_RENAME_RULES,
  resolveLegacyRoleRename,
  resolveViewerMigrationStrategy,
  mapLegacyUserEnumToRoleName,
  applyRoleV2Backfill,
  migrateOrganizationRbacV2,
  createEmptyMigrationStats
};
