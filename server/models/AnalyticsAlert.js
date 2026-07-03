const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const {
  ANALYTICS_ALERT_STATUSES,
  ANALYTICS_ALERT_OPERATORS,
} = require('../constants/analyticsAlert');

const { Schema } = mongoose;

const AnalyticsAlertSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    widgetId: {
      type: Schema.Types.ObjectId,
      ref: 'AnalyticsWidget',
      required: true,
      index: true,
    },
    metricField: { type: String, trim: true, default: null },
    operator: {
      type: String,
      enum: ANALYTICS_ALERT_OPERATORS,
      required: true,
      default: 'lt',
    },
    threshold: { type: Number, required: true },
    status: {
      type: String,
      enum: ANALYTICS_ALERT_STATUSES,
      default: 'active',
      index: true,
    },
    notifyInApp: { type: Boolean, default: true },
    notifyEmail: { type: Boolean, default: false },
    recipientUserIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    lastTriggeredAt: { type: Date, default: null },
    lastTriggeredValue: { type: Number, default: null },
  },
  { timestamps: true }
);

AnalyticsAlertSchema.index({ organizationId: 1, widgetId: 1, status: 1 });
AnalyticsAlertSchema.index({ organizationId: 1, status: 1, updatedAt: -1 });

module.exports = wrapTenantModel(mongoose.model('AnalyticsAlert', AnalyticsAlertSchema));
