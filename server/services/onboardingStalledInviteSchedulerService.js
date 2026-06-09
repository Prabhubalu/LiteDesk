'use strict';

const Organization = require('../models/Organization');
const User = require('../models/User');
const dbConnectionManager = require('../utils/databaseConnectionManager');
const { runWithTenantContext } = require('../utils/tenantContext');
const { notifyInviterStalledInvite } = require('./onboardingInviteNotifications');

const STALL_DAYS = 3;

function resolveUserModel(connection) {
  return connection?.models?.User || User;
}

/**
 * Notify inviters when pending invites are older than STALL_DAYS.
 * @returns {Promise<{ tenantsProcessed: number, notified: number, errors: number }>}
 */
async function tickStalledInviteNotifications() {
  const cutoff = new Date(Date.now() - STALL_DAYS * 24 * 60 * 60 * 1000);

  const tenants = await Organization.find({
    isTenant: true,
    isActive: true,
    'database.name': { $exists: true, $nin: [null, ''] }
  })
    .select('_id database.name')
    .lean();

  let tenantsProcessed = 0;
  let notified = 0;
  let errors = 0;

  for (const tenant of tenants) {
    const dbName = tenant.database?.name;
    if (!dbName) continue;

    let conn;
    try {
      conn = await dbConnectionManager.getOrganizationConnection(dbName);
      if (conn.readyState !== 1) await conn.asPromise();
    } catch (err) {
      errors += 1;
      console.error(`[stalledInviteScheduler] tenant ${tenant._id} DB connect failed:`, err.message);
      continue;
    }

    try {
      await runWithTenantContext(
        { organizationId: tenant._id, connection: conn, databaseName: dbName },
        async () => {
          const ScopedUser = resolveUserModel(conn);
          const stalled = await ScopedUser.find({
            organizationId: tenant._id,
            status: 'invited',
            invitedAt: { $lte: cutoff },
            invitedBy: { $exists: true, $ne: null },
            stalledInviteNotifiedAt: { $exists: false }
          })
            .select('_id firstName lastName email invitedBy organizationId')
            .limit(50)
            .lean();

          for (const invitee of stalled) {
            try {
              await notifyInviterStalledInvite({
                inviterId: invitee.invitedBy,
                invitee,
                organizationId: tenant._id
              });
              await ScopedUser.updateOne(
                { _id: invitee._id, organizationId: tenant._id },
                { $set: { stalledInviteNotifiedAt: new Date() } }
              );
              notified += 1;
            } catch (err) {
              errors += 1;
              console.error('[stalledInviteScheduler] notify failed:', err.message);
            }
          }
        }
      );
      tenantsProcessed += 1;
    } catch (err) {
      errors += 1;
      console.error(`[stalledInviteScheduler] tenant ${tenant._id} failed:`, err.message);
    }
  }

  return { tenantsProcessed, notified, errors };
}

module.exports = {
  tickStalledInviteNotifications,
  STALL_DAYS
};
