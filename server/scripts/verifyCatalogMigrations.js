#!/usr/bin/env node
/**
 * Read-only checks for catalog migration completeness (master DB).
 *
 * Usage:
 *   node scripts/verifyCatalogMigrations.js
 *   node scripts/verifyCatalogMigrations.js --org <organizationId>
 *
 * Note: If your tenant uses a dedicated DB, run equivalent checks there too.
 */
const mongoose = require('mongoose');
const Item = require('../models/Item');
const ItemVariant = require('../models/ItemVariant');
const CatalogCategory = require('../models/CatalogCategory');
const CatalogPriceBook = require('../models/CatalogPriceBook');
const CatalogPriceBookEntry = require('../models/CatalogPriceBookEntry');
const { resolveMasterMongoUri } = require('./lib/resolveMongoUri');

async function main() {
  const orgArgIdx = process.argv.indexOf('--org');
  const orgFilter = orgArgIdx >= 0 ? process.argv[orgArgIdx + 1] : null;

  const master = resolveMasterMongoUri();
  const uri = typeof master === 'string' ? master : master?.uri;
  const dbName = typeof master === 'object' ? master?.dbName : undefined;
  if (!uri || typeof uri !== 'string') {
    throw new Error('Could not resolve master MongoDB URI (expected string)');
  }
  await mongoose.connect(uri, dbName ? { dbName } : undefined);
  console.log(`[verify-catalog] Connected to master DB${dbName ? ` (db=${dbName})` : ''}`);

  const itemQuery = { deletedAt: null };
  if (orgFilter && mongoose.Types.ObjectId.isValid(orgFilter)) {
    itemQuery.organizationId = new mongoose.Types.ObjectId(orgFilter);
  }

  const [
    totalItems,
    missingLifecycle,
    missingCategoryIdWithLegacyCategory,
    itemsWithoutVariants,
    itemsWithMultipleDefaults,
    orgsWithoutPriceBook,
    entriesWithoutVariant
  ] = await Promise.all([
    Item.countDocuments(itemQuery),
    Item.countDocuments({ ...itemQuery, lifecycle_state: { $in: [null, ''] } }),
    Item.countDocuments({
      ...itemQuery,
      category: { $exists: true, $nin: [null, ''] },
      $or: [{ categoryId: null }, { categoryId: { $exists: false } }]
    }),
    Item.aggregate([
      { $match: itemQuery },
      {
        $lookup: {
          from: 'itemvariants',
          localField: '_id',
          foreignField: 'itemId',
          as: 'variants'
        }
      },
      { $match: { variants: { $size: 0 } } },
      { $count: 'n' }
    ]).then((r) => r[0]?.n || 0),
    ItemVariant.aggregate([
      { $match: orgFilter ? { organizationId: new mongoose.Types.ObjectId(orgFilter) } : {} },
      { $match: { is_default: true } },
      { $group: { _id: { organizationId: '$organizationId', itemId: '$itemId' }, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $count: 'n' }
    ]).then((r) => r[0]?.n || 0),
    Item.aggregate([
      { $match: itemQuery },
      {
        $lookup: {
          from: 'catalogpricebooks',
          localField: 'organizationId',
          foreignField: 'organizationId',
          as: 'books'
        }
      },
      { $match: { books: { $size: 0 } } },
      { $group: { _id: '$organizationId' } },
      { $count: 'n' }
    ]).then((r) => r[0]?.n || 0),
    CatalogPriceBookEntry.aggregate([
      {
        $lookup: {
          from: 'itemvariants',
          localField: 'variantId',
          foreignField: '_id',
          as: 'variant'
        }
      },
      { $match: { variant: { $size: 0 } } },
      { $count: 'n' }
    ]).then((r) => r[0]?.n || 0)
  ]);

  const report = {
    totalItems,
    missingLifecycle,
    missingCategoryIdWithLegacyCategory,
    itemsWithoutVariants,
    itemsWithMultipleDefaultVariants: itemsWithMultipleDefaults,
    organizationsWithoutAnyPriceBook: orgsWithoutPriceBook,
    orphanPriceBookEntries: entriesWithoutVariant
  };

  console.log('\n[verify-catalog] Report:');
  console.table(report);

  const warnings = [];
  if (missingLifecycle > 0) warnings.push('Items missing lifecycle_state');
  if (missingCategoryIdWithLegacyCategory > 0) warnings.push('Items with legacy category string but no categoryId');
  if (itemsWithoutVariants > 0) warnings.push('Items with zero variants (run migrate:catalog-variants)');
  if (itemsWithMultipleDefaults > 0) warnings.push('Items with multiple default variants');
  if (orgsWithoutPriceBook > 0) warnings.push('Organizations with items but no price books');
  if (entriesWithoutVariant > 0) warnings.push('Price book entries pointing to missing variants');

  if (warnings.length) {
    console.warn('\n[verify-catalog] Warnings:');
    warnings.forEach((w) => console.warn(`  - ${w}`));
    process.exitCode = 1;
  } else {
    console.log('\n[verify-catalog] OK — no issues detected.');
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('[verify-catalog] Failed:', err);
  process.exit(1);
});
