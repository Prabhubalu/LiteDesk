const AnalyticsReport = require('../models/AnalyticsReport');
const AnalyticsWidget = require('../models/AnalyticsWidget');
const AnalyticsDashboard = require('../models/AnalyticsDashboard');
const { runAnalyticsReportWithLogging } = require('../services/analytics/analyticsExecutionService');
const {
  renderExportPayload,
  contentTypeForFormat,
  fileExtensionForFormat,
} = require('../services/analytics/analyticsExportService');
const { buildOrgPermissionContext } = require('../services/runtimePermissionResolver');
const {
  tokenAllowsReport,
  tokenHasScope,
} = require('../services/analytics/analyticsApiTokenService');

function handleError(res, error, fallbackMessage) {
  console.error(fallbackMessage, error);
  const status = error.statusCode || 500;
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
    runtimeFilters: body.runtimeFilters || null,
    rowLimit: body.rowLimit || null,
    preview: false,
  };
}

async function assertReportAccess(req, reportId) {
  const token = req.analyticsApiToken;
  if (!tokenAllowsReport(token, reportId)) {
    const err = new Error('API token is not allowed to access this report');
    err.statusCode = 403;
    err.code = 'ANALYTICS_API_TOKEN_REPORT_DENIED';
    throw err;
  }

  const report = await AnalyticsReport.findOne({
    _id: reportId,
    organizationId: req.user.organizationId,
    status: 'published',
  }).lean();

  if (!report) {
    const err = new Error('Published report not found');
    err.statusCode = 404;
    throw err;
  }
  return report;
}

async function touchApiUsage(reportId, organizationId) {
  await AnalyticsReport.updateOne(
    { _id: reportId, organizationId },
    { $inc: { apiUsage: 1 } }
  );
}

async function v1ListReports(req, res) {
  try {
    if (!tokenHasScope(req.analyticsApiToken, 'reports:read')) {
      return res.status(403).json({
        success: false,
        message: 'API token missing scope: reports:read',
        code: 'ANALYTICS_API_TOKEN_SCOPE_DENIED',
      });
    }

    const query = {
      organizationId: req.user.organizationId,
      status: 'published',
    };

    const allowed = req.analyticsApiToken.allowedReportIds || [];
    if (allowed.length) {
      query._id = { $in: allowed };
    }

    const reports = await AnalyticsReport.find(query)
      .sort({ updatedAt: -1 })
      .select('name apiName type primaryModule status version certified updatedAt')
      .lean();

    return res.json({ success: true, data: reports });
  } catch (error) {
    return handleError(res, error, 'Error listing analytics reports (v1)');
  }
}

async function v1GetReport(req, res) {
  try {
    if (!tokenHasScope(req.analyticsApiToken, 'reports:read')) {
      return res.status(403).json({
        success: false,
        message: 'API token missing scope: reports:read',
        code: 'ANALYTICS_API_TOKEN_SCOPE_DENIED',
      });
    }

    const report = await assertReportAccess(req, req.params.id);
    return res.json({
      success: true,
      data: {
        _id: report._id,
        name: report.name,
        apiName: report.apiName,
        type: report.type,
        primaryModule: report.primaryModule,
        status: report.status,
        version: report.version,
        certified: report.certified,
        updatedAt: report.updatedAt,
      },
    });
  } catch (error) {
    return handleError(res, error, 'Error fetching analytics report (v1)');
  }
}

async function v1ExecuteReport(req, res) {
  try {
    if (!tokenHasScope(req.analyticsApiToken, 'reports:execute')) {
      return res.status(403).json({
        success: false,
        message: 'API token missing scope: reports:execute',
        code: 'ANALYTICS_API_TOKEN_SCOPE_DENIED',
      });
    }

    const report = await assertReportAccess(req, req.params.id);
    const context = buildExecutionContext(req, req.body || {});
    const { executionId, result } = await runAnalyticsReportWithLogging(report, context);
    await touchApiUsage(report._id, req.user.organizationId);

    return res.json({
      success: true,
      data: result,
      meta: { executionId, apiVersion: 'v1' },
    });
  } catch (error) {
    return handleError(res, error, 'Error executing analytics report (v1)');
  }
}

async function v1ExportReport(req, res) {
  try {
    if (!tokenHasScope(req.analyticsApiToken, 'reports:export')) {
      return res.status(403).json({
        success: false,
        message: 'API token missing scope: reports:export',
        code: 'ANALYTICS_API_TOKEN_SCOPE_DENIED',
      });
    }

    const report = await assertReportAccess(req, req.params.id);
    const context = buildExecutionContext(req, req.body || {});
    const { result } = await runAnalyticsReportWithLogging(report, context);
    await touchApiUsage(report._id, req.user.organizationId);

    const format = String(req.body?.format || req.query?.format || 'csv').toLowerCase();
    const payload = await renderExportPayload(result, format, { title: report.name });
    const safeName = String(report.apiName || report.name || 'report')
      .replace(/[^a-zA-Z0-9._-]+/g, '_')
      .slice(0, 80);

    res.setHeader('Content-Type', contentTypeForFormat(format));
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeName}.${fileExtensionForFormat(format)}"`
    );
    return res.send(payload);
  } catch (error) {
    return handleError(res, error, 'Error exporting analytics report (v1)');
  }
}

async function v1ListWidgets(req, res) {
  try {
    if (!tokenHasScope(req.analyticsApiToken, 'widgets:read')) {
      return res.status(403).json({
        success: false,
        message: 'API token missing scope: widgets:read',
        code: 'ANALYTICS_API_TOKEN_SCOPE_DENIED',
      });
    }

    const widgets = await AnalyticsWidget.find({
      organizationId: req.user.organizationId,
      status: 'published',
    })
      .sort({ updatedAt: -1 })
      .select('name apiName chartType status reportId certified updatedAt')
      .lean();

    return res.json({ success: true, data: widgets });
  } catch (error) {
    return handleError(res, error, 'Error listing analytics widgets (v1)');
  }
}

async function v1ExecuteWidget(req, res) {
  try {
    if (!tokenHasScope(req.analyticsApiToken, 'widgets:execute')) {
      return res.status(403).json({
        success: false,
        message: 'API token missing scope: widgets:execute',
        code: 'ANALYTICS_API_TOKEN_SCOPE_DENIED',
      });
    }

    const widget = await AnalyticsWidget.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
      status: 'published',
    }).lean();

    if (!widget) {
      return res.status(404).json({ success: false, message: 'Published widget not found' });
    }

    const report = await AnalyticsReport.findOne({
      _id: widget.reportId,
      organizationId: req.user.organizationId,
      status: 'published',
    }).lean();

    if (!report || !tokenAllowsReport(req.analyticsApiToken, report._id)) {
      return res.status(403).json({
        success: false,
        message: 'API token is not allowed to execute this widget report',
        code: 'ANALYTICS_API_TOKEN_REPORT_DENIED',
      });
    }

    const context = buildExecutionContext(req, req.body || {});
    const { executionId, result } = await runAnalyticsReportWithLogging(report, context);
    return res.json({
      success: true,
      data: { widgetId: widget._id, result },
      meta: { executionId, apiVersion: 'v1' },
    });
  } catch (error) {
    return handleError(res, error, 'Error executing analytics widget (v1)');
  }
}

async function v1ListDashboards(req, res) {
  try {
    if (!tokenHasScope(req.analyticsApiToken, 'dashboards:read')) {
      return res.status(403).json({
        success: false,
        message: 'API token missing scope: dashboards:read',
        code: 'ANALYTICS_API_TOKEN_SCOPE_DENIED',
      });
    }

    const dashboards = await AnalyticsDashboard.find({
      organizationId: req.user.organizationId,
      status: 'published',
    })
      .sort({ updatedAt: -1 })
      .select('name apiName status category appKey certified updatedAt widgetCount')
      .lean();

    return res.json({ success: true, data: dashboards });
  } catch (error) {
    return handleError(res, error, 'Error listing analytics dashboards (v1)');
  }
}

async function v1GetDashboard(req, res) {
  try {
    if (!tokenHasScope(req.analyticsApiToken, 'dashboards:read')) {
      return res.status(403).json({
        success: false,
        message: 'API token missing scope: dashboards:read',
        code: 'ANALYTICS_API_TOKEN_SCOPE_DENIED',
      });
    }

    const dashboard = await AnalyticsDashboard.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
      status: 'published',
    })
      .select('name apiName status category appKey layout variables certified updatedAt')
      .lean();

    if (!dashboard) {
      return res.status(404).json({ success: false, message: 'Published dashboard not found' });
    }

    return res.json({ success: true, data: dashboard });
  } catch (error) {
    return handleError(res, error, 'Error fetching analytics dashboard (v1)');
  }
}

module.exports = {
  v1ListReports,
  v1GetReport,
  v1ExecuteReport,
  v1ExportReport,
  v1ListWidgets,
  v1ExecuteWidget,
  v1ListDashboards,
  v1GetDashboard,
};
