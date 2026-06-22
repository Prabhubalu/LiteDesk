#!/usr/bin/env node
'use strict';

/**
 * LC8g migration — operational metrics fields on ChatSession.
 *
 *   node scripts/migrateLiveChatLc8g.js
 *   node scripts/migrateLiveChatLc8g.js --dry-run
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
    `[migrateLiveChatLc8g] ${dryRun ? 'DRY RUN — ' : ''}${configs.length} live_chat tenant(s); `
    + 'LC8g fields rely on schema defaults (no backfill).',
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('[migrateLiveChatLc8g] failed', err);
  process.exit(1);
});
