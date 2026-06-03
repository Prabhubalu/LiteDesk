/**
 * Drop legacy unique index on QuoteConversionLink that blocked multiple SOs per quote revision.
 *
 * Usage: cd server && node scripts/migrateQuoteConversionLinkIndex.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function run() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const collection = mongoose.connection.collection('quoteconversionlinks');

  const indexes = await collection.indexes();
  const legacy = indexes.find(
    (idx) =>
      idx.unique === true &&
      idx.key?.organizationId === 1 &&
      idx.key?.quoteId === 1 &&
      idx.key?.revisionNumber === 1 &&
      Object.keys(idx.key).length === 3
  );

  if (legacy) {
    await collection.dropIndex(legacy.name);
    console.log(`Dropped legacy unique index: ${legacy.name}`);
  } else {
    console.log('Legacy unique index not found — skipping drop');
  }

  await collection.createIndex({ organizationId: 1, quoteId: 1, revisionNumber: 1 });
  await collection.createIndex(
    { organizationId: 1, quoteId: 1, revisionNumber: 1, targetRecordId: 1 },
    { unique: true, partialFilterExpression: { targetRecordId: { $type: 'string' } } }
  );
  console.log('Ensured non-unique revision index + unique targetRecordId index');

  await mongoose.disconnect();
  console.log('Done.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
