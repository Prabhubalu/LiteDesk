/**
 * Backfill Item.assignedTo from createdBy (or modifiedBy) for legacy rows.
 *
 * Usage: node server/scripts/backfillItemAssignedTo.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Item = require('../models/Item');

async function run() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('Missing MONGODB_URI');
    process.exit(1);
  }
  await mongoose.connect(uri);

  const filter = {
    $or: [{ assignedTo: null }, { assignedTo: { $exists: false } }],
  };

  const cursor = Item.find(filter).select('_id createdBy modifiedBy').cursor();
  let updated = 0;
  let skipped = 0;

  for await (const doc of cursor) {
    const assignee = doc.createdBy || doc.modifiedBy;
    if (!assignee) {
      skipped += 1;
      continue;
    }
    await Item.updateOne({ _id: doc._id }, { $set: { assignedTo: assignee } });
    updated += 1;
  }

  console.log(`backfillItemAssignedTo: updated=${updated} skipped=${skipped}`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
