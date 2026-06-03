/**
 * SO3 — Re-scope SalesOrderLine sourceQuoteLineId unique index per sales order
 * (allows split lineage: same sourceQuoteLineId on parent + child SOs).
 *
 * Usage: cd server && node scripts/migrateSalesOrderLineSourceIndex.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const getMasterDatabaseUri = require('../utils/getMasterDatabaseUri');

function resolveMongoUri() {
  try {
    return getMasterDatabaseUri();
  } catch {
    return process.env.MONGODB_URI || process.env.MONGO_URI || process.env.MONGO_URI_LOCAL || null;
  }
}

async function dropLegacyIndex(collection) {
  const indexes = await collection.indexes();
  const legacy = indexes.find(
    (idx) =>
      idx.unique === true &&
      idx.key &&
      idx.key.organizationId === 1 &&
      idx.key.sourceQuoteId === 1 &&
      idx.key.sourceQuoteLineId === 1 &&
      idx.key.salesOrderId == null
  );
  if (legacy?.name) {
    await collection.dropIndex(legacy.name);
    console.log(`  dropped legacy index ${legacy.name}`);
  } else {
    console.log('  legacy unique index not found (already migrated?)');
  }
}

async function ensurePerOrderUniqueIndex(collection) {
  await collection.createIndex(
    { organizationId: 1, salesOrderId: 1, sourceQuoteLineId: 1 },
    {
      unique: true,
      partialFilterExpression: { sourceQuoteLineId: { $type: 'string' } },
      name: 'organizationId_1_salesOrderId_1_sourceQuoteLineId_1'
    }
  );
  console.log('  ensured per-order sourceQuoteLineId unique index');
}

async function ensureCoverageIndex(collection) {
  await collection.createIndex(
    { organizationId: 1, sourceQuoteId: 1, sourceQuoteLineId: 1 },
    { name: 'organizationId_1_sourceQuoteId_1_sourceQuoteLineId_1' }
  );
  console.log('  ensured coverage lookup index');
}

async function main() {
  const mongoUri = resolveMongoUri();
  if (!mongoUri) {
    console.error('Set MONGODB_URI or MONGO_URI in server/.env (run from server/: cd server && node scripts/...)');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  const collection = mongoose.connection.collection('salesorderlines');

  console.log('Migrating SalesOrderLine sourceQuoteLineId indexes...');
  await dropLegacyIndex(collection);
  await ensurePerOrderUniqueIndex(collection);
  await ensureCoverageIndex(collection);
  console.log('Done.');
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
