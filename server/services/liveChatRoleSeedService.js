const Role = require('../models/Role');

const LIVE_CHAT_ROLE_TEMPLATES = [
  {
    name: 'Chat Administrator',
    description: 'Full Live Chat configuration and session administration',
    isSystemRole: true,
    isTemplateSeed: true,
    level: 1,
    color: '#7c3aed',
    icon: 'shield',
    permissions: {
      liveChat: { view: true, reply: true, admin: true },
    },
    canViewAllData: true,
    canManageTeam: true,
    canExportData: false,
  },
  {
    name: 'Chat Supervisor',
    description: 'Monitor queues and assist agents with Live Chat sessions',
    isSystemRole: false,
    isTemplateSeed: true,
    level: 2,
    color: '#2563eb',
    icon: 'users',
    permissions: {
      liveChat: { view: true, reply: true, admin: false },
    },
    canViewAllData: true,
    canManageTeam: false,
    canExportData: false,
  },
  {
    name: 'Chat Agent',
    description: 'Handle visitor Live Chat sessions and replies',
    isSystemRole: false,
    isTemplateSeed: true,
    level: 3,
    color: '#059669',
    icon: 'user',
    permissions: {
      liveChat: { view: true, reply: true, admin: false },
    },
    canViewAllData: false,
    canManageTeam: false,
    canExportData: false,
  },
];

/**
 * Idempotent seed of Live Chat role templates when the addon is installed.
 */
async function seedLiveChatRolesForOrganization(organizationId) {
  if (!organizationId) return { created: 0, skipped: 0 };

  const existing = await Role.find({ organizationId })
    .select('name')
    .lean();
  const existingNames = new Set(existing.map((row) => String(row.name || '').trim()));

  const toInsert = LIVE_CHAT_ROLE_TEMPLATES.filter(
    (template) => !existingNames.has(template.name),
  ).map((template) => ({
    organizationId,
    ...template,
  }));

  if (!toInsert.length) {
    return { created: 0, skipped: LIVE_CHAT_ROLE_TEMPLATES.length };
  }

  await Role.insertMany(toInsert);
  return { created: toInsert.length, skipped: LIVE_CHAT_ROLE_TEMPLATES.length - toInsert.length };
}

function roleShouldReceiveLiveChatPermissions(role) {
  const name = String(role?.name || '').trim();
  if (name.startsWith('Chat ')) return true;
  if (['Owner', 'Admin', 'Administrator', 'Manager', 'User'].includes(name)) return true;

  const lc = role?.permissions?.liveChat;
  if (lc && (lc.view === true || lc.reply === true || lc.admin === true)) return true;

  return role?.permissions?.cases?.read === true;
}

/**
 * Ensure existing tenant roles used by agents include liveChat view/reply.
 */
async function patchLiveChatPermissionsOnOrganizationRoles(organizationId) {
  if (!organizationId) return { updated: 0 };

  const roles = await Role.find({ organizationId }).select('name permissions').lean();
  const ops = [];

  for (const role of roles) {
    if (!roleShouldReceiveLiveChatPermissions(role)) continue;

    const lc = role.permissions?.liveChat || {};
    const hasView = lc.view === true || lc.sessions?.view === true;
    const hasReply = lc.reply === true || lc.sessions?.reply === true;
    if (hasView && hasReply) continue;

    const name = String(role.name || '').trim();
    const admin = lc.admin === true || name === 'Chat Administrator' || ['Owner', 'Admin', 'Administrator'].includes(name);

    ops.push({
      updateOne: {
        filter: { _id: role._id },
        update: {
          $set: {
            'permissions.liveChat': {
              view: true,
              reply: true,
              admin,
            },
          },
        },
      },
    });
  }

  if (!ops.length) return { updated: 0 };

  const result = await Role.bulkWrite(ops, { ordered: false });
  return { updated: result.modifiedCount || ops.length };
}

module.exports = {
  seedLiveChatRolesForOrganization,
  patchLiveChatPermissionsOnOrganizationRoles,
  LIVE_CHAT_ROLE_TEMPLATES,
};
