/**
 * Backfill organization.participations from legacy types[].
 *
 * Usage:
 *   node server/scripts/migrateOrganizationParticipations.js [--dry-run]
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mongoose = require('mongoose');
const Organization = require('../models/Organization');
const { getEnabledAppsForTenant } = require('../utils/tenantMetadata');
const { applyTypesWrite } = require('../utils/syncOrganizationParticipation');

const dryRun = process.argv.includes('--dry-run');

async function enabledKeysForCrmOrg(org) {
  try {
    if (org.createdBy) {
      const User = require('../models/User');
      const user = await User.findById(org.createdBy).select('organizationId').lean();
      if (user?.organizationId) {
        const apps = await getEnabledAppsForTenant(user.organizationId);
        const keys = (apps || []).map((a) => a.appKey).filter(Boolean);
        if (keys.length) return keys;
      }
    }
  } catch {
    // fall through
  }
  return ['SALES'];
}

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGODB_URI required');
    process.exit(1);
  }
  await mongoose.connect(uri);

  const cursor = Organization.find({
    isTenant: false,
    $or: [
      { participations: { $exists: false } },
      { participations: null },
      { participations: {} },
    ],
    types: { $exists: true, $ne: [] },
  }).cursor();

  let scanned = 0;
  let updated = 0;

  for await (const org of cursor) {
    scanned += 1;
    const enabledAppKeys = await enabledKeysForCrmOrg(org);
    const { types, participations } = applyTypesWrite({
      types: org.types || [],
      enabledAppKeys,
      existingParticipations: org.participations || {},
    });
    if (!Object.keys(participations).length) continue;
    updated += 1;
    if (dryRun) {
      console.log(`[dry-run] ${org._id} types=${JSON.stringify(types)} participations=${JSON.stringify(participations)}`);
      continue;
    }
    org.types = types;
    org.participations = participations;
    org.markModified('participations');
    await org.save();
  }

  console.log(`Done. scanned=${scanned} updated=${updated} dryRun=${dryRun}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
