'use strict';

/**
 * Pin an Astra visual (chart/table/progress) onto an Analytics dashboard.
 * Creates a live AnalyticsReport + AnalyticsWidget (not a static snapshot),
 * then appends the widget to the target dashboard layout.
 */

const crypto = require('crypto');
const AnalyticsReport = require('../../models/AnalyticsReport');
const AnalyticsWidget = require('../../models/AnalyticsWidget');
const AnalyticsDashboard = require('../../models/AnalyticsDashboard');

const PINNABLE = new Set(['chart', 'progress_list', 'data_table', 'kpi_strip']);

const DEFAULT_GROUP_BY = Object.freeze({
  deals: 'stage',
  tasks: 'status',
  cases: 'status',
  events: 'eventType',
  quotes: 'status',
  people: 'status',
  organizations: 'industry',
});

function slugify(name, fallback = 'astra_pin') {
  return String(name || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 72) || fallback;
}

async function ensureUniqueApiName(organizationId, base, Model) {
  let apiName = base;
  let suffix = 1;
  while (suffix < 40) {
    // eslint-disable-next-line no-await-in-loop
    const exists = await Model.findOne({
      organizationId,
      apiName,
      status: { $ne: 'archived' },
    }).select('_id').lean();
    if (!exists) return apiName;
    apiName = `${base}_${suffix}`;
    suffix += 1;
  }
  return `${base}_${Date.now().toString(36)}`;
}

function inferModuleAndGroup(visual = {}) {
  const pin = visual.pinSource && typeof visual.pinSource === 'object'
    ? visual.pinSource
    : null;
  if (pin?.moduleKey) {
    const moduleKey = String(pin.moduleKey).toLowerCase();
    return {
      moduleKey,
      groupField: String(pin.groupField || DEFAULT_GROUP_BY[moduleKey] || 'status'),
      metric: pin.metric === 'amount' ? 'amount' : 'count',
    };
  }

  const title = String(visual.title || '').toLowerCase();
  let moduleKey = '';
  if (/\btasks?\b/.test(title)) moduleKey = 'tasks';
  else if (/\bdeals?\b|pipeline/.test(title)) moduleKey = 'deals';
  else if (/\bcases?\b/.test(title)) moduleKey = 'cases';
  else if (/\bevents?\b|meetings?\b/.test(title)) moduleKey = 'events';
  else if (/\bquotes?\b/.test(title)) moduleKey = 'quotes';

  if (!moduleKey) return null;

  let groupField = DEFAULT_GROUP_BY[moduleKey] || 'status';
  if (/\bby stage\b|\bstage\b/.test(title)) groupField = 'stage';
  if (/\bby status\b|\bstatus\b/.test(title)) groupField = 'status';
  if (/\bby priority\b|\bpriority\b/.test(title)) groupField = 'priority';

  const metric = /\b(value|amount|revenue|pipeline)\b/.test(title) && moduleKey === 'deals'
    ? 'amount'
    : 'count';

  return { moduleKey, groupField, metric };
}

function resolveChartType(visual = {}) {
  const component = String(visual.component || '').toLowerCase();
  if (component === 'data_table') return 'table';
  if (component === 'kpi_strip') return 'kpi';
  const ct = String(visual.chartType || '').toLowerCase();
  if (['pie', 'bar', 'line', 'donut'].includes(ct)) return ct;
  if (component === 'progress_list') return 'bar';
  return 'pie';
}

function buildReportPreset({ moduleKey, groupField, metric, name }) {
  const isAmount = metric === 'amount' && moduleKey === 'deals';
  return {
    name,
    type: 'summary',
    primaryModule: moduleKey,
    rowGroups: groupField ? [{ field: groupField }] : null,
    aggregations: isAmount
      ? [{ field: 'amount', fn: 'sum', label: 'amount' }]
      : [{ field: '_id', fn: 'count', label: 'count' }],
    selectedFields: [],
  };
}

function buildColumnMapping({ groupField, metric, chartType }) {
  if (chartType === 'kpi') {
    return { metric: metric === 'amount' ? 'amount' : 'count' };
  }
  return {
    dimension: groupField || 'status',
    metric: metric === 'amount' ? 'amount' : 'count',
  };
}

async function resolveTargetDashboard({
  organizationId,
  userId,
  dashboardId = '',
  appKey = 'SALES',
}) {
  if (dashboardId) {
    const existing = await AnalyticsDashboard.findOne({
      _id: dashboardId,
      organizationId,
      status: { $ne: 'archived' },
    });
    if (!existing) {
      const err = new Error('Dashboard not found');
      err.statusCode = 404;
      err.code = 'DASHBOARD_NOT_FOUND';
      throw err;
    }
    return existing;
  }

  const personal = await AnalyticsDashboard.findOne({
    organizationId,
    ownerId: userId,
    category: 'personal',
    status: { $ne: 'archived' },
  }).sort({ isDefault: -1, updatedAt: -1 });

  if (personal) return personal;

  const apiName = await ensureUniqueApiName(
    organizationId,
    'astra_pinned_dashboard',
    AnalyticsDashboard
  );

  return AnalyticsDashboard.create({
    organizationId,
    name: 'Astra Pins',
    apiName,
    description: 'Charts and tables pinned from Astra',
    category: 'personal',
    appKey: String(appKey || 'SALES').toUpperCase() || null,
    layout: [],
    isDefault: false,
    status: 'published',
    version: 1,
    publishedAt: new Date(),
    visibility: 'private',
    allowViewerDateChange: true,
    ownerId: userId,
    createdBy: userId,
    widgetCount: 0,
  });
}

/**
 * @param {{
 *   organizationId: import('mongoose').Types.ObjectId|string,
 *   userId: import('mongoose').Types.ObjectId|string,
 *   visual: object,
 *   dashboardId?: string,
 *   appKey?: string,
 *   titleOverride?: string,
 * }} args
 */
async function pinAstraVisualToDashboard({
  organizationId,
  userId,
  visual,
  dashboardId = '',
  appKey = 'SALES',
  titleOverride = '',
}) {
  if (!visual || typeof visual !== 'object') {
    const err = new Error('visual is required');
    err.statusCode = 400;
    throw err;
  }
  const component = String(visual.component || '').toLowerCase();
  if (!PINNABLE.has(component)) {
    const err = new Error('Only chart, table, progress, and KPI visuals can be pinned');
    err.statusCode = 400;
    err.code = 'ASTRA_VISUAL_NOT_PINNABLE';
    throw err;
  }

  const inferred = inferModuleAndGroup(visual);
  if (!inferred?.moduleKey) {
    const err = new Error('Could not resolve CRM module for this visual — ask Astra for a module report first');
    err.statusCode = 400;
    err.code = 'ASTRA_PIN_MODULE_UNKNOWN';
    throw err;
  }

  const chartType = resolveChartType(visual);
  const name = String(titleOverride || visual.title || `${inferred.moduleKey} by ${inferred.groupField}`)
    .trim()
    .slice(0, 120) || 'Astra chart';

  const reportPreset = buildReportPreset({
    moduleKey: inferred.moduleKey,
    groupField: chartType === 'kpi' ? '' : inferred.groupField,
    metric: inferred.metric,
    name: `${name} (Astra)`,
  });

  const reportApiName = await ensureUniqueApiName(
    organizationId,
    slugify(reportPreset.name, 'astra_report'),
    AnalyticsReport
  );

  const report = await AnalyticsReport.create({
    organizationId,
    name: reportPreset.name,
    apiName: reportApiName,
    type: reportPreset.type,
    primaryModule: reportPreset.primaryModule,
    selectedFields: reportPreset.selectedFields,
    rowGroups: reportPreset.rowGroups,
    aggregations: reportPreset.aggregations,
    filterLogic: 'AND',
    status: 'published',
    version: 1,
    publishedAt: new Date(),
    visibility: 'private',
    ownerId: userId,
    createdBy: userId,
    tags: ['astra', 'pinned'],
  });

  const widgetApiName = await ensureUniqueApiName(
    organizationId,
    slugify(name, 'astra_widget'),
    AnalyticsWidget
  );

  const columnMapping = buildColumnMapping({
    groupField: inferred.groupField,
    metric: inferred.metric,
    chartType,
  });

  const widget = await AnalyticsWidget.create({
    organizationId,
    name,
    apiName: widgetApiName,
    description: `Pinned from Astra · ${inferred.moduleKey}`,
    chartType,
    category: 'custom',
    reportId: report._id,
    reportApiName: report.apiName,
    reportVersion: report.version,
    columnMapping,
    kpiValueField: chartType === 'kpi' ? columnMapping.metric : null,
    kpiLabel: chartType === 'kpi' ? name : null,
    status: 'published',
    version: 1,
    publishedAt: new Date(),
    visibility: 'private',
    ownerId: userId,
    createdBy: userId,
    tags: ['astra', 'pinned'],
    templateKey: 'astra_pin',
  });

  await AnalyticsReport.updateOne(
    { _id: report._id, organizationId },
    { $inc: { widgetCount: 1 } }
  );

  const dashboard = await resolveTargetDashboard({
    organizationId,
    userId,
    dashboardId,
    appKey,
  });

  const layout = Array.isArray(dashboard.layout) ? [...dashboard.layout] : [];
  const maxY = layout.reduce(
    (max, item) => Math.max(max, Number(item.y || 0) + Number(item.h || 0)),
    0
  );
  const instanceId = `astra_${crypto.randomUUID().slice(0, 12)}`;
  layout.push({
    widgetId: widget._id,
    instanceId,
    x: 0,
    y: maxY,
    w: chartType === 'kpi' ? 3 : 6,
    h: chartType === 'kpi' ? 2 : 4,
  });

  dashboard.layout = layout;
  dashboard.widgetCount = layout.length;
  dashboard.updatedBy = userId;
  if (dashboard.status === 'draft') {
    dashboard.status = 'published';
    dashboard.publishedAt = dashboard.publishedAt || new Date();
  }
  await dashboard.save();

  await AnalyticsWidget.updateOne(
    { _id: widget._id, organizationId },
    { $inc: { dashboardCount: 1 } }
  );

  return {
    dashboard: {
      _id: String(dashboard._id),
      name: dashboard.name,
      category: dashboard.category,
      appKey: dashboard.appKey,
    },
    widget: {
      _id: String(widget._id),
      name: widget.name,
      chartType: widget.chartType,
    },
    report: {
      _id: String(report._id),
      name: report.name,
      primaryModule: report.primaryModule,
    },
    instanceId,
  };
}

/**
 * Pin an existing AnalyticsReport (e.g. Astra Report Builder draft) as a widget.
 */
async function pinExistingReportToDashboard({
  organizationId,
  userId,
  report,
  dashboardId = '',
  appKey = 'SALES',
  chartType = 'bar',
  titleOverride = '',
} = {}) {
  if (!report?._id) {
    const err = new Error('report is required');
    err.statusCode = 400;
    throw err;
  }

  // Schedules / widgets require published reports
  if (report.status !== 'published') {
    await AnalyticsReport.updateOne(
      { _id: report._id, organizationId },
      {
        $set: {
          status: 'published',
          publishedAt: report.publishedAt || new Date(),
        },
      }
    );
    report.status = 'published';
    report.publishedAt = report.publishedAt || new Date();
  }

  const groupField = Array.isArray(report.rowGroups) && report.rowGroups[0]
    ? String(report.rowGroups[0].field || report.rowGroups[0] || 'status')
    : 'status';
  const aggs = Array.isArray(report.aggregations) ? report.aggregations : [];
  const metric = aggs.some((a) => String(a.field || '') === 'amount') ? 'amount' : 'count';
  const resolvedChart = ['pie', 'bar', 'line', 'kpi', 'table'].includes(String(chartType))
    ? String(chartType)
    : 'bar';
  const name = String(titleOverride || report.name || `${report.primaryModule} chart`)
    .trim()
    .slice(0, 120);

  const widgetApiName = await ensureUniqueApiName(
    organizationId,
    slugify(name, 'astra_widget'),
    AnalyticsWidget
  );

  const columnMapping = buildColumnMapping({
    groupField,
    metric,
    chartType: resolvedChart,
  });

  const widget = await AnalyticsWidget.create({
    organizationId,
    name,
    apiName: widgetApiName,
    description: `Pinned from Astra Report Builder · ${report.primaryModule}`,
    chartType: resolvedChart,
    category: 'custom',
    reportId: report._id,
    reportApiName: report.apiName,
    reportVersion: report.version || 1,
    columnMapping,
    kpiValueField: resolvedChart === 'kpi' ? columnMapping.metric : null,
    kpiLabel: resolvedChart === 'kpi' ? name : null,
    status: 'published',
    version: 1,
    publishedAt: new Date(),
    visibility: 'private',
    ownerId: userId,
    createdBy: userId,
    tags: ['astra', 'pinned', 'report-builder'],
    templateKey: 'astra_report_pin',
  });

  await AnalyticsReport.updateOne(
    { _id: report._id, organizationId },
    { $inc: { widgetCount: 1 } }
  );

  const dashboard = await resolveTargetDashboard({
    organizationId,
    userId,
    dashboardId,
    appKey,
  });

  const layout = Array.isArray(dashboard.layout) ? [...dashboard.layout] : [];
  const maxY = layout.reduce(
    (max, item) => Math.max(max, Number(item.y || 0) + Number(item.h || 0)),
    0
  );
  const instanceId = `astra_${crypto.randomUUID().slice(0, 12)}`;
  layout.push({
    widgetId: widget._id,
    instanceId,
    x: 0,
    y: maxY,
    w: resolvedChart === 'kpi' ? 3 : 6,
    h: resolvedChart === 'kpi' ? 2 : 4,
  });

  dashboard.layout = layout;
  dashboard.widgetCount = layout.length;
  dashboard.updatedBy = userId;
  if (dashboard.status === 'draft') {
    dashboard.status = 'published';
    dashboard.publishedAt = dashboard.publishedAt || new Date();
  }
  await dashboard.save();

  await AnalyticsWidget.updateOne(
    { _id: widget._id, organizationId },
    { $inc: { dashboardCount: 1 } }
  );

  return {
    dashboard: {
      _id: String(dashboard._id),
      name: dashboard.name,
      category: dashboard.category,
      appKey: dashboard.appKey,
    },
    widget: {
      _id: String(widget._id),
      name: widget.name,
      chartType: widget.chartType,
    },
    report: {
      _id: String(report._id),
      name: report.name,
      primaryModule: report.primaryModule,
    },
    instanceId,
  };
}

module.exports = {
  pinAstraVisualToDashboard,
  pinExistingReportToDashboard,
  inferModuleAndGroup,
  resolveChartType,
  PINNABLE,
};
