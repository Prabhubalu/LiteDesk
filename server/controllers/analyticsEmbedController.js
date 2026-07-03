const AnalyticsDashboard = require('../models/AnalyticsDashboard');
const AnalyticsWidget = require('../models/AnalyticsWidget');
const AnalyticsReport = require('../models/AnalyticsReport');
const { runAnalyticsReportWithLogging } = require('../services/analytics/analyticsExecutionService');
const { buildOrgPermissionContext } = require('../services/runtimePermissionResolver');
const {
  listEmbedTokensForDashboard,
  createEmbedToken,
  revokeEmbedToken,
} = require('../services/analytics/analyticsEmbedTokenService');
const { evaluateAlertsForWidgetExecution } = require('../services/analytics/analyticsAlertEvaluator');

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
    preview: false,
  };
}

async function resolveBoundReport(widget, organizationId) {
  let report = await AnalyticsReport.findOne({
    _id: widget.reportId,
    organizationId,
    status: 'published',
  }).lean();
  return report;
}

function normalizeLayout(layout) {
  if (!Array.isArray(layout)) return [];
  return layout.filter((item) => item && item.widgetId && item.instanceId);
}

function buildDateRangeRuntimeFilters(dateRange) {
  if (!dateRange || typeof dateRange !== 'object') return null;
  const field = String(dateRange.field || 'createdAt');
  const children = [];
  if (dateRange.from) children.push({ field, operator: 'gte', value: dateRange.from });
  if (dateRange.to) children.push({ field, operator: 'lte', value: dateRange.to });
  if (!children.length) return null;
  return { logic: 'AND', children };
}

async function executeEmbedDashboard(req, res) {
  try {
    const token = req.analyticsEmbedToken;
    const dashboard = await AnalyticsDashboard.findOne({
      _id: token.dashboardId,
      organizationId: req.user.organizationId,
      status: 'published',
    }).lean();

    if (!dashboard) {
      return res.status(404).json({ success: false, message: 'Dashboard not found or not published' });
    }

    const body = req.body || {};
    const layout = normalizeLayout(dashboard.layout);
    const dashboardFilters = buildDateRangeRuntimeFilters(body.variables?.dateRange);
    const context = buildExecutionContext(req, body);

    const widgetsById = new Map(
      (
        await AnalyticsWidget.find({
          _id: { $in: layout.map((i) => i.widgetId) },
          organizationId: req.user.organizationId,
          status: 'published',
        }).lean()
      ).map((w) => [String(w._id), w])
    );

    const widgets = [];
    for (const item of layout) {
      const widget = widgetsById.get(String(item.widgetId));
      if (!widget) continue;
      const report = await resolveBoundReport(widget, req.user.organizationId);
      if (!report) continue;

      const { result } = await runAnalyticsReportWithLogging(report, {
        ...context,
        runtimeFilters: dashboardFilters,
      });

      evaluateAlertsForWidgetExecution({
        organizationId: req.user.organizationId,
        widget,
        result,
      }).catch(() => {});

      widgets.push({
        instanceId: item.instanceId,
        widgetId: widget._id,
        chartType: widget.chartType,
        columnMapping: widget.columnMapping,
        thresholds: widget.thresholds,
        kpiValueField: widget.kpiValueField,
        kpiLabel: widget.kpiLabel,
        name: widget.name,
        result,
      });
    }

    return res.json({
      success: true,
      data: {
        dashboard: {
          _id: dashboard._id,
          name: dashboard.name,
          layout,
          variables: dashboard.variables,
          allowViewerDateChange: dashboard.allowViewerDateChange,
        },
        widgets,
      },
    });
  } catch (error) {
    return handleError(res, error, 'Error executing embed dashboard');
  }
}

async function getEmbedDashboardMeta(req, res) {
  try {
    const token = req.analyticsEmbedToken;
    const dashboard = await AnalyticsDashboard.findOne({
      _id: token.dashboardId,
      organizationId: req.user.organizationId,
      status: 'published',
    })
      .select('name layout variables allowViewerDateChange category appKey')
      .lean();

    if (!dashboard) {
      return res.status(404).json({ success: false, message: 'Dashboard not found' });
    }

    return res.json({ success: true, data: dashboard });
  } catch (error) {
    return handleError(res, error, 'Error fetching embed dashboard');
  }
}

async function listDashboardEmbedTokens(req, res) {
  try {
    const data = await listEmbedTokensForDashboard(req.params.id, req.user.organizationId);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, 'Error listing embed tokens');
  }
}

async function createDashboardEmbedToken(req, res) {
  try {
    const result = await createEmbedToken(
      req.user.organizationId,
      req.user,
      req.params.id,
      req.body || {}
    );
    return res.status(201).json({
      success: true,
      data: result.data,
      token: result.token,
      embedPath: result.embedPath,
      message: 'Copy the embed token now — it will not be shown again.',
    });
  } catch (error) {
    return handleError(res, error, 'Error creating embed token');
  }
}

async function revokeDashboardEmbedToken(req, res) {
  try {
    const data = await revokeEmbedToken(req.params.tokenId, req.user.organizationId, req.user);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, 'Error revoking embed token');
  }
}

module.exports = {
  executeEmbedDashboard,
  getEmbedDashboardMeta,
  listDashboardEmbedTokens,
  createDashboardEmbedToken,
  revokeDashboardEmbedToken,
};
