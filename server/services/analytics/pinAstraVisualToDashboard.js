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
const { getAnalyticsModuleConfig } = require('./analyticsModuleRegistry');

// Legacy NL filter inference (aiAstraReportBuilderService.detectFilters) removed with Astra v2.
// Pins now fall back to no NL-derived filter tree; explicit filterTree still honored.
function detectFilters() {
  return { filterTree: null };
}

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
    const reportType = String(pin.reportType || '').toLowerCase();
    const pinHasGroup = Object.prototype.hasOwnProperty.call(pin, 'groupField');
    const rawGroup = pinHasGroup ? String(pin.groupField || '').trim() : '';
    const recordLevel = pin.recordLevel === true
      || reportType === 'tabular'
      || (pinHasGroup && rawGroup === '');
    let groupField = '';
    if (pinHasGroup) {
      groupField = rawGroup; // may be '' for record-level charts
    } else if (!recordLevel) {
      groupField = DEFAULT_GROUP_BY[moduleKey] || 'status';
    }
    return {
      moduleKey,
      groupField,
      metric: pin.metric === 'amount' ? 'amount' : 'count',
      reportType,
      question: String(pin.question || '').trim(),
      filterTree: pin.filterTree && typeof pin.filterTree === 'object' ? pin.filterTree : null,
      recordLevel,
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

  return {
    moduleKey,
    groupField,
    metric,
    reportType: '',
    question: '',
    filterTree: null,
    recordLevel: false,
  };
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

/** True when the Astra table is a record list (deal/name/amount), not a stage/count rollup. */
function looksLikeRecordListTable(visual = {}) {
  if (String(visual.component || '').toLowerCase() !== 'data_table') return false;
  const cols = (Array.isArray(visual.columns) ? visual.columns : [])
    .map((c) => String(c || '').toLowerCase().trim());
  if (!cols.length) return false;
  const isAgg = cols.length <= 2
    && cols.some((c) => /^(count|total|value|amount|sum)$/.test(c))
    && cols.some((c) => /^(stage|status|priority|type|owner|assignee)$/.test(c));
  if (isAgg) return false;
  if (cols.some((c) => /deal|name|title|subject|email|amount|owner|contact/.test(c))) return true;
  return cols.length >= 3 && Array.isArray(visual.rows) && visual.rows.length > 0;
}

function wantsTabularPin(visual = {}, inferred = {}) {
  const component = String(visual.component || '').toLowerCase();
  // Charts stay charts — record-level pies must not be forced into a table pin.
  if (component === 'chart' || component === 'progress_list' || component === 'kpi_strip') {
    return false;
  }
  if (inferred.reportType === 'tabular') return true;
  if (inferred.reportType === 'summary' || inferred.reportType === 'matrix') return false;
  if (looksLikeRecordListTable(visual)) return true;
  const blob = `${inferred.question || ''} ${visual.title || ''}`.toLowerCase();
  if (/\b(list of|row.?level|tabular|line items?)\b/.test(blob)) return true;
  if (/\b(over|above|more than|greater than|>|≥)\s*\$?\s*[\d,.]+/.test(blob) && inferred.moduleKey === 'deals') {
    return true;
  }
  return false;
}

/** Chart of individual matching records (not stage/status rollup). */
function wantsRecordLevelChartPin(visual = {}, inferred = {}) {
  if (String(visual.component || '').toLowerCase() !== 'chart') return false;
  if (inferred.recordLevel === true) return true;
  if (inferred.reportType === 'tabular' && !inferred.groupField) return true;
  return false;
}

function recordLabelField(moduleKey = '') {
  const map = {
    deals: 'name',
    tasks: 'title',
    cases: 'title',
    quotes: 'quoteNumber',
    events: 'eventName',
    people: 'first_name',
    organizations: 'name',
    items: 'item_name',
  };
  return map[String(moduleKey || '').toLowerCase()] || 'name';
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
    filterTree: null,
  };
}

function buildTabularReportPreset({ moduleKey, name, question = '', filterTree = null }) {
  const cfg = getAnalyticsModuleConfig(moduleKey);
  const defaults = Array.isArray(cfg?.defaultFields) ? cfg.defaultFields.slice() : ['name'];
  const filterQuestion = String(question || name || '').trim();
  let tree = filterTree?.children?.length ? filterTree : null;
  if (!tree) {
    tree = detectFilters(filterQuestion, moduleKey).filterTree;
  }
  if (tree?.children) {
    for (const child of tree.children) {
      const fk = child?.fieldKey;
      if (fk && !defaults.includes(fk)) defaults.push(fk);
    }
  }
  return {
    name,
    type: 'tabular',
    primaryModule: moduleKey,
    rowGroups: null,
    aggregations: [],
    selectedFields: defaults.slice(0, 10).map((field) => ({ field, role: 'attribute' })),
    filterTree: tree,
  };
}

/** Live pie/bar of each matching record (group by name/title + amount/count). */
function buildRecordLevelChartPreset({
  moduleKey,
  metric,
  name,
  question = '',
  filterTree = null,
}) {
  const labelField = recordLabelField(moduleKey);
  const cfg = getAnalyticsModuleConfig(moduleKey);
  const defaults = Array.isArray(cfg?.defaultFields) ? cfg.defaultFields.slice() : [labelField];
  if (!defaults.includes(labelField)) defaults.unshift(labelField);

  let tree = filterTree?.children?.length ? filterTree : null;
  if (!tree) {
    tree = detectFilters(String(question || name || '').trim(), moduleKey).filterTree;
  }
  if (tree?.children) {
    for (const child of tree.children) {
      const fk = child?.fieldKey;
      if (fk && !defaults.includes(fk)) defaults.push(fk);
    }
  }

  const isAmount = metric === 'amount' && moduleKey === 'deals';
  return {
    name,
    type: 'summary',
    primaryModule: moduleKey,
    rowGroups: [{ field: labelField }],
    aggregations: isAmount
      ? [{ field: 'amount', fn: 'sum', label: 'amount' }]
      : [{ field: '_id', fn: 'count', label: 'count' }],
    selectedFields: defaults.slice(0, 10).map((field) => ({
      field,
      role: field === labelField ? 'dimension' : 'attribute',
    })),
    filterTree: tree,
  };
}

function buildColumnMapping({ groupField, metric, chartType }) {
  if (chartType === 'kpi') {
    return { metric: metric === 'amount' ? 'amount' : 'count' };
  }
  if (chartType === 'table') {
    return {};
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

  const filterQuestion = [
    inferred.question,
    visual.title,
    name,
  ].filter(Boolean).join(' ');

  const recordChart = wantsRecordLevelChartPin(visual, inferred);
  const tabular = !recordChart && wantsTabularPin(visual, inferred);
  const effectiveMetric = recordChart && inferred.moduleKey === 'deals' && inferred.metric !== 'count'
    ? 'amount'
    : inferred.metric;

  let reportPreset;
  if (tabular) {
    reportPreset = buildTabularReportPreset({
      moduleKey: inferred.moduleKey,
      name: `${name} (Astra)`,
      question: filterQuestion,
      filterTree: inferred.filterTree,
    });
  } else if (recordChart) {
    reportPreset = buildRecordLevelChartPreset({
      moduleKey: inferred.moduleKey,
      metric: effectiveMetric,
      name: `${name} (Astra)`,
      question: filterQuestion,
      filterTree: inferred.filterTree,
    });
  } else {
    reportPreset = buildReportPreset({
      moduleKey: inferred.moduleKey,
      groupField: chartType === 'kpi' ? '' : (inferred.groupField || DEFAULT_GROUP_BY[inferred.moduleKey] || 'status'),
      metric: inferred.metric,
      name: `${name} (Astra)`,
    });
    // Apply NL filters (e.g. amount ≥ $50K) onto summary pins too.
    if (!reportPreset.filterTree) {
      reportPreset.filterTree = detectFilters(filterQuestion, inferred.moduleKey).filterTree;
    }
  }

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
    filterTree: reportPreset.filterTree || null,
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

  const mappedGroup = recordChart
    ? recordLabelField(inferred.moduleKey)
    : (inferred.groupField || DEFAULT_GROUP_BY[inferred.moduleKey] || 'status');

  const columnMapping = buildColumnMapping({
    groupField: mappedGroup,
    metric: effectiveMetric,
    chartType: tabular ? 'table' : chartType,
  });

  const widget = await AnalyticsWidget.create({
    organizationId,
    name,
    apiName: widgetApiName,
    description: tabular
      ? `Pinned from Astra · ${inferred.moduleKey} list`
      : (recordChart
        ? `Pinned from Astra · ${inferred.moduleKey} records`
        : `Pinned from Astra · ${inferred.moduleKey}`),
    chartType: tabular ? 'table' : chartType,
    category: 'custom',
    reportId: report._id,
    reportApiName: report.apiName,
    reportVersion: report.version,
    columnMapping,
    kpiValueField: chartType === 'kpi' && !tabular ? columnMapping.metric : null,
    kpiLabel: chartType === 'kpi' && !tabular ? name : null,
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

  const reportType = String(report.type || '').toLowerCase();
  const groupField = Array.isArray(report.rowGroups) && report.rowGroups[0]
    ? String(report.rowGroups[0].field || report.rowGroups[0] || 'status')
    : (reportType === 'tabular' ? '' : 'status');
  const aggs = Array.isArray(report.aggregations) ? report.aggregations : [];
  const metric = aggs.some((a) => String(a.field || '') === 'amount') ? 'amount' : 'count';
  let resolvedChart = ['pie', 'bar', 'line', 'kpi', 'table'].includes(String(chartType))
    ? String(chartType)
    : 'bar';
  // Tabular reports have no stage dimension — never pin them as a fake stage pie.
  if (reportType === 'tabular' && ['pie', 'bar', 'line', 'donut'].includes(resolvedChart)) {
    resolvedChart = 'table';
  }
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
  looksLikeRecordListTable,
  wantsTabularPin,
  wantsRecordLevelChartPin,
  recordLabelField,
  buildRecordLevelChartPreset,
  PINNABLE,
};
