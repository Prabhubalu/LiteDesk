const AnalyticsReport = require('../../models/AnalyticsReport');
const User = require('../../models/User');
const objectStorage = require('../objectStorageService');
const { runAnalyticsReportWithLogging } = require('./analyticsExecutionService');
const { resultToCsv } = require('./analyticsExportService');
const { buildOrgPermissionContext } = require('../runtimePermissionResolver');
const { registerStoredFileAsDocument } = require('../documentService');

const ENTITY_TYPE_TO_MODULE = Object.freeze({
  deal: 'deals',
  deals: 'deals',
  people: 'people',
  person: 'people',
  contact: 'people',
  organization: 'organizations',
  organizations: 'organizations',
  case: 'cases',
  cases: 'cases',
  task: 'tasks',
  tasks: 'tasks',
  quote: 'quotes',
  quotes: 'quotes',
});

const ENTITY_TYPE_TO_APP_KEY = Object.freeze({
  deals: 'SALES',
  people: 'SALES',
  organizations: 'SALES',
  quotes: 'SALES',
  cases: 'HELPDESK',
  tasks: 'PLATFORM',
});

function resolveModuleKey(entityType) {
  const key = String(entityType || '').trim().toLowerCase();
  return ENTITY_TYPE_TO_MODULE[key] || null;
}

function resolveAppKeyForModule(moduleKey) {
  return ENTITY_TYPE_TO_APP_KEY[moduleKey] || 'PLATFORM';
}

async function loadAutomationUser(organizationId, userId) {
  const user = await User.findOne({ _id: userId, organizationId }).select('-password');
  if (!user) {
    const err = new Error('User not found for report execution');
    err.statusCode = 404;
    throw err;
  }

  try {
    const { hydrateUserPermissionsFromRole } = require('../utils/rolePermissionProjection');
    await hydrateUserPermissionsFromRole(user);
  } catch (_err) {
    /* optional */
  }

  return user;
}

async function loadPublishedReport(reportId, organizationId) {
  const report = await AnalyticsReport.findOne({
    _id: reportId,
    organizationId,
    status: 'published',
  }).lean();

  if (!report) {
    const err = new Error('Published report not found');
    err.statusCode = 404;
    throw err;
  }
  return report;
}

function buildExecutionContext(user, organizationId, organization, runtimeFilters) {
  return {
    user,
    organizationId,
    orgContext: organization ? buildOrgPermissionContext(organization) : undefined,
    runtimeFilters: runtimeFilters || null,
    preview: false,
  };
}

async function uploadCsvExport({ organizationId, report, csvContent }) {
  const safeName = String(report.apiName || report.name || 'report')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .slice(0, 80);
  const key = `analytics/exports/${organizationId}/${report._id}/${Date.now()}-${safeName}.csv`;
  const buffer = Buffer.from(csvContent, 'utf8');
  const { bucket } = await objectStorage.putBuffer({
    key,
    buffer,
    contentType: 'text/csv',
    metadata: { reportId: String(report._id), source: 'analytics_automation' },
  });
  return {
    storagePath: `oci:${key}`,
    bucket,
    fileName: `${safeName}.csv`,
    fileSizeBytes: buffer.length,
  };
}

/**
 * Execute a published analytics report and optionally attach CSV to triggering record.
 */
async function runAnalyticsReportForAutomation({
  organizationId,
  userId,
  reportId,
  entityType,
  entityId,
  appKey,
  attachToRecord = true,
  runtimeFilters = null,
}) {
  const user = await loadAutomationUser(organizationId, userId);
  const report = await loadPublishedReport(reportId, organizationId);
  const context = buildExecutionContext(user, organizationId, null, runtimeFilters);

  const { result } = await runAnalyticsReportWithLogging(report, context);
  const csvContent = resultToCsv(result);

  await AnalyticsReport.updateOne(
    { _id: report._id, organizationId },
    { $inc: { apiUsage: 1 } }
  );

  let documentId = null;
  if (attachToRecord && entityType && entityId) {
    const moduleKey = resolveModuleKey(entityType);
    if (moduleKey) {
      const upload = await uploadCsvExport({ organizationId, report, csvContent });
      const effectiveAppKey = appKey || resolveAppKeyForModule(moduleKey);
      const registration = await registerStoredFileAsDocument({
        organizationId,
        userId: user._id,
        moduleKey,
        recordId: entityId,
        appKey: effectiveAppKey,
        storagePath: upload.storagePath,
        fileName: upload.fileName,
        mimeType: 'text/csv',
        fileSizeBytes: upload.fileSizeBytes,
        changeSummary: `Analytics report export: ${report.name}`,
      });
      documentId = registration?.document?._id ? String(registration.document._id) : null;
    }
  }

  return {
    ok: true,
    reportId: String(report._id),
    rowCount: result?.rows?.length ?? 0,
    documentId,
  };
}

module.exports = {
  runAnalyticsReportForAutomation,
  resolveModuleKey,
  ENTITY_TYPE_TO_MODULE,
};
