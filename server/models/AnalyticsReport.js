const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const {
  ANALYTICS_REPORT_TYPES,
  ANALYTICS_REPORT_STATUSES,
  ANALYTICS_REPORT_CATEGORIES,
  ANALYTICS_REPORT_JOIN_TYPES,
  ANALYTICS_REPORT_GROUP_ORDERS,
  ANALYTICS_REPORT_FILTER_LOGIC,
  ANALYTICS_REPORT_EXECUTION_MODES,
  ANALYTICS_REPORT_EXECUTION_STATUSES,
  ANALYTICS_REPORT_VISIBILITY,
  ANALYTICS_REPORT_EXPORT_FORMATS,
  ANALYTICS_REPORT_COMPARISON_PERIODS,
} = require('../constants/analytics');

const { Schema } = mongoose;

const AnalyticsReportSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },

    // --- Basic information ---
    name: { type: String, required: true, trim: true },
    apiName: { type: String, required: true, trim: true, index: true },
    description: { type: String, trim: true, default: null },
    type: {
      type: String,
      enum: ANALYTICS_REPORT_TYPES,
      required: true,
      default: 'tabular',
      index: true,
    },
    category: {
      type: String,
      enum: ANALYTICS_REPORT_CATEGORIES,
      default: 'custom',
      index: true,
    },
    folderId: { type: Schema.Types.ObjectId, default: null, index: true },
    status: {
      type: String,
      enum: ANALYTICS_REPORT_STATUSES,
      required: true,
      default: 'draft',
      index: true,
    },
    version: { type: Number, required: true, default: 1, min: 1 },
    tags: { type: [String], default: [] },
    icon: { type: String, trim: true, default: null },
    color: { type: String, trim: true, default: null },

    // --- Data source ---
    primaryModule: { type: String, required: true, trim: true, index: true },
    relatedModules: { type: [String], default: [] },
    relationships: { type: Schema.Types.Mixed, default: null },
    joinType: { type: String, enum: ANALYTICS_REPORT_JOIN_TYPES, default: 'left' },
    baseCollection: { type: String, trim: true, default: null },

    // --- Selected fields ---
    selectedFields: { type: Schema.Types.Mixed, required: true, default: [] },
    hiddenFields: { type: Schema.Types.Mixed, default: null },
    calculatedFields: { type: Schema.Types.Mixed, default: null },
    customLabels: { type: Schema.Types.Mixed, default: null },
    displayOrder: { type: Schema.Types.Mixed, default: null },

    // --- Filters ---
    filterTree: { type: Schema.Types.Mixed, default: null },
    filterLogic: { type: String, enum: ANALYTICS_REPORT_FILTER_LOGIC, default: 'AND' },
    dynamicFilters: { type: Schema.Types.Mixed, default: null },
    relativeDateFilters: { type: Schema.Types.Mixed, default: null },
    runtimeFilters: { type: Boolean, default: false },

    // --- Sorting & grouping ---
    sorting: { type: Schema.Types.Mixed, default: null },
    rowGroups: { type: Schema.Types.Mixed, default: null },
    columnGroups: { type: Schema.Types.Mixed, default: null },
    groupOrder: { type: String, enum: ANALYTICS_REPORT_GROUP_ORDERS, default: 'asc' },

    // --- Aggregation ---
    aggregations: { type: Schema.Types.Mixed, default: null },
    showGrandTotal: { type: Boolean, default: false },
    showSubTotals: { type: Boolean, default: false },
    distinctCount: { type: Boolean, default: false },

    // --- Formula engine ---
    formulas: { type: Schema.Types.Mixed, default: null },
    variables: { type: Schema.Types.Mixed, default: null },
    executionOrder: { type: Schema.Types.Mixed, default: null },

    // --- Time intelligence ---
    dateField: { type: String, trim: true, default: null },
    comparisonPeriod: {
      type: String,
      enum: ANALYTICS_REPORT_COMPARISON_PERIODS,
      default: null,
    },
    rollingWindow: { type: Number, default: null, min: 1 },

    // --- Output settings ---
    pagination: { type: Boolean, default: true },
    pageSize: { type: Number, default: 50, min: 1 },
    rowLimit: { type: Number, default: 1000, min: 1 },
    showRecordCount: { type: Boolean, default: true },

    // --- Performance ---
    cacheEnabled: { type: Boolean, default: true },
    cacheDuration: { type: Number, default: 15, min: 0 },
    executionMode: {
      type: String,
      enum: ANALYTICS_REPORT_EXECUTION_MODES,
      default: 'sync',
    },
    queryTimeout: { type: Number, default: 30, min: 1 },

    // --- Scheduling (preferences; jobs in analytics_schedules) ---
    schedulingEnabled: { type: Boolean, default: false },
    schedule: { type: Schema.Types.Mixed, default: null },
    deliveryChannels: { type: Schema.Types.Mixed, default: null },
    lastRunAt: { type: Date, default: null },
    nextRunAt: { type: Date, default: null },

    // --- Export settings ---
    exportFormats: {
      type: [String],
      enum: ANALYTICS_REPORT_EXPORT_FORMATS,
      default: ['csv'],
    },
    defaultExport: {
      type: String,
      enum: ANALYTICS_REPORT_EXPORT_FORMATS,
      default: 'csv',
    },
    printSettings: { type: Schema.Types.Mixed, default: null },

    // --- Sharing & permissions ---
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    visibility: {
      type: String,
      enum: ANALYTICS_REPORT_VISIBILITY,
      required: true,
      default: 'private',
    },
    sharedWith: { type: Schema.Types.Mixed, default: null },
    permissions: { type: Schema.Types.Mixed, default: null },

    // --- Dependencies (denormalized) ---
    widgetCount: { type: Number, default: 0, min: 0 },
    dashboardCount: { type: Number, default: 0, min: 0 },
    apiUsage: { type: Number, default: 0, min: 0 },

    // --- Certification & usage ---
    certified: { type: Boolean, default: false },
    certifiedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    certifiedAt: { type: Date, default: null },
    viewCount: { type: Number, default: 0, min: 0 },
    uniqueViewerIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    lastViewedAt: { type: Date, default: null },

    // --- Audit ---
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    publishedAt: { type: Date, default: null },
    archivedAt: { type: Date, default: null },

    // --- Runtime statistics (denormalized; full log in analytics_executions) ---
    lastExecutedAt: { type: Date, default: null },
    executionCount: { type: Number, default: 0, min: 0 },
    averageRuntime: { type: Number, default: null, min: 0 },
    lastRuntime: { type: Number, default: null, min: 0 },
    lastExecutionStatus: {
      type: String,
      enum: ANALYTICS_REPORT_EXECUTION_STATUSES,
      default: null,
    },
    lastError: { type: String, default: null },
    lastRecordCount: { type: Number, default: null, min: 0 },
  },
  { timestamps: true }
);

AnalyticsReportSchema.index(
  { organizationId: 1, apiName: 1 },
  { unique: true, partialFilterExpression: { status: { $ne: 'archived' } } }
);
AnalyticsReportSchema.index({ organizationId: 1, status: 1, updatedAt: -1 });
AnalyticsReportSchema.index({ organizationId: 1, ownerId: 1, status: 1 });
AnalyticsReportSchema.index({ organizationId: 1, primaryModule: 1, type: 1 });
AnalyticsReportSchema.index({ organizationId: 1, folderId: 1 });

module.exports = wrapTenantModel(mongoose.model('AnalyticsReport', AnalyticsReportSchema));
