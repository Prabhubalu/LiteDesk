/**
 * Seed widget templates for A3 catalog (client builder quick-start).
 */
const ANALYTICS_WIDGET_TEMPLATES = Object.freeze([
  {
    templateKey: 'pipeline_by_stage',
    name: 'Pipeline by Stage',
    description: 'Bar chart of deal count by pipeline stage',
    chartType: 'bar',
    category: 'sales',
    columnMapping: { dimension: 'stage', metric: 'count' },
    reportPreset: {
      name: 'Pipeline by Stage',
      type: 'summary',
      primaryModule: 'deals',
      rowGroups: [{ field: 'stage' }],
      aggregations: [{ field: '_id', fn: 'count', label: 'count' }],
    },
  },
  {
    templateKey: 'cases_by_priority',
    name: 'Cases by Priority',
    description: 'Pie chart of open cases by priority',
    chartType: 'pie',
    category: 'support',
    columnMapping: { dimension: 'priority', metric: 'count' },
    reportPreset: {
      name: 'Cases by Priority',
      type: 'summary',
      primaryModule: 'cases',
      rowGroups: [{ field: 'priority' }],
      aggregations: [{ field: '_id', fn: 'count', label: 'count' }],
    },
  },
  {
    templateKey: 'cases_by_status',
    name: 'Cases by Status',
    description: 'Bar chart of cases by status',
    chartType: 'bar',
    category: 'support',
    columnMapping: { dimension: 'status', metric: 'count' },
    reportPreset: {
      name: 'Cases by Status',
      type: 'summary',
      primaryModule: 'cases',
      rowGroups: [{ field: 'status' }],
      aggregations: [{ field: '_id', fn: 'count', label: 'count' }],
    },
  },
  {
    templateKey: 'open_deals_kpi',
    name: 'Open Deals KPI',
    description: 'Single KPI — count of deals',
    chartType: 'kpi',
    category: 'sales',
    columnMapping: { metric: 'count' },
    kpiValueField: 'count',
    kpiLabel: 'Open Deals',
    reportPreset: {
      name: 'Open Deals Count',
      type: 'kpi',
      primaryModule: 'deals',
      aggregations: [{ field: '_id', fn: 'count', label: 'count' }],
    },
  },
  {
    templateKey: 'cases_by_contact_email',
    name: 'Cases by Contact Email',
    description: 'Cross-app: cases grouped by linked contact email (HELPDESK → SALES)',
    chartType: 'bar',
    category: 'support',
    columnMapping: { dimension: 'people.email', metric: 'count' },
    reportPreset: {
      name: 'Cases by Contact Email',
      type: 'summary',
      primaryModule: 'cases',
      relatedModules: ['people'],
      rowGroups: [{ field: 'people.email' }],
      aggregations: [{ field: '_id', fn: 'count', label: 'count' }],
    },
  },
]);

module.exports = { ANALYTICS_WIDGET_TEMPLATES };
