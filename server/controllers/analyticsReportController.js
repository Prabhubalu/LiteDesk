const AnalyticsReport = require('../models/AnalyticsReport');
const { buildOrgPermissionContext } = require('../services/runtimePermissionResolver');
const {
  runAnalyticsReportWithLogging,
  listExecutions,
  getExecutionById,
  createExecutionRecord,
} = require('../services/analytics/analyticsExecutionService');
const { executeAnalyticsReport } = require('../services/analytics/analyticsEngine');
const { resultToCsv, renderExportPayload, contentTypeForFormat, fileExtensionForFormat } = require('../services/analytics/analyticsExportService');
const { getAnalyticsCatalogPayload } = require('../services/analytics/analyticsCatalogService');
const { invalidateReportCache } = require('../services/analytics/analyticsCacheService');
const { enqueueAnalyticsExecution } = require('../services/analytics/analyticsQueueService');
const {
  ANALYTICS_ASYNC_RUNTIME_MS,
} = require('../constants/analyticsExecution');
const { assertCanEditCertifiedAsset, canCertifyAnalyticsAssets } = require('../services/analytics/analyticsCertificationService');
const { recordReportView } = require('../services/analytics/analyticsUsageService');

function slugifyApiName(name) {
  return String(name || 'report')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80);
}

async function ensureUniqueApiName(organizationId, apiName, excludeId = null) {
  const query = { organizationId, apiName, status: { $ne: 'archived' } };
  if (excludeId) query._id = { $ne: excludeId };
  const existing = await AnalyticsReport.findOne(query).select('_id').lean();
  if (existing) {
    const err = new Error('apiName already exists for this organization');
    err.code = 'DUPLICATE_API_NAME';
    err.statusCode = 409;
    throw err;
  }
}

function handleError(res, error, fallbackMessage) {
  const status =
    error.statusCode ||
    (error.code === 'CERTIFIED_ASSET_LOCKED' ? 403 : null) ||
    (error.code === 'DUPLICATE_API_NAME' ? 409 : 400);
  console.error(fallbackMessage, error);
  return res.status(status).json({
    success: false,
    message: error.message || fallbackMessage,
    code: error.code,
  });
}

function buildExecutionContext(req, body = {}) {
  return {
    user: req.user,
    organizationId: req.user.organizationId,
    orgContext: req.organization ? buildOrgPermissionContext(req.organization) : undefined,
    runtimeFilters: body.runtimeFilters,
    rowLimit: body.rowLimit,
    preview: body.preview === true,
  };
}

function shouldRunAsync(report, body) {
  if (body.async === true) return true;
  if (report.executionMode === 'async') return true;
  return false;
}

async function listReports(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const query = { organizationId };

    if (req.query.status) query.status = req.query.status;
    if (req.query.type) query.type = req.query.type;
    if (req.query.category) query.category = req.query.category;
    if (req.query.primaryModule) query.primaryModule = req.query.primaryModule;
    if (req.query.mine === 'true') query.ownerId = req.user._id;
    if (req.query.folderId === 'none') {
      query.folderId = null;
    } else if (req.query.folderId) {
      query.folderId = req.query.folderId;
    }

    if (req.query.search) {
      const regex = new RegExp(String(req.query.search), 'i');
      query.$or = [{ name: regex }, { apiName: regex }, { tags: regex }];
    }

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      AnalyticsReport.find(query)
        .select('-formulas -variables -executionOrder')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('createdBy', 'firstName lastName email')
        .populate('ownerId', 'firstName lastName email')
        .lean(),
      AnalyticsReport.countDocuments(query),
    ]);

    return res.json({
      success: true,
      data,
      meta: { page, perPage: limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return handleError(res, error, 'Error fetching analytics reports');
  }
}

async function createReport(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const name = String(req.body?.name || '').trim();
    if (!name) {
      return res.status(400).json({ success: false, message: 'name is required' });
    }

    const apiName = String(req.body?.apiName || slugifyApiName(name)).trim();
    await ensureUniqueApiName(organizationId, apiName);

    const report = await AnalyticsReport.create({
      ...req.body,
      name,
      apiName,
      organizationId,
      ownerId: req.user._id,
      createdBy: req.user._id,
      status: 'draft',
      version: 1,
      selectedFields: req.body?.selectedFields ?? [],
    });

    const populated = await AnalyticsReport.findById(report._id)
      .populate('createdBy', 'firstName lastName email')
      .populate('ownerId', 'firstName lastName email');

    return res.status(201).json({ success: true, data: populated });
  } catch (error) {
    return handleError(res, error, 'Error creating analytics report');
  }
}

async function getReportById(req, res) {
  try {
    const report = await AnalyticsReport.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    })
      .populate('createdBy', 'firstName lastName email')
      .populate('ownerId', 'firstName lastName email');

    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    recordReportView(report._id, req.user.organizationId, req.user._id).catch(() => {});

    const populated = await AnalyticsReport.findById(report._id)
      .populate('createdBy', 'firstName lastName email')
      .populate('ownerId', 'firstName lastName email')
      .populate('certifiedBy', 'firstName lastName email');

    return res.json({ success: true, data: populated || report });
  } catch (error) {
    return handleError(res, error, 'Error fetching analytics report');
  }
}

async function updateReport(req, res) {
  try {
    const report = await AnalyticsReport.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    });

    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    if (report.status === 'archived') {
      return res.status(400).json({ success: false, message: 'Archived reports cannot be edited' });
    }

    assertCanEditCertifiedAsset(req.user, report);

    const blocked = [
      '_id',
      'organizationId',
      'createdBy',
      'createdAt',
      'widgetCount',
      'dashboardCount',
      'certified',
      'certifiedBy',
      'certifiedAt',
      'viewCount',
      'lastViewedAt',
    ];
    for (const [key, value] of Object.entries(req.body || {})) {
      if (!blocked.includes(key)) {
        report[key] = value;
      }
    }

    if (req.body?.apiName && req.body.apiName !== report.apiName) {
      await ensureUniqueApiName(req.user.organizationId, req.body.apiName, report._id);
      report.apiName = req.body.apiName;
    }

    report.updatedBy = req.user._id;
    await report.save();
    await invalidateReportCache(req.user.organizationId, report._id);

    const updated = await AnalyticsReport.findById(report._id)
      .populate('createdBy', 'firstName lastName email')
      .populate('ownerId', 'firstName lastName email');

    return res.json({ success: true, data: updated });
  } catch (error) {
    return handleError(res, error, 'Error updating analytics report');
  }
}

async function deleteReport(req, res) {
  try {
    const report = await AnalyticsReport.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    });

    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    assertCanEditCertifiedAsset(req.user, report);

    if (report.widgetCount > 0) {
      return res.status(409).json({
        success: false,
        message: 'Report is referenced by widgets and cannot be deleted',
        code: 'REPORT_IN_USE',
      });
    }

    report.status = 'archived';
    report.archivedAt = new Date();
    report.updatedBy = req.user._id;
    await report.save();
    await invalidateReportCache(req.user.organizationId, report._id);

    return res.json({ success: true, message: 'Report archived' });
  } catch (error) {
    return handleError(res, error, 'Error archiving analytics report');
  }
}

async function publishReport(req, res) {
  try {
    const report = await AnalyticsReport.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    });

    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    assertCanEditCertifiedAsset(req.user, report);

    report.status = 'published';
    report.version = report.publishedAt ? (report.version || 1) + 1 : 1;
    report.publishedAt = new Date();
    report.updatedBy = req.user._id;
    await report.save();
    await invalidateReportCache(req.user.organizationId, report._id);

    return res.json({ success: true, data: report });
  } catch (error) {
    return handleError(res, error, 'Error publishing analytics report');
  }
}

async function executeReport(req, res) {
  try {
    const report = await AnalyticsReport.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    }).lean();

    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    const body = req.body || {};
    const preview = body.preview === true;
    if (report.status !== 'published' && !preview) {
      return res.status(400).json({
        success: false,
        message: 'Only published reports can be executed. Use preview: true for drafts.',
        code: 'REPORT_NOT_PUBLISHED',
      });
    }

    const context = buildExecutionContext(req, body);

    if (shouldRunAsync(report, body)) {
      const execution = await createExecutionRecord({
        organizationId: req.user.organizationId,
        reportId: report._id,
        reportVersion: report.version,
        triggeredBy: req.user._id,
        preview,
        runtimeFilters: body.runtimeFilters,
        rowLimit: body.rowLimit,
      });

      const enqueueResult = await enqueueAnalyticsExecution({
        executionId: String(execution._id),
        organizationId: String(req.user.organizationId),
        reportId: String(report._id),
        userId: String(req.user._id),
        runtimeFilters: body.runtimeFilters || null,
        rowLimit: body.rowLimit || null,
        preview,
      });

      if (enqueueResult.mode === 'queued') {
        return res.status(202).json({
          success: true,
          data: {
            executionId: execution._id,
            status: 'running',
            pollUrl: `/api/analytics/executions/${execution._id}`,
          },
        });
      }

      const { result } = await runAnalyticsReportWithLogging(report, {
        ...context,
        executionId: execution._id,
      });

      return res.json({
        success: true,
        data: result,
        meta: { executionId: execution._id, mode: 'inline-fallback' },
      });
    }

    const started = Date.now();
    const { executionId, result } = await runAnalyticsReportWithLogging(report, context);

    if (result.meta.executionMs >= ANALYTICS_ASYNC_RUNTIME_MS) {
      result.meta.suggestAsync = true;
    }

    return res.json({
      success: true,
      data: result,
      meta: { executionId, durationMs: Date.now() - started },
    });
  } catch (error) {
    const status = error.statusCode || (error.code === 'FORBIDDEN' ? 403 : 400);
    return res.status(status).json({
      success: false,
      message: error.message || 'Error executing report',
      code: error.code,
    });
  }
}

async function previewReport(req, res) {
  try {
    const body = req.body || {};
    if (!body.primaryModule) {
      return res.status(400).json({ success: false, message: 'primaryModule is required' });
    }

    const draftReport = {
      ...body,
      type: body.type || 'tabular',
      organizationId: req.user.organizationId,
      version: 1,
    };

    const result = await executeAnalyticsReport(draftReport, {
      ...buildExecutionContext(req, { ...body, preview: true }),
      preview: true,
      rowLimit: Math.min(Number(body.rowLimit) || 100, 500),
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    const status = error.statusCode || (error.code === 'FORBIDDEN' ? 403 : 400);
    return res.status(status).json({
      success: false,
      message: error.message || 'Error previewing report',
      code: error.code,
    });
  }
}

async function exportReport(req, res) {
  try {
    const report = await AnalyticsReport.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    }).lean();

    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    const format = String(req.body?.format || report.defaultExport || 'csv').toLowerCase();
    if (!['csv', 'xlsx', 'pdf'].includes(format)) {
      return res.status(400).json({
        success: false,
        message: 'Supported export formats: csv, xlsx, pdf',
        code: 'UNSUPPORTED_FORMAT',
      });
    }

    const { result } = await runAnalyticsReportWithLogging(report, buildExecutionContext(req, req.body));

    const payload = await renderExportPayload(result, format, { title: report.name });
    const filename = `${report.apiName || 'report'}_${Date.now()}.${fileExtensionForFormat(format)}`;

    res.setHeader('Content-Type', contentTypeForFormat(format));
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    if (Buffer.isBuffer(payload)) {
      return res.send(payload);
    }
    return res.send(payload);
  } catch (error) {
    const status = error.statusCode || (error.code === 'FORBIDDEN' ? 403 : 400);
    return res.status(status).json({
      success: false,
      message: error.message || 'Error exporting report',
      code: error.code,
    });
  }
}

async function listReportExecutions(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const filters = {
      reportId: req.query.reportId,
      status: req.query.status,
      page: req.query.page,
      limit: req.query.limit,
    };

    if (req.query.mine === 'true') {
      filters.triggeredBy = req.user._id;
    }

    const result = await listExecutions(organizationId, filters);
    return res.json({ success: true, ...result });
  } catch (error) {
    return handleError(res, error, 'Error listing executions');
  }
}

async function getExecution(req, res) {
  try {
    const execution = await getExecutionById(req.params.id, req.user.organizationId);
    if (!execution) {
      return res.status(404).json({ success: false, message: 'Execution not found' });
    }
    return res.json({ success: true, data: execution });
  } catch (error) {
    return handleError(res, error, 'Error fetching execution');
  }
}

async function duplicateReport(req, res) {
  try {
    const source = await AnalyticsReport.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    }).lean();

    if (!source) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    const {
      _id,
      __v,
      createdAt,
      updatedAt,
      publishedAt,
      archivedAt,
      widgetCount,
      dashboardCount,
      apiUsage,
      executionCount,
      lastExecutedAt,
      lastRuntime,
      averageRuntime,
      lastExecutionStatus,
      lastError,
      lastRecordCount,
      lastRunAt,
      nextRunAt,
      certified,
      certifiedBy,
      certifiedAt,
      viewCount,
      lastViewedAt,
      ...rest
    } = source;

    const copyName = `${source.name} (Copy)`;
    let apiName = slugifyApiName(`${source.apiName}_copy`);
    let suffix = 1;
    while (suffix < 50) {
      try {
        await ensureUniqueApiName(req.user.organizationId, apiName);
        break;
      } catch (err) {
        if (err.code !== 'DUPLICATE_API_NAME') throw err;
        suffix += 1;
        apiName = slugifyApiName(`${source.apiName}_copy_${suffix}`);
      }
    }

    const report = await AnalyticsReport.create({
      ...rest,
      name: copyName,
      apiName,
      status: 'draft',
      version: 1,
      publishedAt: null,
      archivedAt: null,
      ownerId: req.user._id,
      createdBy: req.user._id,
      updatedBy: null,
      widgetCount: 0,
      dashboardCount: 0,
      apiUsage: 0,
      executionCount: 0,
      lastExecutedAt: null,
      lastRuntime: null,
      averageRuntime: null,
      lastExecutionStatus: null,
      lastError: null,
      lastRecordCount: null,
      lastRunAt: null,
      nextRunAt: null,
    });

    const populated = await AnalyticsReport.findById(report._id)
      .populate('createdBy', 'firstName lastName email')
      .populate('ownerId', 'firstName lastName email');

    return res.status(201).json({ success: true, data: populated });
  } catch (error) {
    return handleError(res, error, 'Error duplicating analytics report');
  }
}

async function getAnalyticsCatalog(req, res) {
  try {
    const data = await getAnalyticsCatalogPayload(req.user.organizationId, req.user);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, 'Error fetching analytics catalog');
  }
}

async function certifyReport(req, res) {
  try {
    if (!canCertifyAnalyticsAssets(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Analytics admin permission required to certify reports',
        code: 'CERTIFY_FORBIDDEN',
      });
    }

    const report = await AnalyticsReport.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    });

    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    if (report.status !== 'published') {
      return res.status(400).json({
        success: false,
        message: 'Only published reports can be certified',
      });
    }

    report.certified = true;
    report.certifiedBy = req.user._id;
    report.certifiedAt = new Date();
    report.updatedBy = req.user._id;
    await report.save();

    const populated = await AnalyticsReport.findById(report._id)
      .populate('ownerId', 'firstName lastName email')
      .populate('certifiedBy', 'firstName lastName email');

    return res.json({ success: true, data: populated });
  } catch (error) {
    return handleError(res, error, 'Error certifying analytics report');
  }
}

async function uncertifyReport(req, res) {
  try {
    if (!canCertifyAnalyticsAssets(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Analytics admin permission required to uncertify reports',
        code: 'CERTIFY_FORBIDDEN',
      });
    }

    const report = await AnalyticsReport.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    });

    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    report.certified = false;
    report.certifiedBy = null;
    report.certifiedAt = null;
    report.updatedBy = req.user._id;
    await report.save();

    const populated = await AnalyticsReport.findById(report._id)
      .populate('ownerId', 'firstName lastName email')
      .populate('certifiedBy', 'firstName lastName email');

    return res.json({ success: true, data: populated });
  } catch (error) {
    return handleError(res, error, 'Error uncertifying analytics report');
  }
}

module.exports = {
  listReports,
  createReport,
  getReportById,
  updateReport,
  deleteReport,
  duplicateReport,
  publishReport,
  executeReport,
  previewReport,
  exportReport,
  listReportExecutions,
  getExecution,
  getAnalyticsCatalog,
  certifyReport,
  uncertifyReport,
};
