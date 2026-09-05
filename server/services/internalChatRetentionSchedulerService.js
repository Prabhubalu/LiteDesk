'use strict';

/**
 * Soft-delete internal chat messages older than tenant retentionDays setting.
 */

const Organization = require('../models/Organization');
const TenantAddonConfiguration = require('../models/TenantAddonConfiguration');
const InternalChatMessage = require('../models/InternalChatMessage');
const dbConnectionManager = require('../utils/databaseConnectionManager');
const { runWithTenantContext } = require('../utils/tenantContext');
const { ADDON_KEYS } = require('../constants/addonKeys');
const { isAddonEntitledForOrg } = require('../utils/addonAccessUtils');

const BATCH_LIMIT = Math.min(
  2000,
  Math.max(50, parseInt(process.env.INTERNAL_CHAT_RETENTION_BATCH_LIMIT || '500', 10))
);

async function processTenantRetention(organizationId, retentionDays) {
  if (!retentionDays || retentionDays <= 0) return { deleted: 0 };
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const result = await InternalChatMessage.updateMany(
    {
      organizationId,
      deletedAt: null,
      createdAt: { $lt: cutoff },
    },
    {
      $set: {
        deletedAt: new Date(),
        body: '',
        attachments: [],
      },
    }
  );
  return { deleted: result.modifiedCount || 0 };
}

async function tickInternalChatRetention() {
  const configs = await TenantAddonConfiguration.find({
    addonKey: ADDON_KEYS.INTERNAL_CHAT,
    enabled: true,
    archivedAt: null,
  })
    .select('organizationId settings')
    .lean();

  let tenantsProcessed = 0;
  let deleted = 0;
  let errors = 0;

  for (const row of configs) {
    const organizationId = row.organizationId;
    if (!organizationId) continue;
    const retentionDays = Number(row.settings?.retentionDays) || 0;
    if (retentionDays <= 0) continue;

    const entitled = await isAddonEntitledForOrg(organizationId, ADDON_KEYS.INTERNAL_CHAT);
    if (!entitled) continue;

    const org = await Organization.findById(organizationId).select('database').lean();
    const dbName = org?.database?.name;

    try {
      const run = async () => {
        const result = await processTenantRetention(organizationId, retentionDays);
        deleted += result.deleted;
        tenantsProcessed += 1;
      };

      if (dbName) {
        const conn = await dbConnectionManager.getOrganizationConnection(dbName);
        if (conn.readyState !== 1 && typeof conn.asPromise === 'function') {
          await conn.asPromise();
        }
        await runWithTenantContext(
          { organizationId, connection: conn, databaseName: dbName },
          run
        );
      } else {
        await run();
      }
    } catch (err) {
      errors += 1;
      console.error(`[internalChatRetention] tenant ${organizationId}:`, err.message);
    }
  }

  return { tenantsProcessed, deleted, errors, scanned: configs.length };
}

module.exports = {
  tickInternalChatRetention,
  processTenantRetention,
};
