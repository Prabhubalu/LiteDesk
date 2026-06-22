/* eslint-disable no-console */
require('dotenv').config();
const mongoose = require('mongoose');
const { getMongoUris } = require('../lib/mongoConnect');
const TenantAddonConfiguration = require('../models/TenantAddonConfiguration');
const { ADDON_KEYS } = require('../constants/addonKeys');
const { runWithOrganizationTenantContext } = require('../utils/runWithOrganizationTenant');
const {
  seedDefaultLiveChatAssignmentRulesForOrganization,
} = require('../services/liveChatAssignmentRuleSeedService');

async function main() {
  const orgIdFilter = process.argv.find((arg) => arg.startsWith('--org='))?.split('=')[1] || null;
  const dryRun = process.argv.includes('--dry-run');

  const { masterUri } = getMongoUris();
  await mongoose.connect(masterUri);
  console.log('Connected to MongoDB');

  const filter = { addonKey: ADDON_KEYS.LIVE_CHAT, archivedAt: null };
  if (orgIdFilter) filter.organizationId = orgIdFilter;

  const configs = await TenantAddonConfiguration.find(filter).select('organizationId').lean();
  console.log(`Found ${configs.length} live_chat tenant(s)`);

  let seeded = 0;
  let skipped = 0;

  for (const config of configs) {
    const orgId = String(config.organizationId);
    if (dryRun) {
      console.log(`[dry-run] would seed assignment rules for org ${orgId}`);
      seeded += 1;
      continue;
    }

    const result = await runWithOrganizationTenantContext(orgId, async () =>
      seedDefaultLiveChatAssignmentRulesForOrganization(orgId),
    );

    if (result.created) {
      console.log(`Seeded assignment rules for org ${orgId} (group ${result.groupId})`);
      seeded += 1;
    } else {
      console.log(`Skipped org ${orgId}: ${result.reason}`);
      skipped += 1;
    }
  }

  console.log(`Done. seeded=${seeded} skipped=${skipped}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
