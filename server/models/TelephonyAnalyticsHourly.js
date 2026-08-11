'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const TelephonyAnalyticsHourlySchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    hour: { type: String, trim: true, required: true, index: true },
    metrics: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    collection: 'telephony_analytics_hourly',
  }
);

TelephonyAnalyticsHourlySchema.index({ organizationId: 1, hour: 1 }, { unique: true });

module.exports = wrapTenantModel(
  mongoose.model('TelephonyAnalyticsHourly', TelephonyAnalyticsHourlySchema)
);
