#!/usr/bin/env node
'use strict';

/**
 * Seed LC3 missed-chat Process Designer recipes for orgs with live_chat installed.
 *
 *   node scripts/migrateLiveChatLc3Recipes.js
 *   node scripts/migrateLiveChatLc3Recipes.js --dry-run
 *   node scripts/migrateLiveChatLc3Recipes.js --org-id=<ObjectId>
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const TenantAddonConfiguration = require('../models/TenantAddonConfiguration');
const OrganizationSubscription = require('../models/OrganizationSubscription');
const { getMongoUris } = require('../lib/mongoConnect');
const { ADDON_KEYS } = require('../constants/addonKeys');
const { findAddonSubscriptionEntry } = require('../utils/addonAccessUtils');
const { runWithOrganizationTenantContext } = require('../utils/runWithOrganizationTenant');
const { seedLiveChatProcessRecipesForOrganization } = require('../services/liveChatProcessRecipeSeedService');

const dryRun = process.argv.includes('--dry-run');
const orgIdArg = process.argv.find((arg) => arg.startsWith('--org-id='));
const orgIdFilter = orgIdArg ? orgIdArg.split('=')[1]?.trim() : null;

async function collectLiveChatOrgIds() {
  const fromConfig = await TenantAddonConfiguration.find({
    addonKey: ADDON_KEYS.LIVE_CHAT,
    archivedAt: { $in: [null, undefined] },
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
    return ids.has(String(orgIdFilter)) ? [orgIdFilter] : [];
  }

  return [...ids];
}

async function main() {
  const { masterUri } = getMongoUris();
  await mongoose.connect(masterUri);

  const orgIds = await collectLiveChatOrgIds();
  console.log(`[migrateLiveChatLc3Recipes] orgs=${orgIds.length} dryRun=${dryRun}`);

  for (const organizationId of orgIds) {
    if (dryRun) {
      console.log(`  would seed recipes for ${organizationId}`);
      continue;
    }

    const result = await runWithOrganizationTenantContext(organizationId, async () =>
      seedLiveChatProcessRecipesForOrganization(organizationId),
    );
    console.log(`  ${organizationId}: seeded=${result.seeded} skipped=${result.skipped}`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('[migrateLiveChatLc3Recipes] failed', err);
  process.exit(1);
});
