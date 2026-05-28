#!/usr/bin/env node
/**
 * Backfill Item.lifecycle_state from legacy status field.
 *
 * Usage:
 *   node server/scripts/migrateItemLifecycleState.js [--dry-run]
 *
 * @see docs/CATALOG_ROADMAP.md (C0)
 */

const { loadEnv, resolveMasterMongoUri } = require('./lib/resolveMongoUri');

loadEnv();
const mongoose = require('mongoose');
const Item = require('../models/Item');
const {
  CATALOG_LIFECYCLE_DEFAULT,
  inferLifecycleStateFromLegacyStatus,
  syncLegacyItemStatusFromLifecycle
} = require('../constants/catalogLifecycle');

const DRY_RUN = process.argv.includes('--dry-run');

async function run() {
  const { uri, dbName } = resolveMasterMongoUri();

  await mongoose.connect(uri);
  console.log(`[migrateItemLifecycleState] connected db=${dbName} (dryRun=${DRY_RUN})`);

  const cursor = Item.find({
    $or: [
      { lifecycle_state: { $exists: false } },
      { lifecycle_state: null },
      { lifecycle_state: '' }
    ]
  }).cursor();

  let scanned = 0;
  let updated = 0;

  for await (const item of cursor) {
    scanned += 1;
    const lifecycleState = inferLifecycleStateFromLegacyStatus(item.status, item.lifecycle_state);
    const legacyStatus = syncLegacyItemStatusFromLifecycle(lifecycleState);

    if (DRY_RUN) {
      console.log(`[dry-run] ${item._id} status=${item.status} -> lifecycle_state=${lifecycleState}`);
    } else {
      await Item.updateOne(
        { _id: item._id },
        { $set: { lifecycle_state: lifecycleState, status: legacyStatus } }
      );
    }
    updated += 1;
  }

  // Normalize rows that already have lifecycle_state but stale status
  const staleStatusCursor = Item.find({
    lifecycle_state: { $in: ['Draft', 'Active', 'Discontinued', 'Archived'] }
  }).cursor();

  for await (const item of staleStatusCursor) {
    const expectedStatus = syncLegacyItemStatusFromLifecycle(item.lifecycle_state);
    if (item.status !== expectedStatus) {
      scanned += 1;
      if (DRY_RUN) {
        console.log(`[dry-run] ${item._id} sync status ${item.status} -> ${expectedStatus}`);
      } else {
        await Item.updateOne({ _id: item._id }, { $set: { status: expectedStatus } });
      }
      updated += 1;
    }
  }

  console.log(`[migrateItemLifecycleState] done scanned=${scanned} updated=${updated} default=${CATALOG_LIFECYCLE_DEFAULT}`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('[migrateItemLifecycleState] failed:', err);
  process.exit(1);
});
