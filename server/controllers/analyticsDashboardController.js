const AnalyticsDashboard = require('../models/AnalyticsDashboard');
const AnalyticsWidget = require('../models/AnalyticsWidget');
const AnalyticsReport = require('../models/AnalyticsReport');
const { runAnalyticsReportWithLogging, resolveWidgetBoundReport } = require('../services/analytics/analyticsExecutionService');
const { ANALYTICS_DASHBOARD_TEMPLATES } = require('../constants/analyticsDashboardTemplates');
const { buildOrgPermissionContext } = require('../services/runtimePermissionResolver');
const { evaluateAlertsForWidgetExecution } = require('../services/analytics/analyticsAlertEvaluator');
const { ensureDefaultAppDashboard } = require('../services/analytics/analyticsAppDashboardSeedService');
const { canCertifyAnalyticsAssets } = require('../services/analytics/analyticsCertificationService');
const { recordDashboardView } = require('../services/analytics/analyticsUsageService');

function slugifyApiName(name) {
  return String(name || 'dashboard')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80);
}

async function ensureUniqueDashboardApiName(organizationId, apiName, excludeId = null) {
  const query = { organizationId, apiName, status: { $ne: 'archived' } };
  if (excludeId) query._id = { $ne: excludeId };
  const existing = await AnalyticsDashboard.findOne(query).select('_id').lean();
  if (existing) {
    const err = new Error('apiName already exists for this organization');
    err.code = 'DUPLICATE_API_NAME';
    err.statusCode = 409;
    throw err;
  }
}

function handleError(res, error, fallbackMessage) {
  const status = error.statusCode || (error.code === 'DUPLICATE_API_NAME' ? 409 : 400);
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

async function resolveBoundReport(widget, organizationId) {
  return resolveWidgetBoundReport(widget, organizationId);
}

function mergeRuntimeFilters(...filters) {
  const children = filters.filter(Boolean);
  if (!children.length) return null;
  if (children.length === 1) return children[0];
  return { logic: 'AND', children };
}

function buildDateRangeRuntimeFilters(dateRange) {
  if (!dateRange || typeof dateRange !== 'object') return null;
  const field = String(dateRange.field || 'createdAt');
  const children = [];
  if (dateRange.from) {
    children.push({ field, operator: 'gte', value: dateRange.from });
  }
  if (dateRange.to) {
    children.push({ field, operator: 'lte', value: dateRange.to });
  }
  if (!children.length) return null;
  return { logic: 'AND', children };
}

function buildDashboardRuntimeFilters(dashboard, variables = {}, drillFilters = null) {
  const dateRange = variables.dateRange;
  return mergeRuntimeFilters(
    buildDateRangeRuntimeFilters(dateRange),
    drillFilters || null
  );
}

function normalizeLayout(layout) {
  if (!Array.isArray(layout)) return [];
  return layout
    .filter((item) => item && item.widgetId && item.instanceId)
    .map((item) => ({
      widgetId: String(item.widgetId),
      instanceId: String(item.instanceId),
      x: Number(item.x) || 0,
      y: Number(item.y) || 0,
      w: Math.max(Number(item.w) || 4, 1),
      h: Math.max(Number(item.h) || 3, 1),
      minW: item.minW != null ? Number(item.minW) : undefined,
      minH: item.minH != null ? Number(item.minH) : undefined,
      locked: Boolean(item.locked),
    }));
}

function widgetIdsFromLayout(layout) {
  return [...new Set(normalizeLayout(layout).map((item) => item.widgetId))];
}

async function syncWidgetDashboardCounts(organizationId, oldLayout, newLayout) {
  const oldIds = new Set(widgetIdsFromLayout(oldLayout));
  const newIds = new Set(widgetIdsFromLayout(newLayout));

  for (const id of newIds) {
    if (!oldIds.has(id)) {
      await AnalyticsWidget.updateOne({ _id: id, organizationId }, { $inc: { dashboardCount: 1 } });
    }
  }
  for (const id of oldIds) {
    if (!newIds.has(id)) {
      await AnalyticsWidget.updateOne({ _id: id, organizationId }, { $inc: { dashboardCount: -1 } });
    }
  }
}

const DEFAULT_VARIABLES = Object.freeze([
  {
    key: 'dateRange',
    type: 'dateRange',
    label: 'Date range',
    default: { preset: 'last30days' },
  },
]);

async function listDashboards(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const query = { organizationId };

    if (req.query.status) query.status = req.query.status;
    if (req.query.category) query.category = req.query.category;
    if (req.query.appKey) query.appKey = req.query.appKey;
    if (req.query.mine === 'true') query.ownerId = req.user._id;

    if (req.query.search) {
      const regex = new RegExp(String(req.query.search), 'i');
      query.$or = [{ name: regex }, { apiName: regex }, { tags: regex }];
    }

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      AnalyticsDashboard.find(query)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('ownerId', 'firstName lastName email')
        .lean(),
      AnalyticsDashboard.countDocuments(query),
    ]);

    return res.json({
      success: true,
      data,
      meta: { page, perPage: limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return handleError(res, error, 'Error fetching analytics dashboards');
  }
}

async function createDashboard(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const name = String(req.body?.name || '').trim();
    if (!name) {
      return res.status(400).json({ success: false, message: 'name is required' });
    }

    const apiName = String(req.body?.apiName || slugifyApiName(name)).trim();
    await ensureUniqueDashboardApiName(organizationId, apiName);

    const layout = normalizeLayout(req.body?.layout || []);
    const dashboard = await AnalyticsDashboard.create({
      name,
      apiName,
      description: req.body?.description || null,
      category: req.body?.category || 'personal',
      appKey: req.body?.appKey || null,
      templateKey: req.body?.templateKey || null,
      layout,
      variables: req.body?.variables ?? DEFAULT_VARIABLES,
      visibility: req.body?.visibility || 'private',
      organizationId,
      ownerId: req.user._id,
      createdBy: req.user._id,
      status: 'draft',
      version: 1,
      widgetCount: layout.length,
    });

    if (layout.length) {
      await syncWidgetDashboardCounts(organizationId, [], layout);
    }

    const populated = await AnalyticsDashboard.findById(dashboard._id)
      .populate('ownerId', 'firstName lastName email');

    return res.status(201).json({ success: true, data: populated });
  } catch (error) {
    return handleError(res, error, 'Error creating analytics dashboard');
  }
}

async function getDashboardById(req, res) {
  try {
    const dashboard = await AnalyticsDashboard.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    })
      .populate('ownerId', 'firstName lastName email')
      .lean();

    if (!dashboard) {
      return res.status(404).json({ success: false, message: 'Dashboard not found' });
    }

    return res.json({ success: true, data: dashboard });
  } catch (error) {
    return handleError(res, error, 'Error fetching analytics dashboard');
  }
}

async function updateDashboard(req, res) {
  try {
    const dashboard = await AnalyticsDashboard.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    });

    if (!dashboard) {
      return res.status(404).json({ success: false, message: 'Dashboard not found' });
    }

    if (dashboard.status === 'archived') {
      return res.status(400).json({ success: false, message: 'Archived dashboards cannot be edited' });
    }

    const previousLayout = dashboard.layout;
    const blocked = [
      '_id',
      'organizationId',
      'createdBy',
      'createdAt',
      'widgetCount',
      'viewCount',
      'lastViewedAt',
    ];

    for (const [key, value] of Object.entries(req.body || {})) {
      if (blocked.includes(key)) continue;
      if (key === 'layout') {
        dashboard.layout = normalizeLayout(value);
        continue;
      }
      dashboard[key] = value;
    }

    if (req.body?.apiName && req.body.apiName !== dashboard.apiName) {
      await ensureUniqueDashboardApiName(req.user.organizationId, req.body.apiName, dashboard._id);
      dashboard.apiName = req.body.apiName;
    }

    if (req.body?.layout) {
      await syncWidgetDashboardCounts(req.user.organizationId, previousLayout, dashboard.layout);
      dashboard.widgetCount = dashboard.layout.length;
    }

    dashboard.updatedBy = req.user._id;
    await dashboard.save();

    const updated = await AnalyticsDashboard.findById(dashboard._id)
      .populate('ownerId', 'firstName lastName email');

    return res.json({ success: true, data: updated });
  } catch (error) {
    return handleError(res, error, 'Error updating analytics dashboard');
  }
}

async function deleteDashboard(req, res) {
  try {
    const dashboard = await AnalyticsDashboard.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    });

    if (!dashboard) {
      return res.status(404).json({ success: false, message: 'Dashboard not found' });
    }

    await syncWidgetDashboardCounts(req.user.organizationId, dashboard.layout, []);
    dashboard.status = 'archived';
    dashboard.archivedAt = new Date();
    dashboard.updatedBy = req.user._id;
    dashboard.layout = [];
    dashboard.widgetCount = 0;
    await dashboard.save();

    return res.json({ success: true, message: 'Dashboard archived' });
  } catch (error) {
    return handleError(res, error, 'Error archiving analytics dashboard');
  }
}

async function publishDashboard(req, res) {
  try {
    const dashboard = await AnalyticsDashboard.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    });

    if (!dashboard) {
      return res.status(404).json({ success: false, message: 'Dashboard not found' });
    }

    const layout = normalizeLayout(dashboard.layout);
    if (!layout.length) {
      return res.status(400).json({
        success: false,
        message: 'Dashboard must contain at least one widget before publishing',
        code: 'EMPTY_LAYOUT',
      });
    }

    const widgetIds = widgetIdsFromLayout(layout);
    const widgets = await AnalyticsWidget.find({
      _id: { $in: widgetIds },
      organizationId: req.user.organizationId,
    })
      .select('_id status name')
      .lean();

    if (widgets.length !== widgetIds.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more layout widgets were not found',
        code: 'WIDGET_NOT_FOUND',
      });
    }

    const unpublished = widgets.filter((w) => w.status !== 'published');
    if (unpublished.length) {
      return res.status(400).json({
        success: false,
        message: 'All widgets must be published before publishing the dashboard',
        code: 'WIDGET_NOT_PUBLISHED',
        data: { widgets: unpublished.map((w) => ({ _id: w._id, name: w.name })) },
      });
    }

    dashboard.status = 'published';
    dashboard.version = dashboard.publishedAt ? (dashboard.version || 1) + 1 : 1;
    dashboard.publishedAt = new Date();
    dashboard.updatedBy = req.user._id;
    await dashboard.save();

    return res.json({ success: true, data: dashboard });
  } catch (error) {
    return handleError(res, error, 'Error publishing analytics dashboard');
  }
}

async function executeWidgetForDashboard(widget, report, context, dashboardFilters) {
  const mergedFilters = mergeRuntimeFilters(
    dashboardFilters,
    widget.filterOverrides || null,
    context.runtimeFilters || null
  );

  const { result } = await runAnalyticsReportWithLogging(report, {
    ...context,
    runtimeFilters: mergedFilters,
  });

  return {
    widgetId: widget._id,
    chartType: widget.chartType,
    columnMapping: widget.columnMapping,
    thresholds: widget.thresholds,
    kpiValueField: widget.kpiValueField,
    kpiLabel: widget.kpiLabel,
    kpiPrefix: widget.kpiPrefix,
    kpiSuffix: widget.kpiSuffix,
    name: widget.name,
    showLegend: widget.showLegend,
    orientation: widget.orientation,
    stacked: widget.stacked,
    smooth: widget.smooth,
    showDataLabels: widget.showDataLabels,
    result,
  };
}

async function executeDashboard(req, res) {
  try {
    const dashboard = await AnalyticsDashboard.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    }).lean();

    if (!dashboard) {
      return res.status(404).json({ success: false, message: 'Dashboard not found' });
    }

    const body = req.body || {};
    const preview = body.preview === true;
    if (dashboard.status !== 'published' && !preview) {
      return res.status(400).json({
        success: false,
        message: 'Only published dashboards can be executed. Use preview: true for drafts.',
        code: 'DASHBOARD_NOT_PUBLISHED',
      });
    }

    const layout = normalizeLayout(dashboard.layout);
    const dashboardFilters = buildDashboardRuntimeFilters(
      dashboard,
      body.variables || {},
      body.drillFilters || null
    );
    const context = buildExecutionContext(req, body);
    const startedAt = Date.now();

    const widgetIds = widgetIdsFromLayout(layout);
    const widgetsById = new Map(
      (
        await AnalyticsWidget.find({
          _id: { $in: widgetIds },
          organizationId: req.user.organizationId,
        }).lean()
      ).map((w) => [String(w._id), w])
    );

    const executeOne = async (item) => {
      const widget = widgetsById.get(String(item.widgetId));
      if (!widget) return null;
      if (widget.status !== 'published' && !preview) return null;

      const report = await resolveBoundReport(widget, req.user.organizationId);
      if (!report) return null;
      if (report.status !== 'published' && !preview) return null;

      const payload = await executeWidgetForDashboard(widget, report, context, dashboardFilters);
      if (payload?.result) {
        evaluateAlertsForWidgetExecution({
          organizationId: req.user.organizationId,
          widget,
          result: payload.result,
        }).catch((err) => console.error('[analyticsAlertEvaluator]', err));
      }
      return { instanceId: item.instanceId, ...payload };
    };

    let widgets;
    if (dashboard.loadStrategy === 'sequential') {
      widgets = [];
      for (const item of layout) {
        const payload = await executeOne(item);
        if (payload) widgets.push(payload);
      }
    } else {
      const results = await Promise.all(layout.map((item) => executeOne(item)));
      widgets = results.filter(Boolean);
    }

    if (!preview && dashboard.status === 'published') {
      recordDashboardView(dashboard._id, req.user.organizationId, req.user._id).catch(() => {});
    }

    return res.json({
      success: true,
      data: {
        dashboardId: dashboard._id,
        widgets,
        meta: { executionMs: Date.now() - startedAt },
      },
    });
  } catch (error) {
    const status = error.statusCode || (error.code === 'FORBIDDEN' ? 403 : 400);
    return res.status(status).json({
      success: false,
      message: error.message || 'Error executing dashboard',
      code: error.code,
    });
  }
}

async function duplicateDashboard(req, res) {
  try {
    const source = await AnalyticsDashboard.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    }).lean();

    if (!source) {
      return res.status(404).json({ success: false, message: 'Dashboard not found' });
    }

    const {
      _id,
      __v,
      createdAt,
      updatedAt,
      publishedAt,
      archivedAt,
      viewCount,
      lastViewedAt,
      certified,
      certifiedBy,
      certifiedAt,
      ...rest
    } = source;

    const copyName = `${source.name} (Copy)`;
    let apiName = slugifyApiName(`${source.apiName}_copy`);
    let suffix = 1;
    while (suffix < 50) {
      try {
        await ensureUniqueDashboardApiName(req.user.organizationId, apiName);
        break;
      } catch (err) {
        if (err.code !== 'DUPLICATE_API_NAME') throw err;
        suffix += 1;
        apiName = slugifyApiName(`${source.apiName}_copy_${suffix}`);
      }
    }

    const layout = normalizeLayout(source.layout).map((item) => ({
      ...item,
      instanceId: `${item.instanceId}_copy_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    }));

    const dashboard = await AnalyticsDashboard.create({
      ...rest,
      name: copyName,
      apiName,
      layout,
      status: 'draft',
      version: 1,
      publishedAt: null,
      archivedAt: null,
      ownerId: req.user._id,
      createdBy: req.user._id,
      updatedBy: null,
      viewCount: 0,
      lastViewedAt: null,
      widgetCount: layout.length,
      certified: false,
      certifiedBy: null,
      certifiedAt: null,
      isDefault: false,
    });

    if (layout.length) {
      await syncWidgetDashboardCounts(req.user.organizationId, [], layout);
    }

    const populated = await AnalyticsDashboard.findById(dashboard._id)
      .populate('ownerId', 'firstName lastName email');

    return res.status(201).json({ success: true, data: populated });
  } catch (error) {
    return handleError(res, error, 'Error duplicating analytics dashboard');
  }
}

async function getDefaultDashboard(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const appKey = String(req.query.appKey || '').trim().toUpperCase();
    if (!appKey) {
      return res.status(400).json({ success: false, message: 'appKey is required' });
    }

    const baseQuery = {
      organizationId,
      status: 'published',
      category: 'app',
      appKey,
    };

    let dashboard = await AnalyticsDashboard.findOne({ ...baseQuery, isDefault: true })
      .sort({ updatedAt: -1 })
      .lean();

    if (!dashboard) {
      dashboard = await AnalyticsDashboard.findOne(baseQuery).sort({ updatedAt: -1 }).lean();
    }

    if (!dashboard) {
      dashboard = await ensureDefaultAppDashboard(organizationId, req.user._id, appKey);
    }

    if (!dashboard) {
      return res.status(404).json({ success: false, message: 'No published app dashboard found' });
    }

    return res.json({ success: true, data: dashboard });
  } catch (error) {
    return handleError(res, error, 'Error fetching default analytics dashboard');
  }
}

async function getDashboardTemplates(req, res) {
  try {
    return res.json({ success: true, data: ANALYTICS_DASHBOARD_TEMPLATES });
  } catch (error) {
    return handleError(res, error, 'Error fetching dashboard templates');
  }
}

async function certifyDashboard(req, res) {
  try {
    if (!canCertifyAnalyticsAssets(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Analytics admin permission required to certify dashboards',
        code: 'CERTIFY_FORBIDDEN',
      });
    }

    const dashboard = await AnalyticsDashboard.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    });

    if (!dashboard) {
      return res.status(404).json({ success: false, message: 'Dashboard not found' });
    }

    if (dashboard.status !== 'published') {
      return res.status(400).json({ success: false, message: 'Only published dashboards can be certified' });
    }

    dashboard.certified = true;
    dashboard.certifiedBy = req.user._id;
    dashboard.certifiedAt = new Date();
    dashboard.updatedBy = req.user._id;
    await dashboard.save();

    return res.json({ success: true, data: dashboard });
  } catch (error) {
    return handleError(res, error, 'Error certifying analytics dashboard');
  }
}

async function uncertifyDashboard(req, res) {
  try {
    if (!canCertifyAnalyticsAssets(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Analytics admin permission required to uncertify dashboards',
        code: 'CERTIFY_FORBIDDEN',
      });
    }

    const dashboard = await AnalyticsDashboard.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    });

    if (!dashboard) {
      return res.status(404).json({ success: false, message: 'Dashboard not found' });
    }

    dashboard.certified = false;
    dashboard.certifiedBy = null;
    dashboard.certifiedAt = null;
    dashboard.updatedBy = req.user._id;
    await dashboard.save();

    return res.json({ success: true, data: dashboard });
  } catch (error) {
    return handleError(res, error, 'Error uncertifying analytics dashboard');
  }
}

module.exports = {
  listDashboards,
  createDashboard,
  getDashboardById,
  updateDashboard,
  deleteDashboard,
  publishDashboard,
  executeDashboard,
  duplicateDashboard,
  getDefaultDashboard,
  getDashboardTemplates,
  certifyDashboard,
  uncertifyDashboard,
};
