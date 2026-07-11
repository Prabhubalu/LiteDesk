/**
 * Migrate legacy Deal.lineItems Mixed blobs → DealLine entities, then unset lineItems.
 * Walks each tenant DB (deals live in tenant databases, not master).
 *
 * Usage:
 *   node server/scripts/migrateDealLineItemsToDealLines.js [--dry-run] [--org=<organizationId>]
 *
 * Safe to re-run: skips deals that already have active DealLines.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const mongoose = require('mongoose');
const Organization = require('../models/Organization');
const dbConnectionManager = require('../utils/databaseConnectionManager');
const { runWithTenantContext } = require('../utils/tenantContext');
const { getMongoUris } = require('../lib/mongoConnect');
const { generateDealLineId } = require('../models/DealLine');
const { CURRENT_DEAL_PRICING_VERSION } = require('../constants/dealPricingVersion');
const { DEFAULT_DEAL_AMOUNT_MODE } = require('../constants/dealAmountMode');
const { computeLineTotals } = require('../services/quoteTotalsService');

const dryRun = process.argv.includes('--dry-run');
const orgArg = process.argv.find((a) => a.startsWith('--org='));
const orgFilter = orgArg ? orgArg.slice('--org='.length) : null;

function toNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

async function migrateTenant(tenant) {
  const dbName = tenant.database?.name;
  const stats = { scanned: 0, migrated: 0, skipped: 0, unsetOnly: 0 };

  const runMigrate = async () => {
    const Deal = require('../models/Deal');
    const DealLine = require('../models/DealLine');

    // lineItems was removed from the schema — read legacy blobs from the raw collection
    const dealQuery = {
      deletedAt: null,
      organizationId: tenant._id
    };
    const cursor = Deal.collection.find(dealQuery);

    for await (const dealDoc of cursor) {
      stats.scanned += 1;
      const dealId = dealDoc._id;
      const legacy = dealDoc.lineItems;
      const hasLegacy = Array.isArray(legacy) && legacy.length > 0;
      const hasLineItemsKey = Object.prototype.hasOwnProperty.call(dealDoc, 'lineItems');

      const existingCount = await DealLine.countDocuments({
        organizationId: tenant._id,
        dealId,
        deletedAt: null
      });

      if (existingCount > 0) {
        if (hasLineItemsKey) {
          if (!dryRun) {
            await Deal.collection.updateOne({ _id: dealId }, { $unset: { lineItems: 1 } });
          }
          stats.unsetOnly += 1;
        }
        stats.skipped += 1;
        continue;
      }

      if (!dealDoc.amountMode) {
        if (!dryRun) {
          await Deal.collection.updateOne(
            { _id: dealId },
            { $set: { amountMode: DEFAULT_DEAL_AMOUNT_MODE } }
          );
        }
      }

      if (!hasLegacy) {
        if (hasLineItemsKey) {
          if (!dryRun) {
            await Deal.collection.updateOne({ _id: dealId }, { $unset: { lineItems: 1 } });
          }
          stats.unsetOnly += 1;
        }
        continue;
      }

      console.log(
        `[${tenant.name || tenant._id}] Migrating deal ${dealId} (${legacy.length} legacy lines)`
      );

      if (!dryRun) {
        let order = 1;
        for (const raw of legacy) {
          if (!raw || typeof raw !== 'object') continue;
          const quantity = toNumber(raw.quantity, 1);
          const unitPrice = toNumber(raw.price ?? raw.unitPrice ?? raw.expectedUnitPrice, 0);
          const discountAmount = toNumber(raw.discount ?? raw.discountAmount, 0);
          const computed = computeLineTotals({
            quantity,
            unitPriceSnapshot: unitPrice,
            discountType: raw.discountType || (discountAmount ? 'amount' : null),
            discountValue: toNumber(raw.discountValue, discountAmount),
            discountAmount
          });

          await DealLine.create({
            organizationId: tenant._id,
            dealId,
            dealLineId: generateDealLineId(),
            lineType: raw.lineType || 'product',
            lineOrder: order++,
            itemId: raw.itemId || null,
            variantId: raw.variantId || null,
            quantity,
            skuSnapshot: raw.skuSnapshot || raw.sku || null,
            nameSnapshot: raw.nameSnapshot || raw.name || raw.itemName || 'Migrated line',
            descriptionSnapshot: raw.descriptionSnapshot || raw.description || null,
            unitOfMeasureSnapshot: raw.unitOfMeasureSnapshot || raw.unitOfMeasure || null,
            expectedUnitPrice: unitPrice,
            listPriceSnapshot: unitPrice,
            pricingSourceSnapshot: 'migration',
            discountType: raw.discountType || (discountAmount ? 'amount' : null),
            discountValue: toNumber(raw.discountValue, discountAmount),
            discountAmount,
            lineSubtotal: computed.lineSubtotal,
            lineTaxTotal: computed.lineTaxTotal,
            lineTotal: toNumber(raw.total, computed.lineTotal),
            currencySnapshot: dealDoc.currency || 'USD',
            pricingVersion: CURRENT_DEAL_PRICING_VERSION
          });
        }

        const dealPricingService = require('../services/dealPricingService');
        await dealPricingService.recalculateDeal({
          organizationId: tenant._id,
          dealId
        });

        await Deal.collection.updateOne({ _id: dealId }, { $unset: { lineItems: 1 } });
      }

      stats.migrated += 1;
    }
  };

  if (!dbName) {
    // Org not on a dedicated tenant DB — deals may still live on master
    stats.reason = 'master_fallback';
    await runMigrate();
    return stats;
  }

  const conn = await dbConnectionManager.getOrganizationConnection(dbName);
  if (conn.readyState !== 1) await conn.asPromise();

  await runWithTenantContext(
    { organizationId: tenant._id, connection: conn, databaseName: dbName },
    runMigrate
  );

  return stats;
}

async function migrate() {
  const { masterUri } = getMongoUris();
  if (!masterUri) {
    console.error(
      'Missing Mongo URI. Set MONGO_URI_LOCAL (or MONGODB_URI / MONGO_URI) in server/.env'
    );
    process.exit(1);
  }

  await mongoose.connect(masterUri);
  await dbConnectionManager.initializeMasterConnection();
  console.log(
    `[migrateDealLineItemsToDealLines] Connected to ${mongoose.connection.name}${dryRun ? ' (dry-run)' : ''}`
  );

  const orgQuery = { isTenant: true, isActive: { $ne: false } };
  if (orgFilter) orgQuery._id = orgFilter;

  const tenants = await Organization.find(orgQuery)
    .select('_id name database.name')
    .lean();

  console.log(`[migrateDealLineItemsToDealLines] Tenants: ${tenants.length}`);

  const totals = { scanned: 0, migrated: 0, skipped: 0, unsetOnly: 0 };

  for (const tenant of tenants) {
    try {
      const stats = await migrateTenant(tenant);
      totals.scanned += stats.scanned;
      totals.migrated += stats.migrated;
      totals.skipped += stats.skipped;
      totals.unsetOnly += stats.unsetOnly;
      if (stats.scanned > 0 || stats.reason) {
        console.log(
          `  ${tenant.name || tenant._id}: scanned=${stats.scanned} migrated=${stats.migrated}` +
            (stats.reason ? ` (${stats.reason})` : '')
        );
      }
    } catch (err) {
      console.error(`  ${tenant.name || tenant._id}: FAILED`, err.message || err);
    }
  }

  console.log(JSON.stringify({ dryRun, tenants: tenants.length, ...totals }, null, 2));
  await mongoose.disconnect();
  process.exit(0);
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
