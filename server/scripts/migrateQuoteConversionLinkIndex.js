/**
 * Drop legacy unique index on QuoteConversionLink that blocked multiple SOs per quote revision.
 *
 * Runs on master (arivu_master) and each active tenant database.
 *
 * Usage: cd server && node scripts/migrateQuoteConversionLinkIndex.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Organization = require('../models/Organization');
const dbConnectionManager = require('../utils/databaseConnectionManager');
const getMasterDatabaseUri = require('../utils/getMasterDatabaseUri');

const COLLECTION = 'quoteconversionlinks';

async function migrateQuoteConversionLinkIndexesOnDb(db, label) {
  const existing = await db.listCollections({ name: COLLECTION }).toArray();
  if (existing.length === 0) {
    console.log(`  ${label}: no ${COLLECTION} collection — skip (indexes apply on first write)`);
    return;
  }

  const collection = db.collection(COLLECTION);
  const indexes = await collection.indexes();

  const legacy = indexes.find(
    (idx) =>
      idx.unique === true &&
      idx.key?.organizationId === 1 &&
      idx.key?.quoteId === 1 &&
      idx.key?.revisionNumber === 1 &&
      Object.keys(idx.key).length === 3
  );

  if (legacy?.name) {
    await collection.dropIndex(legacy.name);
    console.log(`  ${label}: dropped legacy unique index ${legacy.name}`);
  } else {
    console.log(`  ${label}: legacy unique index not found`);
  }

  await collection.createIndex({ organizationId: 1, quoteId: 1, revisionNumber: 1 });
  await collection.createIndex(
    { organizationId: 1, quoteId: 1, revisionNumber: 1, targetRecordId: 1 },
    { unique: true, partialFilterExpression: { targetRecordId: { $type: 'string' } } }
  );
  console.log(`  ${label}: ensured revision + targetRecordId indexes`);
}

async function run() {
  const masterUri = getMasterDatabaseUri();
  await mongoose.connect(masterUri);
  await dbConnectionManager.initializeMasterConnection();

  const masterDbName = mongoose.connection.db.databaseName;
  console.log(`Connected (master catalog: ${masterDbName})\n`);

  await migrateQuoteConversionLinkIndexesOnDb(
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
      await migrateQuoteConversionLinkIndexesOnDb(
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
