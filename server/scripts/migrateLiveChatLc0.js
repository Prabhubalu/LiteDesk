#!/usr/bin/env node
'use strict';

/**
 * LC0 migration:
 * 1. Copy ChatSession.caseRecordId → linkedRecords[] (moduleKey: cases) per tenant DB.
 * 2. Auto-install live_chat addon for orgs with embed.chat enabled or a public key.
 *
 *   node scripts/migrateLiveChatLc0.js
 *   node scripts/migrateLiveChatLc0.js --dry-run
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Organization = require('../models/Organization');
const OrganizationSubscription = require('../models/OrganizationSubscription');
const dbConnectionManager = require('../utils/databaseConnectionManager');
const { runWithTenantContext } = require('../utils/tenantContext');
const { ensureSubscriptionForAddon } = require('../services/addonBootstrapService');
const { ADDON_KEYS } = require('../constants/addonKeys');
const { findAddonSubscriptionEntry } = require('../utils/addonAccessUtils');
const { getMongoUris } = require('../lib/mongoConnect');

const dryRun = process.argv.includes('--dry-run');
const CASES_MODULE_KEY = 'cases';

async function migrateTenantChatSessions(tenant) {
  const dbName = tenant.database?.name;
  if (!dbName) {
    return { migrated: 0, skipped: 0, reason: 'no_db' };
  }

  const conn = await dbConnectionManager.getOrganizationConnection(dbName);
  if (conn.readyState !== 1) await conn.asPromise();

  let migrated = 0;
  let skipped = 0;

  await runWithTenantContext(
    { organizationId: tenant._id, connection: conn, databaseName: dbName },
    async () => {
      const ChatSession = require('../models/ChatSession');
      const cursor = ChatSession.find({
        caseRecordId: { $exists: true, $ne: null },
      }).cursor();

      for await (const session of cursor) {
        const caseId = session.caseRecordId;
        if (!caseId) {
          skipped += 1;
          continue;
        }

        const alreadyLinked = Array.isArray(session.linkedRecords)
          && session.linkedRecords.some(
            (row) => String(row?.moduleKey) === CASES_MODULE_KEY
              && String(row?.recordId) === String(caseId),
          );

        if (alreadyLinked) {
          skipped += 1;
          continue;
        }

        const link = {
          moduleKey: CASES_MODULE_KEY,
          recordId: caseId,
          linkType: 'linked',
          linkedAt: session.createdAt || new Date(),
        };

        if (dryRun) {
          migrated += 1;
          continue;
        }

        await ChatSession.updateOne(
          { _id: session._id },
          { $push: { linkedRecords: link } },
        );
        migrated += 1;
      }
    },
  );

  return { migrated, skipped };
}

async function autoInstallLiveChatAddon(org) {
  const embed = org.embed?.chat;
  const hasEmbed = embed?.enabled === true || Boolean(String(embed?.publicKey || '').trim());
  if (!hasEmbed) {
    return { installed: false, reason: 'no_embed' };
  }

  if (dryRun) {
    return { installed: true, dryRun: true };
  }

  const result = await ensureSubscriptionForAddon({
    organizationId: org._id,
    addonKey: ADDON_KEYS.LIVE_CHAT,
    initiatedByUserId: null,
  });

  if (result.error) {
    return { installed: false, error: result.error };
  }

  return { installed: true, created: result.created === true };
}

async function main() {
  const { masterUri } = getMongoUris();
  await mongoose.connect(masterUri);
  await dbConnectionManager.initializeMasterConnection();
  console.log(`[migrateLiveChatLc0] Connected${dryRun ? ' (dry-run)' : ''}`);

  const tenants = await Organization.find({
    isTenant: true,
    isActive: { $ne: false },
  })
    .select('_id name database.name embed.chat')
    .lean();

  let sessionsMigrated = 0;
  let sessionsSkipped = 0;
  let addonsInstalled = 0;
  let addonsSkipped = 0;

  for (const tenant of tenants) {
    const sessionStats = await migrateTenantChatSessions(tenant);
    sessionsMigrated += sessionStats.migrated || 0;
    sessionsSkipped += sessionStats.skipped || 0;

    if (sessionStats.migrated > 0 || sessionStats.reason === 'no_db') {
      const label = tenant.name || tenant._id;
      if (sessionStats.reason === 'no_db') {
        console.warn(`  ${label}: no tenant database — skipped chat sessions`);
      } else if (sessionStats.migrated > 0) {
        console.log(
          `  ${label}: ${dryRun ? 'would migrate' : 'migrated'} ${sessionStats.migrated} chat session(s)`,
        );
      }
    }

    const addonStats = await autoInstallLiveChatAddon(tenant);
    if (addonStats.installed) {
      addonsInstalled += 1;
      const label = tenant.name || tenant._id;
      console.log(`  ${label}: ${dryRun ? 'would install' : 'installed'} live_chat addon`);
    } else if (addonStats.reason !== 'no_embed') {
      addonsSkipped += 1;
      console.warn(`  ${tenant.name || tenant._id}: addon install skipped — ${addonStats.error || 'unknown'}`);
    }
  }

  // Also check master orgs (non-tenant) with embed for addon install
  const masterOrgs = await Organization.find({
    isTenant: { $ne: true },
    $or: [
      { 'embed.chat.enabled': true },
      { 'embed.chat.publicKey': { $exists: true, $nin: [null, ''] } },
    ],
  })
    .select('_id name embed.chat')
    .lean();

  for (const org of masterOrgs) {
    const existing = await OrganizationSubscription.findOne({ organizationId: org._id }).lean();
    const hasAddon = existing && findAddonSubscriptionEntry(existing, ADDON_KEYS.LIVE_CHAT);
    if (hasAddon) continue;

    const addonStats = await autoInstallLiveChatAddon(org);
    if (addonStats.installed) {
      addonsInstalled += 1;
      console.log(`  ${org.name || org._id}: ${dryRun ? 'would install' : 'installed'} live_chat addon`);
    }
  }

  console.log('\n' + '='.repeat(48));
  console.log('LC0 Migration Summary');
  console.log('='.repeat(48));
  console.log(`Chat sessions ${dryRun ? 'to migrate' : 'migrated'}: ${sessionsMigrated}`);
  console.log(`Chat sessions skipped (already linked): ${sessionsSkipped}`);
  console.log(`Addons ${dryRun ? 'to install' : 'installed'}: ${addonsInstalled}`);
  if (addonsSkipped) console.log(`Addon install failures: ${addonsSkipped}`);
  if (dryRun) console.log('\nDry-run only. Re-run without --dry-run to apply.');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
