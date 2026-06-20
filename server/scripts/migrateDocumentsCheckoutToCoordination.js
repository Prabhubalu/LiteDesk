'use strict';

/**
 * Migrate legacy checkout fields to editing coordination reservation fields.
 *
 * Usage: node server/scripts/migrateDocumentsCheckoutToCoordination.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const DEFAULT_RESERVATION_HOURS = Math.min(
  72,
  Math.max(1, parseInt(process.env.DOCUMENT_RESERVATION_HOURS || '8', 10))
);

async function migrateCollection(Document) {
  const legacyDocs = await Document.find({
    $or: [
      { checkedOutBy: { $ne: null } },
      { checkedOutAt: { $ne: null } }
    ]
  }).select('_id checkedOutBy checkedOutAt title');

  let migrated = 0;
  for (const doc of legacyDocs) {
    const reservedAt = doc.checkedOutAt || new Date();
    const expiresAt = new Date(reservedAt.getTime() + DEFAULT_RESERVATION_HOURS * 60 * 60 * 1000);

    await Document.updateOne(
      { _id: doc._id },
      {
        $set: {
          reservationStatus: expiresAt.getTime() > Date.now() ? 'reserved' : 'available',
          reservedBy: doc.checkedOutBy || null,
          reservedAt: doc.checkedOutBy ? reservedAt : null,
          reservationExpiresAt: doc.checkedOutBy ? expiresAt : null,
          reservationReason: 'Migrated from legacy checkout'
        },
        $unset: {
          checkedOutBy: '',
          checkedOutAt: ''
        }
      }
    );
    migrated += 1;
  }

  return migrated;
}

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGODB_URI is required');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const Document = require('../models/Document');

  const migrated = await migrateCollection(Document);
  console.log(`Migrated ${migrated} document(s) from checkout to reservation fields.`);

  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { migrateCollection };
