#!/usr/bin/env node

/**
 * Backfill platform.payments ModuleDefinition identity fields (key, name).
 * Safe to re-run: only updates docs missing canonical key/name.
 *
 * Usage: node scripts/backfillPaymentsModuleIdentity.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const ModuleDefinition = require('../models/ModuleDefinition');
const getMasterDatabaseUri = require('../utils/getMasterDatabaseUri');

const CANONICAL_KEY = 'payments';
const CANONICAL_NAME = 'Payments';

async function backfillPaymentsModuleIdentity() {
  const masterUri = getMasterDatabaseUri();
  await mongoose.connect(masterUri);
  console.log('✅ Connected to master database\n');

  const docs = await ModuleDefinition.find({
    appKey: 'platform',
    moduleKey: CANONICAL_KEY
  }).select('key name moduleKey').lean();

  if (!docs.length) {
    console.log('⚠️ No platform.payments module found. Run migratePaymentsToCoreModule.js first.\n');
    await mongoose.disconnect();
    return;
  }

  let updated = 0;
  for (const doc of docs) {
    const needsKey = String(doc.key || '').toLowerCase() !== CANONICAL_KEY;
    const needsName = String(doc.name || '').trim() !== CANONICAL_NAME;
    if (!needsKey && !needsName) continue;

    await ModuleDefinition.updateOne(
      { _id: doc._id },
      {
        $set: {
          key: CANONICAL_KEY,
          name: CANONICAL_NAME,
          moduleKey: CANONICAL_KEY
        }
      }
    );
    updated += 1;
    console.log(`  ✅ Patched ${doc._id} (key=${needsKey}, name=${needsName})`);
  }

  console.log(`\nDone. Updated ${updated} of ${docs.length} document(s).`);
  await mongoose.disconnect();
}

backfillPaymentsModuleIdentity().catch((err) => {
  console.error(err);
  process.exit(1);
});
