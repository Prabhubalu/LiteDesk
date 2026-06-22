#!/usr/bin/env node
'use strict';

/**
 * LC8b migration — timing & ownership fields on ChatSession.
 * New fields use schema defaults; no backfill for historical sessions.
 *
 *   node scripts/migrateLiveChatLc8b.js
 *   node scripts/migrateLiveChatLc8b.js --dry-run
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

  console.log(
    `[migrateLiveChatLc8b] ${dryRun ? 'DRY RUN — ' : ''}${configs.length} live_chat tenant(s); `
    + 'LC8b fields rely on schema defaults (no backfill).',
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('[migrateLiveChatLc8b] failed', err);
  process.exit(1);
});
