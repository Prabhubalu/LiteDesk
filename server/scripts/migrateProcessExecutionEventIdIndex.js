/**
 * Fix ProcessExecution unique indexes that blocked multiple manual/schedule runs:
 * 1. Drop legacy unique { processId, eventId } (null eventId collided)
 * 2. Recreate as partial unique when eventId is a string
 * 3. Fix firstTimeKey unique sparse (null firstTimeKey collided) → partial string-only
 * 4. Unset null firstTimeKey on existing docs
 *
 * Runs on master and each active tenant database.
 *
 * Usage: cd server && node scripts/migrateProcessExecutionEventIdIndex.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Organization = require('../models/Organization');
const dbConnectionManager = require('../utils/databaseConnectionManager');
const getMasterDatabaseUri = require('../utils/getMasterDatabaseUri');

const COLLECTION = 'processexecutions';
const EVENT_INDEX_NAME = 'process_execution_processId_eventId_uq';
const FIRST_TIME_INDEX_NAME = 'process_execution_first_time_key_uq';

async function ensureIndex(collection, label, keys, options) {
  const indexes = await collection.indexes();
  const existing = indexes.find((idx) => idx.name === options.name);
  if (existing) {
    const samePartial =
      JSON.stringify(existing.partialFilterExpression || null) ===
      JSON.stringify(options.partialFilterExpression || null);
    if (existing.unique === true && samePartial) {
      console.log(`  ${label}: ${options.name} already correct`);
      return;
    }
    await collection.dropIndex(existing.name);
    console.log(`  ${label}: dropped outdated ${existing.name}`);
  }
  await collection.createIndex(keys, options);
  console.log(`  ${label}: ensured ${options.name}`);
}

async function migrateProcessExecutionIndexesOnDb(db, label) {
  const existing = await db.listCollections({ name: COLLECTION }).toArray();
  if (existing.length === 0) {
    console.log(`  ${label}: no ${COLLECTION} collection — skip`);
    return;
  }

  const collection = db.collection(COLLECTION);
  const indexes = await collection.indexes();

  const legacyEvent = indexes.find(
    (idx) =>
      idx.name === 'processId_1_eventId_1' ||
      (idx.unique === true &&
        idx.key?.processId === 1 &&
        idx.key?.eventId === 1 &&
        Object.keys(idx.key).length === 2 &&
        !idx.partialFilterExpression)
  );
  if (legacyEvent?.name) {
    await collection.dropIndex(legacyEvent.name);
    console.log(`  ${label}: dropped legacy unique index ${legacyEvent.name}`);
  }

  // Sparse unique on firstTimeKey indexes null — drop any non-partial unique
  const legacyFirstTime = indexes.find(
    (idx) =>
      (idx.name === FIRST_TIME_INDEX_NAME ||
        (idx.name === 'firstTimeKey_1' && idx.unique === true)) &&
      idx.unique === true &&
      !idx.partialFilterExpression
  );
  if (legacyFirstTime?.name) {
    await collection.dropIndex(legacyFirstTime.name);
    console.log(`  ${label}: dropped legacy firstTimeKey unique ${legacyFirstTime.name}`);
  }

  const unsetResult = await collection.updateMany(
    { firstTimeKey: null },
    { $unset: { firstTimeKey: '' } }
  );
  if (unsetResult.modifiedCount) {
    console.log(`  ${label}: unset null firstTimeKey on ${unsetResult.modifiedCount} docs`);
  }

  await ensureIndex(collection, label, { processId: 1, eventId: 1 }, {
    unique: true,
    partialFilterExpression: { eventId: { $type: 'string' } },
    name: EVENT_INDEX_NAME
  });

  await ensureIndex(collection, label, { firstTimeKey: 1 }, {
    unique: true,
    partialFilterExpression: { firstTimeKey: { $type: 'string' } },
    name: FIRST_TIME_INDEX_NAME
  });
}

async function run() {
  const masterUri = getMasterDatabaseUri();
  await mongoose.connect(masterUri);
  await dbConnectionManager.initializeMasterConnection();

  const masterDbName = mongoose.connection.db.databaseName;
  console.log(`Connected (master catalog: ${masterDbName})\n`);

  await migrateProcessExecutionIndexesOnDb(
    mongoose.connection.db,
    `master (${masterDbName})`
  );

  const tenants = await Organization.find({
    isTenant: true,
    isActive: { $ne: false },
    'database.name': { $exists: true, $ne: null }
  })
    .select('_id name database.name')
    .lean();

  for (const tenant of tenants) {
    const dbName = tenant.database?.name;
    if (!dbName) continue;

    try {
      const conn = await dbConnectionManager.getOrganizationConnection(dbName);
      if (conn.readyState !== 1) await conn.asPromise();
      await migrateProcessExecutionIndexesOnDb(
        conn.db,
        `tenant ${tenant.name || tenant._id} (${dbName})`
      );
    } catch (err) {
      console.warn(`  tenant ${tenant._id} (${dbName}): ${err.message}`);
    }
  }

  await mongoose.disconnect();
  console.log('\nDone.');
}

run().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
