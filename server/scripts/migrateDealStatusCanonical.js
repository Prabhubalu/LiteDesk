/**
 * One-time migration: collapse legacy Deal Status values to Open|Won|Lost.
 *
 * Mapping:
 *   Active, Stalled → Open
 *   Abandoned → Lost (seeds lostReason = "Abandoned" when empty)
 *   Closed Won → Won, Closed Lost → Lost
 *
 * Usage:
 *   node server/scripts/migrateDealStatusCanonical.js [--dry-run]
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env'), override: false });

const mongoose = require('mongoose');
const {
  DEAL_STATUS,
  normalizeDealStatus,
  isLegacyAbandonedStatus,
} = require('../constants/dealStatus');

const DRY_RUN = process.argv.includes('--dry-run');

const LEGACY_STATUS_VALUES = [
  'Active', 'Stalled', 'Abandoned',
  'active', 'stalled', 'abandoned',
  'Closed Won', 'Closed Lost',
  'closed won', 'closed lost',
];

async function run() {
  const uri =
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    process.env.MONGO_URI_LOCAL ||
    'mongodb://localhost:27017/arivu_master';

  await mongoose.connect(uri);
  console.log(`[migrateDealStatusCanonical] Connected: ${mongoose.connection.name}`);
  const col = mongoose.connection.collection('deals');

  const filter = {
    $or: [
      { status: { $in: LEGACY_STATUS_VALUES } },
      { derivedStatus: { $in: LEGACY_STATUS_VALUES } },
    ],
  };

  const cursor = col.find(filter).project({ _id: 1, status: 1, lostReason: 1, derivedStatus: 1 });
  let scanned = 0;
  let updated = 0;
  let abandonedSeeded = 0;

  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    scanned += 1;
    const set = {};

    if (doc.status != null && !Object.values(DEAL_STATUS).includes(doc.status)) {
      set.status = normalizeDealStatus(doc.status);
      if (isLegacyAbandonedStatus(doc.status) && !String(doc.lostReason || '').trim()) {
        set.lostReason = 'Abandoned';
        abandonedSeeded += 1;
      }
    }

    if (doc.derivedStatus != null && LEGACY_STATUS_VALUES.includes(String(doc.derivedStatus))) {
      set.derivedStatus = normalizeDealStatus(doc.derivedStatus);
    }

    if (Object.keys(set).length === 0) continue;

    if (DRY_RUN) {
      console.log(`[dry-run] ${doc._id}:`, set);
      updated += 1;
      continue;
    }

    await col.updateOne({ _id: doc._id }, { $set: set });
    updated += 1;
  }

  console.log(JSON.stringify({ dryRun: DRY_RUN, scanned, updated, abandonedSeeded }, null, 2));
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
