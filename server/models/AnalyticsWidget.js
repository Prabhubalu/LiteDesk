const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const {
  ANALYTICS_ASSET_STATUSES,
  ANALYTICS_VISIBILITY,
  ANALYTICS_CATEGORIES,
  ANALYTICS_CHART_TYPES,
  ANALYTICS_CHART_ORIENTATIONS,
  ANALYTICS_LEGEND_POSITIONS,
  ANALYTICS_DRILL_DOWN_TARGETS,
  ANALYTICS_TABLE_ROW_HEIGHTS,
} = require('../constants/analytics');

const { Schema } = mongoose;

const AnalyticsWidgetSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },

    name: { type: String, required: true, trim: true },
    apiName: { type: String, required: true, trim: true, index: true },
    description: { type: String, trim: true, default: null },
    type: { type: String, trim: true, default: 'chart' },
    category: { type: String, enum: ANALYTICS_CATEGORIES, default: 'custom' },
    folderId: { type: Schema.Types.ObjectId, default: null, index: true },
    status: {
      type: String,
      enum: ANALYTICS_ASSET_STATUSES,
      required: true,
      default: 'draft',
      index: true,
    },
    version: { type: Number, required: true, default: 1, min: 1 },
    tags: { type: [String], default: [] },
    templateKey: { type: String, trim: true, default: null },
    icon: { type: String, trim: true, default: null },
    color: { type: String, trim: true, default: null },

    reportId: {
      type: Schema.Types.ObjectId,
      ref: 'AnalyticsReport',
      required: true,
      index: true,
    },
    reportVersion: { type: Number, default: null, min: 1 },
    reportApiName: { type: String, trim: true, default: null },
    columnMapping: { type: Schema.Types.Mixed, required: true, default: {} },
    filterOverrides: { type: Schema.Types.Mixed, default: null },
    sortOverrides: { type: Schema.Types.Mixed, default: null },

    chartType: {
      type: String,
      enum: ANALYTICS_CHART_TYPES,
      required: true,
      default: 'bar',
      index: true,
    },
    orientation: { type: String, enum: ANALYTICS_CHART_ORIENTATIONS, default: 'vertical' },
    stacked: { type: Boolean, default: false },
    smooth: { type: Boolean, default: false },
    showLegend: { type: Boolean, default: true },
    legendPosition: { type: String, enum: ANALYTICS_LEGEND_POSITIONS, default: 'bottom' },
    showDataLabels: { type: Boolean, default: false },
    colorPalette: { type: [String], default: [] },
    echartsOptions: { type: Schema.Types.Mixed, default: null },
    emptyStateMessage: { type: String, trim: true, default: null },

    kpiValueField: { type: String, trim: true, default: null },
    kpiLabel: { type: String, trim: true, default: null },
    kpiPrefix: { type: String, trim: true, default: null },
    kpiSuffix: { type: String, trim: true, default: null },
    kpiComparisonField: { type: String, trim: true, default: null },
    kpiComparisonLabel: { type: String, trim: true, default: null },
    showTrendArrow: { type: Boolean, default: false },

    numberFormat: { type: Schema.Types.Mixed, default: null },
    dateFormat: { type: String, trim: true, default: null },
    currencyCode: { type: String, trim: true, default: null },
    nullDisplay: { type: String, trim: true, default: '—' },
    conditionalFormatting: { type: Schema.Types.Mixed, default: null },

    thresholds: { type: Schema.Types.Mixed, default: null },
    alertThreshold: { type: Schema.Types.Mixed, default: null },

    drillDownEnabled: { type: Boolean, default: false },
    drillDownTarget: { type: String, enum: ANALYTICS_DRILL_DOWN_TARGETS, default: null },
    drillDownConfig: { type: Schema.Types.Mixed, default: null },
    crossFilterEnabled: { type: Boolean, default: false },
    crossFilterFields: { type: Schema.Types.Mixed, default: null },
    tooltipTemplate: { type: String, trim: true, default: null },

    tableColumns: { type: Schema.Types.Mixed, default: null },
    tablePagination: { type: Boolean, default: true },
    tablePageSize: { type: Number, default: 25, min: 1 },
    tableShowTotals: { type: Boolean, default: false },
    tableRowHeight: {
      type: String,
      enum: ANALYTICS_TABLE_ROW_HEIGHTS,
      default: 'default',
    },

    defaultWidth: { type: Number, default: 6, min: 1 },
    defaultHeight: { type: Number, default: 4, min: 1 },
    minWidth: { type: Number, default: 2, min: 1 },
    minHeight: { type: Number, default: 2, min: 1 },
    refreshInterval: { type: Number, default: 0, min: 0 },

    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    visibility: {
      type: String,
      enum: ANALYTICS_VISIBILITY,
      required: true,
      default: 'private',
    },
    sharedWith: { type: Schema.Types.Mixed, default: null },
    permissions: { type: Schema.Types.Mixed, default: null },

    dashboardCount: { type: Number, default: 0, min: 0 },
    viewCount: { type: Number, default: 0, min: 0 },
    uniqueViewerIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    lastViewedAt: { type: Date, default: null },
    certified: { type: Boolean, default: false },
    certifiedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    certifiedAt: { type: Date, default: null },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    publishedAt: { type: Date, default: null },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

AnalyticsWidgetSchema.index(
  { organizationId: 1, apiName: 1 },
  { unique: true, partialFilterExpression: { status: { $ne: 'archived' } } }
);
AnalyticsWidgetSchema.index({ organizationId: 1, reportId: 1, status: 1 });
AnalyticsWidgetSchema.index({ organizationId: 1, ownerId: 1, status: 1 });

module.exports = wrapTenantModel(mongoose.model('AnalyticsWidget', AnalyticsWidgetSchema));
