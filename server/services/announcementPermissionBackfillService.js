const User = require('../models/User');
const Role = require('../models/Role');

function defaultAnnouncementPermissionsForUser(user) {
  if (user?.isOwner === true) {
    return { view: true, manage: true, publish: true, analytics: true };
  }
  const role = String(user?.role || '').toLowerCase();
  if (role === 'owner' || role === 'admin') {
    return { view: true, manage: true, publish: true, analytics: true };
  }
  if (role === 'manager') {
    return { view: true, manage: true, publish: false, analytics: true };
  }
  return { view: false, manage: false, publish: false, analytics: false };
}

async function patchAnnouncementPermissionsOnOrganizationRoles(organizationId) {
  if (!organizationId) return { updated: 0 };

  const roles = await Role.find({ organizationId }).select('name permissions').lean();
  const ops = [];

  for (const role of roles) {
    const name = String(role?.name || '').trim();
    const privileged = ['Owner', 'Admin', 'Administrator'].includes(name);
    const manager = name === 'Manager';
    if (!privileged && !manager) continue;

    const existing = role.permissions?.announcements;
    if (existing?.view === true && existing?.manage === true) continue;

    ops.push({
      updateOne: {
        filter: { _id: role._id },
        update: {
          $set: {
            'permissions.announcements': privileged
              ? { view: true, manage: true, publish: true, analytics: true }
              : { view: true, manage: true, publish: false, analytics: true },
          },
        },
      },
    });
  }

  if (!ops.length) return { updated: 0 };
  const result = await Role.bulkWrite(ops, { ordered: false });
  return { updated: result.modifiedCount || ops.length };
}

async function backfillAnnouncementUserPermissions(organizationId) {
  if (!organizationId) return { updated: 0 };

  const users = await User.find({
    organizationId,
    $or: [{ status: 'active' }, { status: { $exists: false } }, { status: null }],
  })
    .select('_id role isOwner permissions.announcements')
    .lean();

  const ops = [];
  for (const user of users) {
    const announcements = user.permissions?.announcements;
    if (announcements && announcements.view === true) continue;

    ops.push({
      updateOne: {
        filter: { _id: user._id },
        update: {
          $set: {
            'permissions.announcements': defaultAnnouncementPermissionsForUser(user),
          },
        },
      },
    });
  }

  if (!ops.length) return { updated: 0 };
  const result = await User.bulkWrite(ops, { ordered: false });
  return { updated: result.modifiedCount || ops.length };
}

module.exports = {
  patchAnnouncementPermissionsOnOrganizationRoles,
  backfillAnnouncementUserPermissions,
  defaultAnnouncementPermissionsForUser,
};
