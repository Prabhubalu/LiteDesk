#!/usr/bin/env node
/**
 * C4: Seed default CatalogPriceBook + entries from variant selling_price.
 *
 * Usage:
 *   node server/scripts/migrateVariantPricesToDefaultBook.js [--dry-run]
 */

const { loadEnv, resolveMasterMongoUri } = require('./lib/resolveMongoUri');

loadEnv();
const mongoose = require('mongoose');
const ItemVariant = require('../models/ItemVariant');
const CatalogPriceBookEntry = require('../models/CatalogPriceBookEntry');
const { ensureDefaultPriceBook } = require('../services/catalogPriceBookService');

const DRY_RUN = process.argv.includes('--dry-run');

async function run() {
  const { uri, dbName } = resolveMasterMongoUri();

  await mongoose.connect(uri);
  console.log(`[migrateVariantPricesToDefaultBook] connected db=${dbName} (dryRun=${DRY_RUN})`);

  const orgBookIds = new Map();
  let processed = 0;
  let seeded = 0;
  let skipped = 0;

  const cursor = ItemVariant.find({}).cursor();

  for await (const variant of cursor) {
    processed += 1;
    const orgKey = String(variant.organizationId);
    const sellingPrice = variant.selling_price;
    if (sellingPrice == null || Number(sellingPrice) <= 0) {
      skipped += 1;
      continue;
    }

    let priceBookId = orgBookIds.get(orgKey);
    if (!priceBookId) {
      if (DRY_RUN) {
        console.log(`[dry-run] ensure default price book for org ${orgKey}`);
        priceBookId = 'dry-run-book';
      } else {
        const book = await ensureDefaultPriceBook(variant.organizationId, variant.createdBy || variant.modifiedBy);
        priceBookId = book._id;
      }
      orgBookIds.set(orgKey, priceBookId);
    }

    if (DRY_RUN) {
      console.log(`[dry-run] seed entry variant=${variant._id} price=${sellingPrice}`);
      seeded += 1;
      continue;
    }

    const existing = await CatalogPriceBookEntry.findOne({
      organizationId: variant.organizationId,
      priceBookId,
      variantId: variant._id
    }).select('_id').lean();

    if (existing) {
      skipped += 1;
      continue;
    }

    await CatalogPriceBookEntry.create({
      organizationId: variant.organizationId,
      priceBookId,
      variantId: variant._id,
      unitPrice: Number(sellingPrice),
      currency: variant.currency || 'USD',
      minQty: 1,
      createdBy: variant.createdBy || variant.modifiedBy,
      modifiedBy: variant.modifiedBy || variant.createdBy
    });
    seeded += 1;
  }

  console.log(
    `[migrateVariantPricesToDefaultBook] done processed=${processed} seeded=${seeded} skipped=${skipped} orgs=${orgBookIds.size}`
  );
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('[migrateVariantPricesToDefaultBook] failed:', err);
  process.exit(1);
});
