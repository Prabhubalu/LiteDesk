/**
 * Drop legacy ConnectorExternalObject unique indexes that omit companyGuid
 * (blocked multi-company links). Ensure indexes include companyGuid.
 *
 * Runs on master (arivu_master) and each active tenant database.
 *
 * Usage: cd server && node scripts/migrateConnectorExternalObjectCompanyGuidIndex.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Organization = require('../models/Organization');
const dbConnectionManager = require('../utils/databaseConnectionManager');
const getMasterDatabaseUri = require('../utils/getMasterDatabaseUri');

const COLLECTION = 'connectorexternalobjects';

function isLegacyExternalIdUnique(idx) {
  if (!idx?.unique) return false;
  const keys = Object.keys(idx.key || {});
  return (
    idx.key.organizationId === 1 &&
    idx.key.connectorKey === 1 &&
    idx.key.entityType === 1 &&
    idx.key.externalId === 1 &&
    !('companyGuid' in (idx.key || {})) &&
    keys.length === 4
  );
}

function isLegacyArivuIdUnique(idx) {
  if (!idx?.unique) return false;
  const keys = Object.keys(idx.key || {});
  return (
    idx.key.organizationId === 1 &&
    idx.key.connectorKey === 1 &&
    idx.key.entityType === 1 &&
    idx.key.arivuId === 1 &&
    !('companyGuid' in (idx.key || {})) &&
    keys.length === 4
  );
}

async function migrateOnDb(db, label) {
  const existing = await db.listCollections({ name: COLLECTION }).toArray();
  if (existing.length === 0) {
    console.log(`  ${label}: no ${COLLECTION} — skip`);
    return;
  }

  const collection = db.collection(COLLECTION);
  const indexes = await collection.indexes();

  for (const idx of indexes) {
    if (isLegacyExternalIdUnique(idx) || isLegacyArivuIdUnique(idx)) {
      await collection.dropIndex(idx.name);
      console.log(`  ${label}: dropped legacy unique index ${idx.name}`);
    }
  }

  await collection.createIndex(
    { organizationId: 1, connectorKey: 1, entityType: 1, companyGuid: 1, externalId: 1 },
    { unique: true }
  );
  await collection.createIndex(
    { organizationId: 1, connectorKey: 1, entityType: 1, companyGuid: 1, arivuId: 1 },
    { unique: true }
  );
  console.log(`  ${label}: ensured companyGuid unique indexes`);
}

async function run() {
  const masterUri = getMasterDatabaseUri();
  await mongoose.connect(masterUri);
  await dbConnectionManager.initializeMasterConnection();

  const masterDbName = mongoose.connection.db.databaseName;
  console.log(`Connected (master catalog: ${masterDbName})\n`);

  await migrateOnDb(mongoose.connection.db, `master (${masterDbName})`);

  const tenants = await Organization.find({
    isTenant: true,
    isActive: { $ne: false },
    'database.name': { $exists: true, $ne: null },
  })
    .select('_id name database.name')
    .lean();

  for (const tenant of tenants) {
    const dbName = tenant.database?.name;
    if (!dbName) continue;

    try {
      const conn = await dbConnectionManager.getOrganizationConnection(dbName);
      if (conn.readyState !== 1) await conn.asPromise();
      await migrateOnDb(conn.db, `tenant ${tenant.name || tenant._id} (${dbName})`);
    } catch (err) {
      console.warn(`  tenant ${tenant._id} (${dbName}): ${err.message}`);
    }
  }

  await mongoose.disconnect();
  console.log('\nDone.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
