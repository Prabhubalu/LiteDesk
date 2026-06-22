#!/usr/bin/env node
'use strict';

/**
 * LC1 migration for tenants that installed live_chat before LC1 landed:
 * 1. Seed Chat Administrator / Supervisor / Agent role templates.
 * 2. Backfill permissions.liveChat on active users missing it.
 * 3. Assign sessionKey + visitorId on ChatSession rows created before LC1.
 *
 *   node scripts/migrateLiveChatLc1.js
 *   node scripts/migrateLiveChatLc1.js --dry-run
 *   node scripts/migrateLiveChatLc1.js --org-id=<ObjectId>
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Organization = require('../models/Organization');
const TenantAddonConfiguration = require('../models/TenantAddonConfiguration');
const OrganizationSubscription = require('../models/OrganizationSubscription');
const dbConnectionManager = require('../utils/databaseConnectionManager');
const { runWithTenantContext } = require('../utils/tenantContext');
const { ADDON_KEYS } = require('../constants/addonKeys');
const { findAddonSubscriptionEntry } = require('../utils/addonAccessUtils');
const { getMongoUris } = require('../lib/mongoConnect');
const { seedLiveChatRolesForOrganization, patchLiveChatPermissionsOnOrganizationRoles } = require('../services/liveChatRoleSeedService');
const { ensureDefaultQueue } = require('../services/liveChatQueueService');
const { backfillLiveChatUserPermissions } = require('../services/liveChatPermissionBackfillService');
const { allocateSessionKey } = require('../services/liveChatSessionKeyService');
const {
  resolveOrCreateVisitor,
  incrementVisitorSessionCount,
} = require('../services/liveChatVisitorService');

const dryRun = process.argv.includes('--dry-run');
const orgIdArg = process.argv.find((arg) => arg.startsWith('--org-id='));
const orgIdFilter = orgIdArg ? orgIdArg.split('=')[1]?.trim() : null;

function sessionNeedsLc1Fields(session) {
  const key = String(session.sessionKey || '').trim();
  return !key || !session.visitorId;
}

async function collectLiveChatOrgIds() {
  const fromConfig = await TenantAddonConfiguration.find({
    addonKey: ADDON_KEYS.LIVE_CHAT,
    archivedAt: { $in: [null, undefined] },
    enabled: { $ne: false },
  })
    .select('organizationId')
    .lean();

  const fromSubs = await OrganizationSubscription.find({
    'addons.addonKey': ADDON_KEYS.LIVE_CHAT,
  })
    .select('organizationId addons')
    .lean();

  const ids = new Set();
  for (const row of fromConfig) {
    if (row.organizationId) ids.add(String(row.organizationId));
  }
  for (const row of fromSubs) {
    const entry = findAddonSubscriptionEntry(row, ADDON_KEYS.LIVE_CHAT);
    if (entry && row.organizationId) ids.add(String(row.organizationId));
  }

  if (orgIdFilter) {
    if (!ids.has(String(orgIdFilter))) {
      console.warn(`[migrateLiveChatLc1] Org ${orgIdFilter} does not have live_chat installed.`);
      return [];
    }
    return [orgIdFilter];
  }

  return [...ids];
}

async function migrateTenantLc1(tenant) {
  const dbName = tenant.database?.name;
  if (!dbName) {
    return {
      roles: { created: 0, skipped: 0 },
      users: { updated: 0 },
      sessions: { migrated: 0, skipped: 0 },
      reason: 'no_db',
    };
  }

  const conn = await dbConnectionManager.getOrganizationConnection(dbName);
  if (conn.readyState !== 1) await conn.asPromise();

  return runWithTenantContext(
    { organizationId: tenant._id, connection: conn, databaseName: dbName },
    async () => {
      let roleStats = { created: 0, skipped: 0 };
      let userStats = { updated: 0 };
      let sessionsMigrated = 0;
      let sessionsSkipped = 0;

      if (dryRun) {
        const Role = require('../models/Role');
        const existing = await Role.find({ organizationId: tenant._id }).select('name').lean();
        const names = new Set(existing.map((row) => row.name));
        const templates = ['Chat Administrator', 'Chat Supervisor', 'Chat Agent'];
        roleStats.created = templates.filter((name) => !names.has(name)).length;
        roleStats.skipped = templates.length - roleStats.created;

        const User = require('../models/User');
        userStats.updated = await User.countDocuments({
          organizationId: tenant._id,
          $and: [
            {
              $or: [{ status: 'active' }, { status: { $exists: false } }, { status: null }],
            },
            {
              $or: [
                { 'permissions.liveChat': { $exists: false } },
                { 'permissions.liveChat.view': { $exists: false } },
              ],
            },
          ],
        });

        const ChatSession = require('../models/ChatSession');
        sessionsMigrated = await ChatSession.countDocuments({
          $or: [
            { sessionKey: { $exists: false } },
            { sessionKey: null },
            { sessionKey: '' },
            { visitorId: { $exists: false } },
            { visitorId: null },
          ],
        });
      } else {
        roleStats = await seedLiveChatRolesForOrganization(tenant._id);
        await patchLiveChatPermissionsOnOrganizationRoles(tenant._id);
        userStats = await backfillLiveChatUserPermissions(tenant._id);
        await ensureDefaultQueue(tenant._id);

        const ChatSession = require('../models/ChatSession');
        const rows = await ChatSession.find({}).lean();

        for (const session of rows) {
          if (!sessionNeedsLc1Fields(session)) {
            sessionsSkipped += 1;
            continue;
          }

          const updates = {};
          if (!String(session.sessionKey || '').trim()) {
            updates.sessionKey = await allocateSessionKey(tenant._id);
          }
          if (!session.channel) {
            updates.channel = 'web';
          }
          if (!session.visitorId) {
            const visitorId = await resolveOrCreateVisitor({
              organizationId: tenant._id,
              visitor: session.visitor || {},
              pageUrl: session.pageUrl || '',
              userAgent: session.userAgent || '',
              ip: session.ip || '',
            });
            if (visitorId) {
              updates.visitorId = visitorId;
              await incrementVisitorSessionCount(visitorId);
            }
          }

          if (Object.keys(updates).length) {
            await ChatSession.updateOne({ _id: session._id }, { $set: updates });
            sessionsMigrated += 1;
          } else {
            sessionsSkipped += 1;
          }
        }
      }

      return {
        roles: roleStats,
        users: userStats,
        sessions: { migrated: sessionsMigrated, skipped: sessionsSkipped },
      };
    },
  );
}

async function main() {
  const { masterUri } = getMongoUris();
  await mongoose.connect(masterUri);
  await dbConnectionManager.initializeMasterConnection();
  console.log(`[migrateLiveChatLc1] Connected${dryRun ? ' (dry-run)' : ''}`);

  const orgIds = await collectLiveChatOrgIds();
  if (!orgIds.length) {
    console.log('No organizations with live_chat installed.');
    await mongoose.disconnect();
    return;
  }

  const orgs = await Organization.find({ _id: { $in: orgIds } })
    .select('_id name database.name')
    .lean();

  let totalRolesCreated = 0;
  let totalUsersUpdated = 0;
  let totalSessionsMigrated = 0;
  let totalSessionsSkipped = 0;
  let tenantsWithoutDb = 0;

  for (const org of orgs) {
    const label = org.name || org._id;
    const stats = await migrateTenantLc1(org);

    if (stats.reason === 'no_db') {
      tenantsWithoutDb += 1;
      console.warn(`  ${label}: no tenant database — skipped`);
      continue;
    }

    totalRolesCreated += stats.roles?.created || 0;
    totalUsersUpdated += stats.users?.updated || 0;
    totalSessionsMigrated += stats.sessions?.migrated || 0;
    totalSessionsSkipped += stats.sessions?.skipped || 0;

    const parts = [];
    if (stats.roles?.created) {
      parts.push(`${stats.roles.created} role template(s)`);
    }
    if (stats.users?.updated) {
      parts.push(`${stats.users.updated} user permission(s)`);
    }
    if (stats.sessions?.migrated) {
      parts.push(`${stats.sessions.migrated} chat session(s)`);
    }
    if (parts.length) {
      console.log(`  ${label}: ${dryRun ? 'would update' : 'updated'} ${parts.join(', ')}`);
    } else {
      console.log(`  ${label}: already up to date`);
    }
  }

  console.log('\n' + '='.repeat(48));
  console.log('LC1 Migration Summary');
  console.log('='.repeat(48));
  console.log(`Organizations processed: ${orgs.length}`);
  console.log(`Role templates ${dryRun ? 'to create' : 'created'}: ${totalRolesCreated}`);
  console.log(`User permissions ${dryRun ? 'to backfill' : 'backfilled'}: ${totalUsersUpdated}`);
  console.log(`Chat sessions ${dryRun ? 'to migrate' : 'migrated'}: ${totalSessionsMigrated}`);
  console.log(`Chat sessions skipped (already LC1): ${totalSessionsSkipped}`);
  if (tenantsWithoutDb) console.log(`Tenants without database: ${tenantsWithoutDb}`);
  if (dryRun) console.log('\nDry-run only. Re-run without --dry-run to apply.');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
