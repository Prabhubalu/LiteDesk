/**
 * Migrate legacy `reports` collection documents to `analyticsreports`.
 *
 * Usage:
 *   node server/scripts/migrateLegacyReportsToAnalytics.js --dry-run
 *   node server/scripts/migrateLegacyReportsToAnalytics.js --org-id=<ObjectId>
 *
 * Idempotent: skips when apiName already exists on AnalyticsReport for org.
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const Report = require('../models/Report');
const AnalyticsReport = require('../models/AnalyticsReport');
const { enterTenantContext } = require('../utils/tenantContext');
const dbConnectionManager = require('../utils/databaseConnectionManager');

const ENTITY_TO_MODULE = {
  deals: 'deals',
  contacts: 'people',
  tasks: 'tasks',
  events: 'events',
  forms: 'forms',
};

const REPORT_TYPE_TO_ANALYTICS_TYPE = {
  sales: 'summary',
  activity: 'tabular',
  funnel: 'summary',
  custom: 'tabular',
};

function slugifyApiName(name, fallbackId) {
  const base = String(name || 'report')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80);
  return base || `report_${String(fallbackId).slice(-6)}`;
}

function convertFiltersToFilterTree(legacyFilters) {
  if (!Array.isArray(legacyFilters) || legacyFilters.length === 0) return null;
  return {
    logic: 'AND',
    children: legacyFilters.map((f) => ({
      fieldKey: f.field,
      operator: f.operator || 'equals',
      value: f.value,
    })),
  };
}

function convertMetricsToAggregations(metrics) {
  if (!Array.isArray(metrics) || metrics.length === 0) return null;
  return metrics.map((m) => ({
    field: m.field,
    fn: m.aggregation || 'count',
    label: m.label || m.field,
  }));
}

function convertGroupBy(rowGroups) {
  if (!Array.isArray(rowGroups) || rowGroups.length === 0) return null;
  return rowGroups.map((field) => ({ field }));
}

function mapLegacyReport(doc) {
  const primaryModule = ENTITY_TO_MODULE[doc.entity] || doc.entity || 'deals';
  const apiName = slugifyApiName(doc.name, doc._id);

  const selectedFields = [];
  if (Array.isArray(doc.groupBy)) {
    doc.groupBy.forEach((f) => selectedFields.push({ field: f, role: 'dimension' }));
  }
  if (Array.isArray(doc.metrics)) {
    doc.metrics.forEach((m) =>
      selectedFields.push({ field: m.field, role: 'metric', aggregation: m.aggregation })
    );
  }

  return {
    organizationId: doc.organizationId,
    name: doc.name,
    apiName,
    description: doc.description || null,
    type: REPORT_TYPE_TO_ANALYTICS_TYPE[doc.reportType] || 'tabular',
    category: 'custom',
    status: 'draft',
    version: 1,
    tags: [],
    primaryModule,
    relatedModules: [],
    selectedFields: selectedFields.length ? selectedFields : [{ field: '_id', role: 'dimension' }],
    filterTree: convertFiltersToFilterTree(doc.filters),
    filterLogic: 'AND',
    relativeDateFilters: doc.dateRange?.type
      ? { preset: doc.dateRange.type, startDate: doc.dateRange.startDate, endDate: doc.dateRange.endDate }
      : null,
    rowGroups: convertGroupBy(doc.groupBy),
    aggregations: convertMetricsToAggregations(doc.metrics),
    sorting: doc.sortBy ? [{ field: doc.sortBy, order: doc.sortOrder || 'asc' }] : null,
    ownerId: doc.createdBy,
    visibility: doc.isPublic ? 'organization' : 'private',
    sharedWith: Array.isArray(doc.sharedWith)
      ? doc.sharedWith.map((id) => ({ type: 'user', id: String(id) }))
      : null,
    createdBy: doc.createdBy,
    updatedBy: doc.createdBy,
    schedulingEnabled: doc.isScheduled === true,
    schedule: doc.schedule || null,
    exportFormats: ['csv'],
    defaultExport: 'csv',
    _legacyChartType: doc.chartType || null,
    _legacyId: doc._id,
  };
}

async function migrateOrgReports(organizationId, { dryRun }) {
  const legacyReports = await Report.find({ organizationId }).lean();
  let created = 0;
  let skipped = 0;

  for (const legacy of legacyReports) {
    const payload = mapLegacyReport(legacy);
    const exists = await AnalyticsReport.findOne({
      organizationId,
      apiName: payload.apiName,
    }).lean();

    if (exists) {
      skipped += 1;
      console.log(`  skip (exists): ${payload.apiName}`);
      continue;
    }

    if (dryRun) {
      console.log(`  would create: ${payload.name} → ${payload.apiName} (${payload.type})`);
      if (payload._legacyChartType) {
        console.log(`    → widget needed: chartType=${payload._legacyChartType}`);
      }
      created += 1;
      continue;
    }

    const { _legacyChartType, _legacyId, ...createPayload } = payload;
    await AnalyticsReport.create(createPayload);
    console.log(`  created: ${payload.apiName}${_legacyChartType ? ` (chart→widget: ${_legacyChartType})` : ''}`);
    created += 1;
  }

  return { created, skipped, total: legacyReports.length };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const orgArg = args.find((a) => a.startsWith('--org-id='));
  const orgId = orgArg ? orgArg.split('=')[1] : null;

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log(`Migrate legacy reports → analyticsreports ${dryRun ? '(DRY RUN)' : ''}`);

  let orgIds = [];
  if (orgId) {
    orgIds = [new mongoose.Types.ObjectId(orgId)];
  } else {
    const distinct = await Report.distinct('organizationId');
    orgIds = distinct.filter(Boolean);
  }

  let totalCreated = 0;
  let totalSkipped = 0;

  for (const oid of orgIds) {
    console.log(`\nOrg ${oid}`);
    try {
      const org = await mongoose.connection.db
        .collection('organizations')
        .findOne({ _id: oid });
      const tenantDbName = org?.database?.name;
      if (tenantDbName && org?.database?.initialized) {
        const tenantConn = await dbConnectionManager.getOrganizationConnection(tenantDbName);
        await enterTenantContext(tenantConn, async () => {
          const result = await migrateOrgReports(oid, { dryRun });
          totalCreated += result.created;
          totalSkipped += result.skipped;
          console.log(`  ${result.created} migrated, ${result.skipped} skipped, ${result.total} legacy`);
        });
      } else {
        const result = await migrateOrgReports(oid, { dryRun });
        totalCreated += result.created;
        totalSkipped += result.skipped;
        console.log(`  ${result.created} migrated, ${result.skipped} skipped, ${result.total} legacy`);
      }
    } catch (err) {
      console.error(`  error: ${err.message}`);
    }
  }

  console.log(`\nDone: ${totalCreated} created, ${totalSkipped} skipped`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
