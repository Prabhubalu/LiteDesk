const ANALYTICS_ASSET_STATUSES = Object.freeze(['draft', 'published', 'archived']);

const ANALYTICS_VISIBILITY = Object.freeze(['private', 'team', 'role', 'organization']);

const ANALYTICS_CATEGORIES = Object.freeze([
  'sales',
  'support',
  'inventory',
  'finance',
  'custom',
]);

const ANALYTICS_REPORT_TYPES = Object.freeze([
  'tabular',
  'summary',
  'matrix',
  'pivot',
  'joined',
  'trend',
  'historical',
  'snapshot',
  'kpi',
  'exception',
  'cross_module',
  'ad_hoc',
]);

const ANALYTICS_REPORT_JOIN_TYPES = Object.freeze(['inner', 'left', 'right']);

const ANALYTICS_REPORT_GROUP_ORDERS = Object.freeze(['asc', 'desc']);

const ANALYTICS_REPORT_FILTER_LOGIC = Object.freeze(['AND', 'OR']);

const ANALYTICS_REPORT_EXECUTION_MODES = Object.freeze(['sync', 'async']);

const ANALYTICS_REPORT_EXECUTION_STATUSES = Object.freeze([
  'success',
  'failed',
  'running',
]);

const ANALYTICS_EXPORT_FORMATS = Object.freeze(['csv', 'xlsx', 'pdf', 'png']);

const ANALYTICS_COMPARISON_PERIODS = Object.freeze([
  'previous_month',
  'previous_quarter',
  'previous_year',
]);

const ANALYTICS_CHART_TYPES = Object.freeze([
  'table',
  'kpi',
  'bar',
  'line',
  'area',
  'pie',
  'donut',
  'funnel',
  'gauge',
  'heatmap',
  'scatter',
  'combo',
]);

const ANALYTICS_CHART_ORIENTATIONS = Object.freeze(['horizontal', 'vertical']);

const ANALYTICS_LEGEND_POSITIONS = Object.freeze(['top', 'bottom', 'left', 'right']);

const ANALYTICS_DRILL_DOWN_TARGETS = Object.freeze(['report', 'dashboard', 'record']);

const ANALYTICS_TABLE_ROW_HEIGHTS = Object.freeze(['compact', 'default', 'comfortable']);

const ANALYTICS_DASHBOARD_CATEGORIES = Object.freeze([
  'personal',
  'team',
  'executive',
  'app',
]);

const ANALYTICS_LAYOUT_MODES = Object.freeze(['fixed', 'responsive']);

const ANALYTICS_LOAD_STRATEGIES = Object.freeze(['parallel', 'sequential']);

module.exports = {
  ANALYTICS_ASSET_STATUSES,
  ANALYTICS_VISIBILITY,
  ANALYTICS_CATEGORIES,
  ANALYTICS_REPORT_TYPES,
  ANALYTICS_REPORT_JOIN_TYPES,
  ANALYTICS_REPORT_GROUP_ORDERS,
  ANALYTICS_REPORT_FILTER_LOGIC,
  ANALYTICS_REPORT_EXECUTION_MODES,
  ANALYTICS_REPORT_EXECUTION_STATUSES,
  ANALYTICS_EXPORT_FORMATS,
  ANALYTICS_COMPARISON_PERIODS,
  ANALYTICS_CHART_TYPES,
  ANALYTICS_CHART_ORIENTATIONS,
  ANALYTICS_LEGEND_POSITIONS,
  ANALYTICS_DRILL_DOWN_TARGETS,
  ANALYTICS_TABLE_ROW_HEIGHTS,
  ANALYTICS_DASHBOARD_CATEGORIES,
  ANALYTICS_LAYOUT_MODES,
  ANALYTICS_LOAD_STRATEGIES,
  // Legacy aliases (report model)
  ANALYTICS_REPORT_STATUSES: ANALYTICS_ASSET_STATUSES,
  ANALYTICS_REPORT_CATEGORIES: ANALYTICS_CATEGORIES,
  ANALYTICS_REPORT_VISIBILITY: ANALYTICS_VISIBILITY,
  ANALYTICS_REPORT_EXPORT_FORMATS: ANALYTICS_EXPORT_FORMATS,
  ANALYTICS_REPORT_COMPARISON_PERIODS: ANALYTICS_COMPARISON_PERIODS,
};
