const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const { ANALYTICS_EXECUTION_STATUSES } = require('../constants/analyticsExecution');

const { Schema } = mongoose;

const AnalyticsExecutionSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    reportId: {
      type: Schema.Types.ObjectId,
      ref: 'AnalyticsReport',
      required: true,
      index: true,
    },
    reportVersion: { type: Number, default: 1 },
    status: {
      type: String,
      enum: ANALYTICS_EXECUTION_STATUSES,
      required: true,
      default: 'running',
      index: true,
    },
    preview: { type: Boolean, default: false },
    triggeredBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    runtimeFilters: { type: Schema.Types.Mixed, default: null },
    rowLimit: { type: Number, default: null },
    result: { type: Schema.Types.Mixed, default: null },
    error: { type: String, default: null },
    rowCount: { type: Number, default: null, min: 0 },
    durationMs: { type: Number, default: null, min: 0 },
    cached: { type: Boolean, default: false },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

AnalyticsExecutionSchema.index({ organizationId: 1, reportId: 1, createdAt: -1 });
AnalyticsExecutionSchema.index({ organizationId: 1, triggeredBy: 1, createdAt: -1 });

module.exports = wrapTenantModel(mongoose.model('AnalyticsExecution', AnalyticsExecutionSchema));
