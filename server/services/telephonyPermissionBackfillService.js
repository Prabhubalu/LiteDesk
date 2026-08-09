'use strict';

const User = require('../models/User');

function defaultTelephonyPermissionsForUser(user) {
  if (user?.isOwner === true) {
    return {
      view: true,
      call: true,
      listen: true,
      download: true,
      manage: true,
      admin: true,
      ai: true,
    };
  }

  const role = String(user?.role || '').toLowerCase();
  if (role === 'owner' || role === 'admin') {
    return {
      view: true,
      call: true,
      listen: true,
      download: true,
      manage: true,
      admin: true,
      ai: true,
    };
  }
  if (role === 'manager') {
    return {
      view: true,
      call: true,
      listen: true,
      download: true,
      manage: true,
      admin: false,
      ai: true,
    };
  }
  return {
    view: true,
    call: true,
    listen: true,
    download: false,
    manage: false,
    admin: false,
    ai: false,
  };
}

/**
 * Backfill permissions.telephony for existing users after addon install.
 */
async function backfillTelephonyUserPermissions(organizationId) {
  if (!organizationId) return { updated: 0 };

  const users = await User.find({
    organizationId,
    $or: [{ status: 'active' }, { status: { $exists: false } }, { status: null }],
  })
    .select('_id role isOwner permissions.telephony')
    .lean();

  const ops = [];
  for (const user of users) {
    const telephony = user.permissions?.telephony;
    if (telephony && telephony.view === true) {
      continue;
    }
    ops.push({
      updateOne: {
        filter: { _id: user._id },
        update: {
          $set: {
            'permissions.telephony': defaultTelephonyPermissionsForUser(user),
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
  backfillTelephonyUserPermissions,
  defaultTelephonyPermissionsForUser,
};
