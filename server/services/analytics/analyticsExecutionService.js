const AnalyticsExecution = require('../../models/AnalyticsExecution');
const AnalyticsReport = require('../../models/AnalyticsReport');
const { executeAnalyticsReport } = require('./analyticsEngine');
const {
  buildCacheKey,
  getCachedResult,
  setCachedResult,
} = require('./analyticsCacheService');
const { ANALYTICS_DEFAULT_CACHE_TTL_SECONDS } = require('../../constants/analyticsExecution');

async function createExecutionRecord({
  organizationId,
  reportId,
  reportVersion,
  triggeredBy,
  preview,
  runtimeFilters,
  rowLimit,
}) {
  return AnalyticsExecution.create({
    organizationId,
    reportId,
    reportVersion: reportVersion || 1,
    status: 'running',
    triggeredBy,
    preview: Boolean(preview),
    runtimeFilters: runtimeFilters || null,
    rowLimit: rowLimit || null,
    startedAt: new Date(),
  });
}

async function completeExecution(executionId, organizationId, patch) {
  return AnalyticsExecution.findOneAndUpdate(
    { _id: executionId, organizationId },
    {
      $set: {
        ...patch,
        completedAt: new Date(),
      },
    },
    { new: true }
  ).lean();
}

async function failExecution(executionId, organizationId, errorMessage) {
  return completeExecution(executionId, organizationId, {
    status: 'failed',
    error: errorMessage,
  });
}

async function updateReportRuntimeStats(reportId, organizationId, { success, executionMs, rowCount, error }) {
  const $set = {
    lastExecutedAt: new Date(),
    lastExecutionStatus: success ? 'success' : 'failed',
    lastRuntime: executionMs ?? null,
    lastRecordCount: rowCount ?? null,
    lastError: error || null,
  };

  await AnalyticsReport.updateOne(
    { _id: reportId, organizationId },
    {
      $set,
      $inc: { executionCount: 1 },
    }
  );
}

/**
 * Core report run with optional cache (published reports only).
 */
async function runAnalyticsReportCore(report, context = {}) {
  const cacheEnabled = report.cacheEnabled !== false && !context.preview;
  const ttlMinutes = Number(report.cacheDuration) || ANALYTICS_DEFAULT_CACHE_TTL_SECONDS / 60;
  const ttlSeconds = Math.max(ttlMinutes * 60, 60);

  let cacheKey = null;
  if (cacheEnabled && report._id) {
    cacheKey = buildCacheKey({
      organizationId: context.organizationId,
      reportId: report._id,
      reportVersion: report.version,
      userId: context.user?._id,
      runtimeFilters: context.runtimeFilters,
      preview: context.preview,
    });

    const cached = await getCachedResult(cacheKey);
    if (cached) {
      return {
        ...cached,
        meta: { ...cached.meta, cached: true, executionMs: 0 },
      };
    }
  }

  const result = await executeAnalyticsReport(report, context);

  if (cacheKey && cacheEnabled) {
    await setCachedResult(cacheKey, result, ttlSeconds);
    result.meta.cached = false;
  }

  return result;
}

/**
 * Full execution with audit log + report stats.
 */
async function runAnalyticsReportWithLogging(report, context = {}) {
  let execution;
  if (context.executionId) {
    execution = await AnalyticsExecution.findOne({
      _id: context.executionId,
      organizationId: context.organizationId,
    });
    if (!execution) {
      const err = new Error('Execution record not found');
      err.code = 'EXECUTION_NOT_FOUND';
      throw err;
    }
  } else {
    execution = await createExecutionRecord({
      organizationId: context.organizationId,
      reportId: report._id,
      reportVersion: report.version,
      triggeredBy: context.user._id,
      preview: context.preview,
      runtimeFilters: context.runtimeFilters,
      rowLimit: context.rowLimit,
    });
  }

  const executionId = execution._id;

  try {
    const result = await runAnalyticsReportCore(report, context);

    await completeExecution(executionId, context.organizationId, {
      status: 'success',
      result,
      rowCount: result.meta?.totalRows ?? result.rows?.length ?? 0,
      durationMs: result.meta?.executionMs ?? 0,
      cached: result.meta?.cached === true,
    });

    if (report._id && !context.preview) {
      await updateReportRuntimeStats(report._id, context.organizationId, {
        success: true,
        executionMs: result.meta?.executionMs,
        rowCount: result.meta?.totalRows,
      });
    }

    return { executionId, result };
  } catch (error) {
    await failExecution(executionId, context.organizationId, error.message);

    if (report._id && !context.preview) {
      await updateReportRuntimeStats(report._id, context.organizationId, {
        success: false,
        error: error.message,
      });
    }

    throw error;
  }
}

async function listExecutions(organizationId, filters = {}) {
  const query = { organizationId };

  if (filters.reportId) query.reportId = filters.reportId;
  if (filters.status) query.status = filters.status;
  if (filters.triggeredBy) query.triggeredBy = filters.triggeredBy;

  const page = Math.max(parseInt(filters.page, 10) || 1, 1);
  const limit = Math.min(parseInt(filters.limit, 10) || 25, 100);
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    AnalyticsExecution.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('triggeredBy', 'firstName lastName email')
      .select('-result.rows')
      .lean(),
    AnalyticsExecution.countDocuments(query),
  ]);

  return {
    data,
    meta: { page, perPage: limit, total, totalPages: Math.ceil(total / limit) },
  };
}

async function getExecutionById(executionId, organizationId) {
  return AnalyticsExecution.findOne({ _id: executionId, organizationId })
    .populate('triggeredBy', 'firstName lastName email')
    .populate('reportId', 'name apiName type primaryModule version')
    .lean();
}

/**
 * Resolve the report document bound to an analytics widget.
 * When a pinned reportVersion no longer matches (report republished), fall back to the
 * current published report for the same reportId.
 */
async function resolveWidgetBoundReport(widget, organizationId) {
  if (!widget?.reportId) return null;

  const baseQuery = {
    _id: widget.reportId,
    organizationId,
  };

  if (widget.reportVersion) {
    const pinned = await AnalyticsReport.findOne({
      ...baseQuery,
      version: widget.reportVersion,
    }).lean();
    if (pinned) return pinned;
  }

  return AnalyticsReport.findOne({
    ...baseQuery,
    status: 'published',
  }).lean();
}

module.exports = {
  createExecutionRecord,
  runAnalyticsReportCore,
  runAnalyticsReportWithLogging,
  listExecutions,
  getExecutionById,
  updateReportRuntimeStats,
  resolveWidgetBoundReport,
};
