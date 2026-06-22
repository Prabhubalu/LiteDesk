#!/usr/bin/env node
'use strict';

/**
 * LC8a migration — session default-tier fields (subject, tags, summary, CSAT).
 * New fields use schema defaults; this script is a no-op audit hook for tenants on live_chat.
 *
 *   node scripts/migrateLiveChatLc8a.js
 *   node scripts/migrateLiveChatLc8a.js --dry-run
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const TenantAddonConfiguration = require('../models/TenantAddonConfiguration');
const { ADDON_KEYS } = require('../constants/addonKeys');
const { getMongoUris } = require('../lib/mongoConnect');

const dryRun = process.argv.includes('--dry-run');

async function main() {
  const uris = getMongoUris();
  await mongoose.connect(uris.master);

  const configs = await TenantAddonConfiguration.find({
    addonKey: ADDON_KEYS.LIVE_CHAT,
    archivedAt: { $in: [null, undefined] },
    enabled: { $ne: false },
  })
    .select('organizationId')
    .lean();

  console.log(`[migrateLiveChatLc8a] ${dryRun ? 'DRY RUN — ' : ''}${configs.length} live_chat tenant(s); LC8a fields rely on schema defaults (no backfill).`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('[migrateLiveChatLc8a] failed', err);
  process.exit(1);
});
