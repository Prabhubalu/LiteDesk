'use strict';

/**
 * Cross-tenant scheduler: publish due scheduled announcements; expire + auto-archive.
 */

const Organization = require('../models/Organization');
const TenantAddonConfiguration = require('../models/TenantAddonConfiguration');
const Announcement = require('../models/Announcement');
const dbConnectionManager = require('../utils/databaseConnectionManager');
const { runWithTenantContext } = require('../utils/tenantContext');
const { ADDON_KEYS } = require('../constants/addonKeys');
const { isAddonEntitledForOrg } = require('../utils/addonAccessUtils');

const BATCH_LIMIT = Math.min(500, Math.max(10, parseInt(process.env.ANNOUNCEMENT_LIFECYCLE_BATCH_LIMIT || '200', 10)));

async function processTenantLifecycle(organizationId) {
  const now = new Date();
  let published = 0;
  let expired = 0;
  let archived = 0;

  const due = await Announcement.find({
    organizationId,
    status: 'scheduled',
    'schedule.startAt': { $lte: now },
  })
    .limit(BATCH_LIMIT)
    .exec();

  for (const doc of due) {
    doc.status = 'published';
    doc.publishedAt = now;
    doc.modifiedBy = doc.modifiedBy || doc.createdBy;
    await doc.save();
    published += 1;
  }

  const toExpire = await Announcement.find({
    organizationId,
    status: { $in: ['published', 'paused'] },
    'schedule.endAt': { $ne: null, $lte: now },
  })
    .limit(BATCH_LIMIT)
    .exec();

  for (const doc of toExpire) {
    doc.status = 'expired';
    doc.modifiedBy = doc.modifiedBy || doc.createdBy;
    await doc.save();
    expired += 1;
  }

  const config = await TenantAddonConfiguration.findOne({
    organizationId,
    addonKey: ADDON_KEYS.ANNOUNCEMENTS,
  }).lean();
  const autoArchive = config?.settings?.autoArchiveExpired !== false;

  if (autoArchive) {
    const toArchive = await Announcement.find({
      organizationId,
      status: 'expired',
    })
      .limit(BATCH_LIMIT)
      .exec();

    for (const doc of toArchive) {
      doc.status = 'archived';
      doc.archivedAt = now;
      await doc.save();
      archived += 1;
    }
  }

  return { published, expired, archived };
}

/**
 * @returns {Promise<{ tenantsProcessed: number, published: number, expired: number, archived: number, errors: number }>}
 */
async function tickAnnouncementLifecycle() {
  if (process.env.ENABLE_ANNOUNCEMENT_LIFECYCLE_SCHEDULER === 'false') {
    return { tenantsProcessed: 0, published: 0, expired: 0, archived: 0, errors: 0 };
  }

  const configs = await TenantAddonConfiguration.find({
    addonKey: ADDON_KEYS.ANNOUNCEMENTS,
    enabled: true,
    archivedAt: null,
  })
    .select('organizationId')
    .lean();

  let tenantsProcessed = 0;
  let published = 0;
  let expired = 0;
  let archived = 0;
  let errors = 0;

  for (const row of configs) {
    const organizationId = row.organizationId;
    if (!organizationId) continue;

    const entitled = await isAddonEntitledForOrg(organizationId, ADDON_KEYS.ANNOUNCEMENTS);
    if (!entitled) continue;

    const org = await Organization.findById(organizationId).select('database').lean();
    const dbName = org?.database?.name;

    try {
      const run = async () => {
        const result = await processTenantLifecycle(organizationId);
        published += result.published;
        expired += result.expired;
        archived += result.archived;
        tenantsProcessed += 1;
      };

      if (dbName) {
        const conn = await dbConnectionManager.getOrganizationConnection(dbName);
        if (conn.readyState !== 1 && typeof conn.asPromise === 'function') {
          await conn.asPromise();
        }
        await runWithTenantContext(
          { organizationId, connection: conn, databaseName: dbName },
          run,
        );
      } else {
        await run();
      }
    } catch (err) {
      errors += 1;
      console.error(`[announcementLifecycle] tenant ${organizationId}:`, err.message);
    }
  }

  return { tenantsProcessed, published, expired, archived, errors };
}

module.exports = {
  tickAnnouncementLifecycle,
  processTenantLifecycle,
};
