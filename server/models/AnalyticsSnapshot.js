const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const { ANALYTICS_SNAPSHOT_STATUSES } = require('../constants/analyticsSchedule');

const { Schema } = mongoose;

const AnalyticsSnapshotSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    scheduleId: {
      type: Schema.Types.ObjectId,
      ref: 'AnalyticsSchedule',
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
    executionId: { type: Schema.Types.ObjectId, ref: 'AnalyticsExecution', default: null },
    status: {
      type: String,
      enum: ANALYTICS_SNAPSHOT_STATUSES,
      required: true,
      default: 'success',
      index: true,
    },
    result: { type: Schema.Types.Mixed, default: null },
    rowCount: { type: Number, default: null, min: 0 },
    error: { type: String, default: null },
    capturedAt: { type: Date, default: Date.now, index: true },
    emailSent: { type: Boolean, default: false },
    emailRecipients: [{ type: String, trim: true, lowercase: true }],
    triggeredBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    manual: { type: Boolean, default: false },
  },
  { timestamps: true }
);

AnalyticsSnapshotSchema.index({ organizationId: 1, scheduleId: 1, capturedAt: -1 });
AnalyticsSnapshotSchema.index({ organizationId: 1, reportId: 1, capturedAt: -1 });

module.exports = wrapTenantModel(mongoose.model('AnalyticsSnapshot', AnalyticsSnapshotSchema));
