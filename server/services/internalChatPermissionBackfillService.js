'use strict';

const User = require('../models/User');
const Role = require('../models/Role');

function defaultInternalChatPermissionsForUser(user) {
  if (user?.isOwner === true) {
    return { view: true, manage: true, admin: true };
  }
  const role = String(user?.role || '').toLowerCase();
  if (role === 'owner' || role === 'admin') {
    return { view: true, manage: true, admin: true };
  }
  if (role === 'manager') {
    return { view: true, manage: true, admin: false };
  }
  return { view: true, manage: false, admin: false };
}

const DISABLED_INTERNAL_CHAT = { view: false, manage: false, admin: false };

async function patchInternalChatPermissionsOnOrganizationRoles(organizationId) {
  if (!organizationId) return { updated: 0 };

  // Staff roles only — never grant internal chat on EXTERNAL portal roles.
  const roles = await Role.find({
    organizationId,
    userType: { $nin: ['EXTERNAL', 'external'] },
  }).select('name permissions userType').lean();
  const ops = [];

  for (const role of roles) {
    const name = String(role?.name || '').trim();
    const privileged = ['Owner', 'Admin', 'Administrator'].includes(name);
    const manager = name === 'Manager';
    const existing = role.permissions?.internalChat;
    if (existing?.view === true) continue;

    let next;
    if (privileged) {
      next = { view: true, manage: true, admin: true };
    } else if (manager) {
      next = { view: true, manage: true, admin: false };
    } else {
      next = { view: true, manage: false, admin: false };
    }

    ops.push({
      updateOne: {
        filter: { _id: role._id },
        update: { $set: { 'permissions.internalChat': next } },
      },
    });
  }

  if (!ops.length) return { updated: 0 };
  const result = await Role.bulkWrite(ops, { ordered: false });
  return { updated: result.modifiedCount || ops.length };
}

async function backfillInternalChatUserPermissions(organizationId) {
  if (!organizationId) return { updated: 0 };

  const users = await User.find({
    organizationId,
    $or: [{ status: 'active' }, { status: { $exists: false } }, { status: null }],
  })
    .select('_id role isOwner userType permissions.internalChat')
    .lean();

  const ops = [];
  for (const user of users) {
    const isExternal = String(user?.userType || 'INTERNAL').toUpperCase() === 'EXTERNAL';
    if (isExternal) {
      const internalChat = user.permissions?.internalChat;
      if (
        internalChat
        && internalChat.view !== true
        && internalChat.manage !== true
        && internalChat.admin !== true
      ) {
        continue;
      }
      ops.push({
        updateOne: {
          filter: { _id: user._id },
          update: { $set: { 'permissions.internalChat': DISABLED_INTERNAL_CHAT } },
        },
      });
      continue;
    }

    const internalChat = user.permissions?.internalChat;
    if (internalChat && internalChat.view === true) continue;

    ops.push({
      updateOne: {
        filter: { _id: user._id },
        update: {
          $set: {
            'permissions.internalChat': defaultInternalChatPermissionsForUser(user),
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
  defaultInternalChatPermissionsForUser,
  patchInternalChatPermissionsOnOrganizationRoles,
  backfillInternalChatUserPermissions,
};
