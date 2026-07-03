const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const {
  ANALYTICS_ASSET_STATUSES,
  ANALYTICS_VISIBILITY,
  ANALYTICS_DASHBOARD_CATEGORIES,
  ANALYTICS_LAYOUT_MODES,
  ANALYTICS_LOAD_STRATEGIES,
  ANALYTICS_EXPORT_FORMATS,
} = require('../constants/analytics');

const { Schema } = mongoose;

const AnalyticsDashboardSchema = new Schema(
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
    category: {
      type: String,
      enum: ANALYTICS_DASHBOARD_CATEGORIES,
      required: true,
      default: 'personal',
      index: true,
    },
    appKey: { type: String, trim: true, default: null, index: true },
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
    isDefault: { type: Boolean, default: false, index: true },

    layout: { type: Schema.Types.Mixed, required: true, default: [] },
    layoutMode: { type: String, enum: ANALYTICS_LAYOUT_MODES, default: 'responsive' },
    columnCount: { type: Number, default: 12, min: 1 },
    rowHeight: { type: Number, default: 80, min: 1 },
    margin: { type: Number, default: 8, min: 0 },
    backgroundColor: { type: String, trim: true, default: null },

    placements: { type: Schema.Types.Mixed, default: null },
    titleOverrides: { type: Schema.Types.Mixed, default: null },
    filterOverrides: { type: Schema.Types.Mixed, default: null },
    hideWidgets: { type: [String], default: [] },

    variables: { type: Schema.Types.Mixed, default: null },
    defaultDateRange: { type: Schema.Types.Mixed, default: null },
    allowViewerDateChange: { type: Boolean, default: true },
    variablePromptOnLoad: { type: Boolean, default: false },

    drillDownEnabled: { type: Boolean, default: false },
    linkedDashboardId: {
      type: Schema.Types.ObjectId,
      ref: 'AnalyticsDashboard',
      default: null,
    },
    recordDetailEnabled: { type: Boolean, default: false },
    breadcrumbConfig: { type: Schema.Types.Mixed, default: null },

    autoRefresh: { type: Boolean, default: false },
    refreshInterval: { type: Number, default: 0, min: 0 },
    loadStrategy: { type: String, enum: ANALYTICS_LOAD_STRATEGIES, default: 'parallel' },
    cacheSharedResults: { type: Boolean, default: true },

    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    visibility: {
      type: String,
      enum: ANALYTICS_VISIBILITY,
      required: true,
      default: 'private',
    },
    sharedWith: { type: Schema.Types.Mixed, default: null },
    permissions: { type: Schema.Types.Mixed, default: null },
    viewerRoleIds: { type: [Schema.Types.ObjectId], default: [] },

    widgetCount: { type: Number, default: 0, min: 0 },
    viewCount: { type: Number, default: 0, min: 0 },
    uniqueViewerIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    lastViewedAt: { type: Date, default: null },
    certified: { type: Boolean, default: false },
    certifiedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    certifiedAt: { type: Date, default: null },

    exportEnabled: { type: Boolean, default: false },
    exportFormats: {
      type: [String],
      enum: ANALYTICS_EXPORT_FORMATS,
      default: ['pdf'],
    },
    printLayout: { type: Schema.Types.Mixed, default: null },
    headerConfig: { type: Schema.Types.Mixed, default: null },
    fullScreenEnabled: { type: Boolean, default: true },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    publishedAt: { type: Date, default: null },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

AnalyticsDashboardSchema.index(
  { organizationId: 1, apiName: 1 },
  { unique: true, partialFilterExpression: { status: { $ne: 'archived' } } }
);
AnalyticsDashboardSchema.index({ organizationId: 1, category: 1, appKey: 1, status: 1 });
AnalyticsDashboardSchema.index(
  { organizationId: 1, category: 1, appKey: 1, isDefault: 1 },
  { partialFilterExpression: { isDefault: true } }
);

module.exports = wrapTenantModel(
  mongoose.model('AnalyticsDashboard', AnalyticsDashboardSchema)
);
