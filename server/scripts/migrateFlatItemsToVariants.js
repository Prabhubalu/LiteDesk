#!/usr/bin/env node
/**
 * C3: Ensure every Item has a default ItemVariant with full sellable fields + linkage.
 *
 * Usage:
 *   node server/scripts/migrateFlatItemsToVariants.js [--dry-run]
 */

const { loadEnv, resolveMasterMongoUri } = require('./lib/resolveMongoUri');

loadEnv();
const mongoose = require('mongoose');
const Item = require('../models/Item');
const ItemVariant = require('../models/ItemVariant');
const {
  ensureDefaultVariant,
  upsertDefaultVariantFields,
  refreshItemVariantLinkage
} = require('../services/itemVariantService');

const DRY_RUN = process.argv.includes('--dry-run');

async function run() {
  const { uri, dbName } = resolveMasterMongoUri();

  await mongoose.connect(uri);
  console.log(`[migrateFlatItemsToVariants] connected db=${dbName} (dryRun=${DRY_RUN})`);

  const cursor = Item.find({ deletedAt: null }).cursor();
  let processed = 0;
  let created = 0;
  let updated = 0;
  let linked = 0;

  for await (const item of cursor) {
    processed += 1;
    const existing = await ItemVariant.findOne({
      organizationId: item.organizationId,
      itemId: item._id,
      is_default: true
    });

    if (DRY_RUN) {
      if (!existing) {
        console.log(`[dry-run] create default variant for item ${item._id} (${item.item_code || item.item_name})`);
        created += 1;
      } else {
        console.log(`[dry-run] sync sellable fields on variant ${existing._id} for item ${item._id}`);
        updated += 1;
      }
      linked += 1;
      continue;
    }

    if (!existing) {
      await ensureDefaultVariant(item, item.createdBy || item.modifiedBy);
      created += 1;
    } else {
      await upsertDefaultVariantFields({
        item,
        userId: item.modifiedBy || item.createdBy,
        variantPayload: {}
      });
      updated += 1;
    }

    await refreshItemVariantLinkage(item._id, item.organizationId);
    linked += 1;
  }

  console.log(`[migrateFlatItemsToVariants] done processed=${processed} created=${created} updated=${updated} linked=${linked}`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('[migrateFlatItemsToVariants] failed:', err);
  process.exit(1);
});
