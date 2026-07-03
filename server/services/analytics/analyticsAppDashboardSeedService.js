const AnalyticsReport = require('../../models/AnalyticsReport');
const AnalyticsWidget = require('../../models/AnalyticsWidget');
const AnalyticsDashboard = require('../../models/AnalyticsDashboard');
const { ANALYTICS_WIDGET_TEMPLATES } = require('../../constants/analyticsWidgetTemplates');

function slugify(name, fallback = 'asset') {
  return String(name || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80);
}

async function ensureUniqueApiName(organizationId, base, model) {
  let apiName = base;
  let suffix = 1;
  while (suffix < 50) {
    const exists = await model.findOne({ organizationId, apiName, status: { $ne: 'archived' } })
      .select('_id')
      .lean();
    if (!exists) return apiName;
    apiName = `${base}_${suffix}`;
    suffix += 1;
  }
  return `${base}_${Date.now()}`;
}

async function createPublishedReportFromPreset(organizationId, userId, preset, suffix = '') {
  const apiName = await ensureUniqueApiName(
    organizationId,
    slugify(`${preset.name}${suffix}`),
    AnalyticsReport
  );

  const report = await AnalyticsReport.create({
    organizationId,
    name: preset.name,
    apiName,
    type: preset.type || 'summary',
    primaryModule: preset.primaryModule,
    relatedModules: preset.relatedModules || [],
    selectedFields: preset.selectedFields || [],
    rowGroups: preset.rowGroups || null,
    aggregations: preset.aggregations || null,
    filterLogic: 'AND',
    status: 'published',
    version: 1,
    publishedAt: new Date(),
    visibility: 'organization',
    ownerId: userId,
    createdBy: userId,
  });

  return report;
}

async function createPublishedWidgetFromTemplate(organizationId, userId, templateKey, reportId) {
  const template = ANALYTICS_WIDGET_TEMPLATES.find((t) => t.templateKey === templateKey);
  if (!template) return null;

  const apiName = await ensureUniqueApiName(organizationId, slugify(template.name), AnalyticsWidget);
  const widget = await AnalyticsWidget.create({
    organizationId,
    name: template.name,
    apiName,
    description: template.description,
    chartType: template.chartType,
    category: template.category,
    reportId,
    columnMapping: template.columnMapping || {},
    kpiValueField: template.kpiValueField || null,
    kpiLabel: template.kpiLabel || null,
    status: 'published',
    version: 1,
    publishedAt: new Date(),
    visibility: 'organization',
    ownerId: userId,
    createdBy: userId,
  });

  await AnalyticsReport.updateOne({ _id: reportId, organizationId }, { $inc: { widgetCount: 1 } });
  return widget;
}

/**
 * Lazy-seed default HELPDESK app dashboard when none exists (A8 migration).
 */
async function ensureDefaultAppDashboard(organizationId, userId, appKey) {
  const normalizedAppKey = String(appKey || '').trim().toUpperCase();
  if (!normalizedAppKey) return null;

  const existing = await AnalyticsDashboard.findOne({
    organizationId,
    status: 'published',
    category: 'app',
    appKey: normalizedAppKey,
  })
    .sort({ isDefault: -1, updatedAt: -1 })
    .lean();

  if (existing) return existing;

  if (normalizedAppKey !== 'HELPDESK' && normalizedAppKey !== 'SALES') return null;

  const templateKeys =
    normalizedAppKey === 'SALES'
      ? ['pipeline_by_stage', 'open_deals_kpi']
      : ['cases_by_priority', 'cases_by_status'];

  const presets = templateKeys
    .map((key) => ANALYTICS_WIDGET_TEMPLATES.find((t) => t.templateKey === key))
    .filter(Boolean);
  const widgets = [];

  for (const preset of presets) {
    const reportPreset = preset.reportPreset;
    if (!reportPreset) continue;
    const report = await createPublishedReportFromPreset(organizationId, userId, reportPreset);
    const widget = await createPublishedWidgetFromTemplate(
      organizationId,
      userId,
      preset.templateKey,
      report._id
    );
    if (widget) widgets.push(widget);
  }

  if (!widgets.length) return null;

  const layout = widgets.map((widget, index) => ({
    widgetId: widget._id,
    instanceId: `w_${index + 1}`,
    x: (index % 2) * 6,
    y: Math.floor(index / 2) * 4,
    w: 6,
    h: 4,
  }));

  const apiName = await ensureUniqueApiName(
    organizationId,
    normalizedAppKey === 'SALES' ? 'sales_app_dashboard' : 'helpdesk_app_dashboard',
    AnalyticsDashboard
  );

  const dashboard = await AnalyticsDashboard.create({
    organizationId,
    name: normalizedAppKey === 'SALES' ? 'Sales Analytics' : 'Helpdesk Analytics',
    apiName,
    description:
      normalizedAppKey === 'SALES'
        ? 'Default Sales app dashboard (platform analytics)'
        : 'Default Helpdesk app dashboard (platform analytics)',
    category: 'app',
    appKey: normalizedAppKey,
    templateKey: normalizedAppKey === 'SALES' ? 'sales_pipeline' : 'helpdesk_sla',
    layout,
    variables: [
      {
        key: 'dateRange',
        type: 'dateRange',
        label: 'Date range',
        default: { preset: 'last30days' },
      },
    ],
    isDefault: true,
    status: 'published',
    version: 1,
    publishedAt: new Date(),
    visibility: 'organization',
    allowViewerDateChange: true,
    ownerId: userId,
    createdBy: userId,
    widgetCount: layout.length,
  });

  for (const widget of widgets) {
    await AnalyticsWidget.updateOne(
      { _id: widget._id, organizationId },
      { $inc: { dashboardCount: 1 } }
    );
  }

  return dashboard.toObject();
}

module.exports = {
  ensureDefaultAppDashboard,
};
