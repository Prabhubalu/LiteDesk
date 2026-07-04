/** Analytics platform types — aligned with docs/Analytics * Fields.md */

export type AnalyticsReportType =
  | 'tabular'
  | 'summary'
  | 'matrix'
  | 'pivot'
  | 'joined'
  | 'trend'
  | 'historical'
  | 'snapshot'
  | 'kpi'
  | 'exception'
  | 'cross_module'
  | 'ad_hoc';

export type AnalyticsAssetStatus = 'draft' | 'published' | 'archived';

export interface AnalyticsUserRef {
  _id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

export interface AnalyticsReportRef {
  _id: string;
  name: string;
  apiName?: string;
  status?: AnalyticsAssetStatus;
  type?: AnalyticsReportType;
  primaryModule?: string;
  version?: number;
}

export interface AnalyticsDashboardRef {
  _id: string;
  name: string;
  apiName?: string;
  status?: AnalyticsAssetStatus;
  category?: AnalyticsDashboardCategory;
}

export type AnalyticsReportCategory =
  | 'sales'
  | 'support'
  | 'inventory'
  | 'finance'
  | 'custom';

export type AnalyticsVisibility = 'private' | 'team' | 'role' | 'organization';

export type AnalyticsExecutionMode = 'sync' | 'async';

export type AnalyticsExecutionStatus = 'success' | 'failed' | 'running';

export type AnalyticsJoinType = 'inner' | 'left' | 'right';

export type AnalyticsFilterLogic = 'AND' | 'OR';

export type AnalyticsGroupOrder = 'asc' | 'desc';

export type AnalyticsExportFormat = 'csv' | 'xlsx' | 'pdf' | 'png';

export type AnalyticsComparisonPeriod =
  | 'previous_month'
  | 'previous_quarter'
  | 'previous_year';

export interface AnalyticsShareTarget {
  type: 'user' | 'team' | 'role';
  id: string;
}

export type AnalyticsReportPermissionLevel = 'owner' | 'editors' | 'viewers';

export interface AnalyticsReportPermissions {
  view?: AnalyticsReportPermissionLevel;
  edit?: AnalyticsReportPermissionLevel;
  clone?: AnalyticsReportPermissionLevel;
  export?: AnalyticsReportPermissionLevel;
  share?: AnalyticsReportPermissionLevel;
}

/** @deprecated use AnalyticsReportPermissions with level strings */
export interface AnalyticsAssetPermissions {
  view?: boolean;
  edit?: boolean;
  clone?: boolean;
  export?: boolean;
  share?: boolean;
}

export interface AnalyticsReportRecord {
  _id: string;
  organizationId: string;
  name: string;
  apiName: string;
  description?: string | null;
  type: AnalyticsReportType;
  category: AnalyticsReportCategory;
  folderId?: string | null;
  status: AnalyticsAssetStatus;
  version: number;
  tags: string[];
  listedInHome?: boolean;
  icon?: string | null;
  color?: string | null;
  primaryModule: string;
  relatedModules: string[];
  relationships?: unknown;
  joinType: AnalyticsJoinType;
  baseCollection?: string | null;
  selectedFields: unknown;
  hiddenFields?: unknown;
  calculatedFields?: unknown;
  customLabels?: unknown;
  displayOrder?: unknown;
  filterTree?: unknown;
  filterLogic: AnalyticsFilterLogic;
  dynamicFilters?: unknown;
  relativeDateFilters?: unknown;
  runtimeFilters: boolean;
  sorting?: unknown;
  rowGroups?: unknown;
  columnGroups?: unknown;
  groupOrder: AnalyticsGroupOrder;
  aggregations?: unknown;
  showGrandTotal: boolean;
  showSubTotals: boolean;
  distinctCount: boolean;
  formulas?: unknown;
  variables?: unknown;
  executionOrder?: unknown;
  dateField?: string | null;
  comparisonPeriod?: AnalyticsComparisonPeriod | null;
  rollingWindow?: number | null;
  pagination: boolean;
  pageSize: number;
  rowLimit: number;
  showRecordCount: boolean;
  drillDownEnabled?: boolean;
  cacheEnabled: boolean;
  cacheDuration: number;
  executionMode: AnalyticsExecutionMode;
  queryTimeout: number;
  schedulingEnabled: boolean;
  schedule?: unknown;
  deliveryChannels?: unknown;
  lastRunAt?: string | null;
  nextRunAt?: string | null;
  exportFormats: AnalyticsExportFormat[];
  defaultExport: AnalyticsExportFormat;
  printSettings?: unknown;
  ownerId: string | AnalyticsUserRef;
  visibility: AnalyticsVisibility;
  sharedWith?: AnalyticsShareTarget[] | null;
  permissions?: AnalyticsReportPermissions | null;
  widgetCount: number;
  dashboardCount: number;
  apiUsage: number;
  certified?: boolean;
  certifiedBy?: string | null;
  certifiedAt?: string | null;
  viewCount?: number;
  lastViewedAt?: string | null;
  createdBy: string;
  updatedBy?: string | null;
  publishedAt?: string | null;
  archivedAt?: string | null;
  lastExecutedAt?: string | null;
  executionCount: number;
  averageRuntime?: number | null;
  lastRuntime?: number | null;
  lastExecutionStatus?: AnalyticsExecutionStatus | null;
  lastError?: string | null;
  lastRecordCount?: number | null;
  createdAt: string;
  updatedAt: string;
}

export type AnalyticsChartType =
  | 'table'
  | 'kpi'
  | 'bar'
  | 'line'
  | 'area'
  | 'pie'
  | 'donut'
  | 'funnel'
  | 'gauge'
  | 'heatmap'
  | 'scatter'
  | 'combo';

export type AnalyticsDashboardCategory = 'personal' | 'team' | 'executive' | 'app';

export type AnalyticsDrillDownTarget = 'report' | 'dashboard' | 'record';

export interface AnalyticsThresholdBand {
  min: number | null;
  max: number | null;
  color: string;
  label?: string;
}

export interface AnalyticsWidgetColumnMapping {
  dimension?: string;
  series?: Array<{ field: string; aggregation?: string; label?: string }>;
  metric?: string;
  breakdown?: string;
}

export interface AnalyticsWidgetRecord {
  _id: string;
  organizationId: string;
  name: string;
  apiName: string;
  description?: string | null;
  type: string;
  category?: AnalyticsReportCategory;
  folderId?: string | null;
  status: AnalyticsAssetStatus;
  version: number;
  tags: string[];
  templateKey?: string | null;
  icon?: string | null;
  color?: string | null;
  reportId: string | AnalyticsReportRef;
  reportVersion?: number | null;
  reportApiName?: string | null;
  columnMapping: AnalyticsWidgetColumnMapping;
  filterOverrides?: unknown;
  sortOverrides?: unknown;
  chartType: AnalyticsChartType;
  orientation?: 'horizontal' | 'vertical';
  stacked?: boolean;
  smooth?: boolean;
  showLegend?: boolean;
  legendPosition?: 'top' | 'bottom' | 'left' | 'right';
  showDataLabels?: boolean;
  colorPalette?: string[];
  echartsOptions?: Record<string, unknown>;
  emptyStateMessage?: string | null;
  kpiValueField?: string | null;
  kpiLabel?: string | null;
  kpiPrefix?: string | null;
  kpiSuffix?: string | null;
  kpiComparisonField?: string | null;
  kpiComparisonLabel?: string | null;
  showTrendArrow?: boolean;
  numberFormat?: unknown;
  dateFormat?: string | null;
  currencyCode?: string | null;
  nullDisplay?: string | null;
  conditionalFormatting?: unknown;
  thresholds?: AnalyticsThresholdBand[];
  alertThreshold?: unknown;
  drillDownEnabled?: boolean;
  drillDownTarget?: AnalyticsDrillDownTarget;
  drillDownConfig?: unknown;
  crossFilterEnabled?: boolean;
  crossFilterFields?: unknown;
  tooltipTemplate?: string | null;
  tableColumns?: unknown;
  tablePagination?: boolean;
  tablePageSize?: number;
  tableShowTotals?: boolean;
  tableRowHeight?: 'compact' | 'default' | 'comfortable';
  defaultWidth?: number;
  defaultHeight?: number;
  minWidth?: number;
  minHeight?: number;
  refreshInterval?: number;
  ownerId: string;
  visibility: AnalyticsVisibility;
  sharedWith?: AnalyticsShareTarget[] | null;
  permissions?: AnalyticsAssetPermissions | null;
  dashboardCount: number;
  certified?: boolean;
  certifiedBy?: string | null;
  certifiedAt?: string | null;
  createdBy: string;
  updatedBy?: string | null;
  publishedAt?: string | null;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AnalyticsDashboardLayoutItem {
  widgetId: string;
  instanceId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  locked?: boolean;
}

export interface AnalyticsDashboardVariable {
  key: string;
  type: 'dateRange' | 'user' | 'picklist' | 'text';
  label: string;
  default?: unknown;
  bindTo?: string;
}

export interface AnalyticsDashboardRecord {
  _id: string;
  organizationId: string;
  name: string;
  apiName: string;
  description?: string | null;
  category: AnalyticsDashboardCategory;
  appKey?: string | null;
  folderId?: string | null;
  status: AnalyticsAssetStatus;
  version: number;
  tags: string[];
  templateKey?: string | null;
  icon?: string | null;
  color?: string | null;
  isDefault?: boolean;
  layout: AnalyticsDashboardLayoutItem[];
  layoutMode?: 'fixed' | 'responsive';
  columnCount?: number;
  rowHeight?: number;
  margin?: number;
  backgroundColor?: string | null;
  placements?: unknown;
  titleOverrides?: unknown;
  filterOverrides?: unknown;
  hideWidgets?: string[];
  variables?: AnalyticsDashboardVariable[];
  defaultDateRange?: unknown;
  allowViewerDateChange?: boolean;
  variablePromptOnLoad?: boolean;
  drillDownEnabled?: boolean;
  linkedDashboardId?: string | null;
  recordDetailEnabled?: boolean;
  breadcrumbConfig?: unknown;
  autoRefresh?: boolean;
  refreshInterval?: number;
  loadStrategy?: 'parallel' | 'sequential';
  cacheSharedResults?: boolean;
  ownerId: string;
  visibility: AnalyticsVisibility;
  sharedWith?: AnalyticsShareTarget[] | null;
  permissions?: AnalyticsAssetPermissions | null;
  viewerRoleIds?: string[];
  widgetCount: number;
  viewCount?: number;
  lastViewedAt?: string | null;
  certified?: boolean;
  certifiedBy?: string | null;
  certifiedAt?: string | null;
  exportEnabled?: boolean;
  exportFormats?: AnalyticsExportFormat[];
  printLayout?: unknown;
  headerConfig?: unknown;
  fullScreenEnabled?: boolean;
  createdBy: string;
  updatedBy?: string | null;
  publishedAt?: string | null;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AnalyticsExecuteResult {
  columns: Array<{ key: string; label: string; type?: string; role?: 'row' | 'pivot' | 'total' }>;
  rows: Record<string, unknown>[];
  meta: {
    totalRows: number;
    truncated: boolean;
    executionMs: number;
    reportId: string;
    reportVersion: number;
    matrixLayout?: {
      rowFields: string[];
      columnFields: string[];
      metricKeys: string[];
      pivotColumns: Array<{ key: string; label: string; filterValues?: Record<string, unknown> }>;
    };
    grandTotalRow?: Record<string, unknown>;
    drillDown?: boolean;
    drillContext?: {
      rowFilters?: Record<string, unknown>;
      columnFilters?: Record<string, unknown>;
    };
  };
}

export type AnalyticsAssetType = 'report' | 'widget' | 'dashboard';

export interface AnalyticsHomeKpiStrip {
  reports: number;
  widgets: number;
  dashboards: number;
  folders?: number;
  executionsThisWeek: number;
}

export interface AnalyticsHomeRecentItem {
  assetType: AnalyticsAssetType;
  _id: string;
  name: string;
  apiName: string;
  status: AnalyticsAssetStatus;
  activityAt: string;
  chartType?: string;
  category?: string;
  type?: string;
}

export interface AnalyticsSearchResult {
  assetType: AnalyticsAssetType;
  _id: string;
  name: string;
  apiName: string;
  status: AnalyticsAssetStatus;
  updatedAt: string;
  chartType?: string;
  category?: string;
  type?: string;
  primaryModule?: string;
}

export interface AnalyticsHomePayload {
  kpiStrip: AnalyticsHomeKpiStrip;
  recent: AnalyticsHomeRecentItem[];
  favorites: AnalyticsHomeRecentItem[];
}

export type AnalyticsScheduleFrequency = 'daily' | 'weekly' | 'monthly';
export type AnalyticsScheduleStatus = 'active' | 'paused' | 'archived';

export type AnalyticsScheduleAssetType = 'report' | 'dashboard';

export interface AnalyticsScheduleRecord {
  _id: string;
  name: string;
  reportId?: string | AnalyticsReportRef | null;
  dashboardId?: string | AnalyticsDashboardRef | null;
  assetType: AnalyticsScheduleAssetType;
  frequency: AnalyticsScheduleFrequency;
  timezone: string;
  hour: number;
  minute: number;
  dayOfWeek: number;
  dayOfMonth: number;
  recipients: string[];
  exportFormat: AnalyticsExportFormat;
  emailSubject?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status: AnalyticsScheduleStatus;
  cronExpression?: string | null;
  ownerId: string;
  lastRunAt?: string | null;
  lastRunStatus?: 'success' | 'failed' | 'skipped' | null;
  lastError?: string | null;
  lastSnapshotId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type AnalyticsSnapshotStatus = 'success' | 'failed';

export interface AnalyticsSnapshotRecord {
  _id: string;
  scheduleId: string | AnalyticsScheduleRecord;
  reportId: string | AnalyticsReportRecord;
  reportVersion: number;
  executionId?: string | null;
  status: AnalyticsSnapshotStatus;
  result?: AnalyticsExecuteResult | null;
  rowCount?: number | null;
  error?: string | null;
  capturedAt: string;
  emailSent?: boolean;
  emailRecipients?: string[];
  manual?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type AnalyticsAlertOperator = 'lt' | 'lte' | 'gt' | 'gte' | 'eq';
export type AnalyticsAlertStatus = 'active' | 'paused';

export interface AnalyticsAlertRecord {
  _id: string;
  name: string;
  widgetId: string | AnalyticsWidgetRecord;
  metricField?: string | null;
  operator: AnalyticsAlertOperator;
  threshold: number;
  status: AnalyticsAlertStatus;
  notifyInApp: boolean;
  notifyEmail: boolean;
  recipientUserIds: string[];
  ownerId: string;
  lastTriggeredAt?: string | null;
  lastTriggeredValue?: number | null;
  createdAt: string;
  updatedAt: string;
}
