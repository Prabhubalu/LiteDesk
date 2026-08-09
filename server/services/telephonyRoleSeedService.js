'use strict';

const Role = require('../models/Role');

const TELEPHONY_ROLE_TEMPLATES = [
  {
    name: 'Telephony Administrator',
    description: 'Full Telephony configuration, recordings, and agent administration',
    isSystemRole: true,
    isTemplateSeed: true,
    level: 1,
    color: '#0ea5e9',
    icon: 'phone',
    permissions: {
      telephony: {
        view: true,
        call: true,
        listen: true,
        download: true,
        manage: true,
        admin: true,
        ai: true,
      },
    },
    canViewAllData: true,
    canManageTeam: true,
    canExportData: true,
  },
  {
    name: 'Telephony Supervisor',
    description: 'Monitor queues, listen to recordings, and coach agents',
    isSystemRole: false,
    isTemplateSeed: true,
    level: 2,
    color: '#2563eb',
    icon: 'users',
    permissions: {
      telephony: {
        view: true,
        call: true,
        listen: true,
        download: true,
        manage: true,
        admin: false,
        ai: true,
      },
    },
    canViewAllData: true,
    canManageTeam: false,
    canExportData: true,
  },
  {
    name: 'Telephony Agent',
    description: 'Place and receive calls via softphone',
    isSystemRole: false,
    isTemplateSeed: true,
    level: 3,
    color: '#059669',
    icon: 'user',
    permissions: {
      telephony: {
        view: true,
        call: true,
        listen: true,
        download: false,
        manage: false,
        admin: false,
        ai: false,
      },
    },
    canViewAllData: false,
    canManageTeam: false,
    canExportData: false,
  },
];

async function seedTelephonyRolesForOrganization(organizationId) {
  if (!organizationId) return { created: 0, skipped: 0 };

  const existing = await Role.find({ organizationId }).select('name').lean();
  const existingNames = new Set(existing.map((row) => String(row.name || '').trim()));

  const toInsert = TELEPHONY_ROLE_TEMPLATES.filter(
    (template) => !existingNames.has(template.name),
  ).map((template) => ({
    organizationId,
    ...template,
  }));

  if (!toInsert.length) {
    return { created: 0, skipped: TELEPHONY_ROLE_TEMPLATES.length };
  }

  await Role.insertMany(toInsert);
  return {
    created: toInsert.length,
    skipped: TELEPHONY_ROLE_TEMPLATES.length - toInsert.length,
  };
}

function roleShouldReceiveTelephonyPermissions(role) {
  const name = String(role?.name || '').trim();
  if (name.startsWith('Telephony ')) return true;
  if (['Owner', 'Admin', 'Administrator', 'Manager', 'User'].includes(name)) return true;

  const tel = role?.permissions?.telephony;
  if (tel && tel.view === true) return true;

  return role?.permissions?.cases?.read === true || role?.permissions?.contacts?.read === true;
}

async function patchTelephonyPermissionsOnOrganizationRoles(organizationId) {
  if (!organizationId) return { updated: 0 };

  const roles = await Role.find({ organizationId }).select('name permissions').lean();
  const ops = [];

  for (const role of roles) {
    if (!roleShouldReceiveTelephonyPermissions(role)) continue;

    const tel = role.permissions?.telephony || {};
    const name = String(role.name || '').trim();
    const isAdmin =
      name === 'Owner'
      || name === 'Admin'
      || name === 'Administrator'
      || name === 'Telephony Administrator';

    const next = {
      view: true,
      call: true,
      listen: tel.listen !== false,
      download: isAdmin || tel.download === true,
      manage: isAdmin || name === 'Telephony Supervisor' || tel.manage === true,
      admin: isAdmin || tel.admin === true,
      ai: isAdmin || name === 'Telephony Supervisor' || tel.ai === true,
    };

    ops.push({
      updateOne: {
        filter: { _id: role._id },
        update: { $set: { 'permissions.telephony': next } },
      },
    });
  }

  if (!ops.length) return { updated: 0 };
  const result = await Role.bulkWrite(ops, { ordered: false });
  return { updated: result.modifiedCount || ops.length };
}

module.exports = {
  seedTelephonyRolesForOrganization,
  patchTelephonyPermissionsOnOrganizationRoles,
  TELEPHONY_ROLE_TEMPLATES,
};
