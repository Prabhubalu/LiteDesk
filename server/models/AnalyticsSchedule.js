const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const {
  ANALYTICS_SCHEDULE_FREQUENCIES,
  ANALYTICS_SCHEDULE_STATUSES,
  ANALYTICS_SCHEDULE_EXPORT_FORMATS,
  ANALYTICS_SCHEDULE_RUN_STATUSES,
} = require('../constants/analyticsSchedule');

const { Schema } = mongoose;

const AnalyticsScheduleSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    reportId: {
      type: Schema.Types.ObjectId,
      ref: 'AnalyticsReport',
      default: null,
      index: true,
    },
    dashboardId: {
      type: Schema.Types.ObjectId,
      ref: 'AnalyticsDashboard',
      default: null,
      index: true,
    },
    assetType: { type: String, enum: ['report', 'dashboard'], default: 'report' },
    frequency: {
      type: String,
      enum: ANALYTICS_SCHEDULE_FREQUENCIES,
      required: true,
      default: 'weekly',
    },
    timezone: { type: String, default: 'UTC', trim: true },
    hour: { type: Number, default: 9, min: 0, max: 23 },
    minute: { type: Number, default: 0, min: 0, max: 59 },
    dayOfWeek: { type: Number, default: 1, min: 0, max: 6 },
    dayOfMonth: { type: Number, default: 1, min: 1, max: 28 },
    recipients: [{ type: String, trim: true, lowercase: true }],
    exportFormat: {
      type: String,
      enum: ANALYTICS_SCHEDULE_EXPORT_FORMATS,
      default: 'csv',
    },
    emailSubject: { type: String, trim: true, default: null },
    status: {
      type: String,
      enum: ANALYTICS_SCHEDULE_STATUSES,
      default: 'active',
      index: true,
    },
    cronExpression: { type: String, default: null },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    lastRunAt: { type: Date, default: null },
    lastRunStatus: {
      type: String,
      enum: ANALYTICS_SCHEDULE_RUN_STATUSES,
      default: null,
    },
    lastError: { type: String, default: null },
    lastSnapshotId: { type: Schema.Types.ObjectId, ref: 'AnalyticsSnapshot', default: null },
    nextRunAt: { type: Date, default: null },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
  },
  { timestamps: true }
);

AnalyticsScheduleSchema.index({ organizationId: 1, status: 1, updatedAt: -1 });
AnalyticsScheduleSchema.index({ organizationId: 1, reportId: 1, status: 1 });
AnalyticsScheduleSchema.index({ organizationId: 1, dashboardId: 1, status: 1 });

module.exports = wrapTenantModel(mongoose.model('AnalyticsSchedule', AnalyticsScheduleSchema));
