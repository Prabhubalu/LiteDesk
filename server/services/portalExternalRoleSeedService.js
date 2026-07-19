'use strict';

/**
 * Idempotent seed of external portal roles + dependent system profiles.
 * @see docs/architecture/RBAC_PROFILES_SHARING.md §8.4
 */

const Role = require('../models/Role');
const { SYSTEM_PROFILE_KEYS } = require('../permissions/profileKeys');
const {
  seedSystemProfiles,
  getProfileIdByKey,
  syncSystemProfilePermissions,
  forceSyncPortalSystemProfiles
} = require('./roleSeedService');
const { isPortalFrameworkV1Enabled } = require('../utils/portalFeatureFlags');
const { isAppEnabledForOrg } = require('../utils/appAccessUtils');
const { APP_KEYS } = require('../constants/appKeys');

const EXTERNAL_ROLE_TEMPLATES = [
  {
    name: 'Portal Customer',
    description: 'Default external portal — Support, Help, and Documents access',
    userType: 'EXTERNAL',
    parentName: null,
    profileKey: SYSTEM_PROFILE_KEYS.PORTAL_CUSTOMER,
    appEntitlements: [{
      appKey: APP_KEYS.PORTAL,
      enabled: true,
      seatConsuming: false,
      appRoleKey: 'CUSTOMER'
    }],
    level: 20,
    color: '#0ea5e9',
    icon: 'globe-alt',
    isTemplateSeed: true
  },
  {
    name: 'Portal Viewer',
    description: 'Read-only external portal access',
    userType: 'EXTERNAL',
    parentName: 'Portal Customer',
    profileKey: SYSTEM_PROFILE_KEYS.PORTAL_VIEWER,
    appEntitlements: [{
      appKey: APP_KEYS.PORTAL,
      enabled: true,
      seatConsuming: false,
      appRoleKey: 'VIEWER'
    }],
    level: 21,
    color: '#64748b',
    icon: 'eye',
    isTemplateSeed: true
  },
  {
    name: 'External Auditor',
    description: 'External auditor portal access for assigned audit work',
    userType: 'EXTERNAL',
    parentName: null,
    profileKey: SYSTEM_PROFILE_KEYS.AUDIT_AUDITOR,
    appEntitlements: [{
      appKey: APP_KEYS.AUDIT,
      enabled: true,
      seatConsuming: false,
      appRoleKey: 'AUDITOR'
    }],
    level: 20,
    color: '#f59e0b',
    icon: 'clipboard-document-check',
    isTemplateSeed: true
  }
];

function shouldSeedPortalRoles(organization) {
  return isPortalFrameworkV1Enabled(organization)
    || isAppEnabledForOrg(organization, APP_KEYS.PORTAL);
}

function shouldSeedExternalAuditorRole(organization) {
  return isPortalFrameworkV1Enabled(organization)
    || isAppEnabledForOrg(organization, APP_KEYS.AUDIT);
}

function filterTemplatesForOrganization(organization) {
  return EXTERNAL_ROLE_TEMPLATES.filter((template) => {
    if (template.name === 'External Auditor') {
      return shouldSeedExternalAuditorRole(organization);
    }
    return shouldSeedPortalRoles(organization);
  });
}

/**
 * @param {string|import('mongoose').Types.ObjectId} organizationId
 * @param {object|null} [organization]
 */
async function ensureExternalPortalRolesForOrganization(organizationId, organization = null) {
  if (!organizationId) {
    return { created: 0, skipped: 0, roles: [] };
  }

  let org = organization;
  if (!org) {
    const Organization = require('../models/Organization');
    org = await Organization.findById(organizationId)
      .select('enabledApps settings')
      .lean();
  }
  if (!org) {
    return { created: 0, skipped: 0, roles: [] };
  }

  const templates = filterTemplatesForOrganization(org);
  if (!templates.length) {
    return { created: 0, skipped: 0, roles: [] };
  }

  await seedSystemProfiles(organizationId);
  await syncSystemProfilePermissions(organizationId);
  await forceSyncPortalSystemProfiles(organizationId);

  const existing = await Role.find({ organizationId, userType: 'EXTERNAL' })
    .select('name parentRole isTemplateSeed')
    .lean();
  const existingByName = new Map(existing.map((row) => [String(row.name || '').trim(), row]));

  const createdRoles = [];
  let created = 0;
  let skipped = 0;

  for (const template of templates) {
    const existingRole = existingByName.get(template.name);
    if (existingRole) {
      if (existingRole.isTemplateSeed === true) {
        const profileId = await getProfileIdByKey(organizationId, template.profileKey);
        await Role.findByIdAndUpdate(existingRole._id, {
          $set: {
            description: template.description,
            profileId,
            privilegeMode: 'profile',
            appEntitlements: template.appEntitlements,
            color: template.color,
            icon: template.icon,
            canViewAllData: false,
            canManageTeam: false,
            canExportData: false
          }
        });
      }
      skipped += 1;
      continue;
    }

    const profileId = await getProfileIdByKey(organizationId, template.profileKey);
    const doc = await Role.create({
      organizationId,
      name: template.name,
      description: template.description,
      userType: template.userType,
      parentRole: null,
      profileId,
      privilegeMode: 'profile',
      appEntitlements: template.appEntitlements,
      level: template.level,
      color: template.color,
      icon: template.icon,
      isSystemRole: false,
      isTemplateSeed: template.isTemplateSeed,
      canViewAllData: false,
      canManageTeam: false,
      canExportData: false
    });
    existingByName.set(template.name, doc);
    createdRoles.push(doc);
    created += 1;
  }

  for (const template of templates) {
    if (!template.parentName) continue;
    const child = existingByName.get(template.name);
    const parent = existingByName.get(template.parentName);
    if (!child || !parent) continue;
    if (child.parentRole && String(child.parentRole) === String(parent._id)) continue;
    await Role.findByIdAndUpdate(child._id, {
      $set: {
        parentRole: parent._id,
        level: template.level
      }
    });
  }

  const roles = await Role.find({
    organizationId,
    userType: 'EXTERNAL',
    name: { $in: templates.map((t) => t.name) }
  })
    .select('_id name description color icon userType appEntitlements profileId parentRole level')
    .populate('profileId', 'name profileKey')
    .sort({ level: 1, name: 1 })
    .lean();

  return { created, skipped, roles };
}

async function listExternalRolesForOrganization(organizationId, organization = null) {
  const result = await ensureExternalPortalRolesForOrganization(organizationId, organization);
  return result.roles;
}

module.exports = {
  EXTERNAL_ROLE_TEMPLATES,
  ensureExternalPortalRolesForOrganization,
  listExternalRolesForOrganization,
  shouldSeedPortalRoles,
  shouldSeedExternalAuditorRole,
  filterTemplatesForOrganization
};
