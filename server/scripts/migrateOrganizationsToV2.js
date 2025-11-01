#!/usr/bin/env node

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Organization = require('../models/Organization');
const OrganizationV2 = require('../models/OrganizationV2');
const { orgV1ToV2Doc } = require('../utils/mappers/organizationMapper');

const BATCH_SIZE = parseInt(process.env.MIGRATION_BATCH_SIZE || '500', 10);

async function migrate() {
  const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!MONGO_URI) throw new Error('MONGODB_URI/MONGO_URI not set');
  await mongoose.connect(MONGO_URI);

  console.log('Starting Organization -> OrganizationV2 migration');
  console.log('Batch size:', BATCH_SIZE);

  const lastIdArg = process.argv.find(a => a.startsWith('--lastId='));
  let lastId = lastIdArg ? lastIdArg.split('=')[1] : null;

  let migrated = 0;
  let upserts = 0;
  let loop = 0;

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      loop += 1;
      const query = {};
      if (lastId) query._id = { $gt: new mongoose.Types.ObjectId(lastId) };

      const batch = await Organization.find(query)
        .sort({ _id: 1 })
        .limit(BATCH_SIZE)
        .lean();

      if (batch.length === 0) break;

      for (const o of batch) {
        const v2 = orgV1ToV2Doc(o);
        await OrganizationV2.updateOne(
          { legacyOrganizationId: o._id },
          { $set: v2 },
          { upsert: true }
        );
        upserts += 1;
        migrated += 1;
      }

      lastId = batch[batch.length - 1]._id.toString();
      console.log(`[Loop ${loop}] Migrated: ${migrated} | LastId: ${lastId}`);
    }

    const totalV1 = await Organization.countDocuments({});
    const totalV2 = await OrganizationV2.countDocuments({});
    console.log('Done. Summary:');
    console.log('  Organizations scanned:', migrated);
    console.log('  OrgV2 upserts       :', upserts);
    console.log('  Totals -> Org:', totalV1, 'OrgV2:', totalV2);
  } finally {
    await mongoose.connection.close();
  }
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});


