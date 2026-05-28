#!/usr/bin/env node
/**
 * Map flat item.category/subcategory strings to CatalogCategory tree + categoryId.
 *
 * Usage:
 *   node server/scripts/migrateItemFlatCategories.js [--dry-run]
 */

const { loadEnv, resolveMasterMongoUri } = require('./lib/resolveMongoUri');

loadEnv();
const mongoose = require('mongoose');
const Item = require('../models/Item');
const CatalogCategory = require('../models/CatalogCategory');
const { slugifyCatalogKey } = require('../constants/catalogAttributeTypes');
const { buildCategoryPath } = require('../services/catalogCategoryService');

const DRY_RUN = process.argv.includes('--dry-run');

async function findOrCreateCategory({ organizationId, userId, name, parentId, parentPath }) {
  const slug = slugifyCatalogKey(name);
  const path = buildCategoryPath(parentPath, slug);

  let category = await CatalogCategory.findOne({ organizationId, path });
  if (category) return category;

  if (DRY_RUN) {
    console.log(`[dry-run] create category ${path}`);
    return { _id: new mongoose.Types.ObjectId(), name, path, parentId };
  }

  return CatalogCategory.create({
    organizationId,
    name,
    slug,
    parentId: parentId || null,
    path,
    sortOrder: 0,
    isActive: true,
    createdBy: userId,
    modifiedBy: userId
  });
}

async function run() {
  const { uri, dbName } = resolveMasterMongoUri();

  await mongoose.connect(uri);
  console.log(`[migrateItemFlatCategories] connected db=${dbName} (dryRun=${DRY_RUN})`);

  const items = await Item.find({
    deletedAt: null,
    $or: [{ categoryId: null }, { categoryId: { $exists: false } }],
    category: { $exists: true, $nin: [null, ''] }
  }).select('_id organizationId category subcategory createdBy').lean();

  let updated = 0;

  for (const item of items) {
    const root = await findOrCreateCategory({
      organizationId: item.organizationId,
      userId: item.createdBy,
      name: item.category,
      parentId: null,
      parentPath: null
    });

    let leaf = root;
    if (item.subcategory) {
      leaf = await findOrCreateCategory({
        organizationId: item.organizationId,
        userId: item.createdBy,
        name: item.subcategory,
        parentId: root._id,
        parentPath: root.path
      });
    }

    if (DRY_RUN) {
      console.log(`[dry-run] item ${item._id} -> categoryId ${leaf._id}`);
    } else {
      await Item.updateOne(
        { _id: item._id },
        { $set: { categoryId: leaf._id } }
      );
    }
    updated += 1;
  }

  console.log(`[migrateItemFlatCategories] done updated=${updated}`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('[migrateItemFlatCategories] failed:', err);
  process.exit(1);
});
