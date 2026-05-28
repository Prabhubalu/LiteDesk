#!/usr/bin/env node
/**
 * Seed Item.media[] from legacy product_image.
 *
 * Usage:
 *   node server/scripts/migrateItemProductImageToGallery.js [--dry-run]
 */

const { loadEnv, resolveMasterMongoUri } = require('./lib/resolveMongoUri');

loadEnv();
const mongoose = require('mongoose');
const Item = require('../models/Item');
const { seedMediaFromProductImage } = require('../services/itemMediaService');
const ItemVariant = require('../models/ItemVariant');
const { ensureDefaultVariant } = require('../services/itemVariantService');

const DRY_RUN = process.argv.includes('--dry-run');

async function run() {
  const { uri, dbName } = resolveMasterMongoUri();

  await mongoose.connect(uri);
  console.log(`[migrateItemProductImageToGallery] connected db=${dbName} (dryRun=${DRY_RUN})`);

  const cursor = Item.find({
    deletedAt: null,
    product_image: { $exists: true, $nin: [null, ''] },
    $or: [{ media: { $exists: false } }, { media: { $size: 0 } }]
  }).cursor();

  let mediaSeeded = 0;
  let variantsEnsured = 0;

  for await (const item of cursor) {
    if (DRY_RUN) {
      console.log(`[dry-run] seed media for item ${item._id} from ${item.product_image}`);
    } else {
      await seedMediaFromProductImage(item, item.createdBy);
    }
    mediaSeeded += 1;
  }

  const allItems = Item.find({ deletedAt: null }).cursor();
  for await (const item of allItems) {
    const hasDefault = await ItemVariant.findOne({
      organizationId: item.organizationId,
      itemId: item._id,
      is_default: true
    }).select('_id').lean();

    if (!hasDefault) {
      if (DRY_RUN) {
        console.log(`[dry-run] ensure default variant for item ${item._id}`);
      } else {
        await ensureDefaultVariant(item, item.createdBy);
      }
      variantsEnsured += 1;
    }
  }

  console.log(`[migrateItemProductImageToGallery] done mediaSeeded=${mediaSeeded} variantsEnsured=${variantsEnsured}`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('[migrateItemProductImageToGallery] failed:', err);
  process.exit(1);
});
