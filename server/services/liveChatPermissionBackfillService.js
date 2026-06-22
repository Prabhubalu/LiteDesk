const User = require('../models/User');

function defaultLiveChatPermissionsForUser(user) {
  if (user?.isOwner === true) {
    return { view: true, reply: true, admin: true };
  }

  const role = String(user?.role || '').toLowerCase();
  if (role === 'owner' || role === 'admin') {
    return { view: true, reply: true, admin: true };
  }
  if (role === 'manager') {
    return { view: true, reply: true, admin: false };
  }
  return { view: true, reply: true, admin: false };
}

/**
 * Backfill permissions.liveChat for existing users after addon install.
 * Skips users that already have liveChat permissions materialized.
 */
async function backfillLiveChatUserPermissions(organizationId) {
  if (!organizationId) return { updated: 0 };

  const users = await User.find({
    organizationId,
    $or: [{ status: 'active' }, { status: { $exists: false } }, { status: null }],
  })
    .select('_id role isOwner permissions.liveChat')
    .lean();

  const ops = [];
  for (const user of users) {
    const liveChat = user.permissions?.liveChat;
    if (
      liveChat
      && (liveChat.view === true || liveChat.reply === true || liveChat.admin === true)
    ) {
      continue;
    }
    ops.push({
      updateOne: {
        filter: { _id: user._id },
        update: {
          $set: {
            'permissions.liveChat': defaultLiveChatPermissionsForUser(user),
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
  backfillLiveChatUserPermissions,
  defaultLiveChatPermissionsForUser,
};
