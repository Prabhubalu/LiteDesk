'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const TelephonyAnalyticsDailySchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    date: { type: String, trim: true, required: true, index: true },
    metrics: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    collection: 'telephony_analytics_daily',
  }
);

TelephonyAnalyticsDailySchema.index({ organizationId: 1, date: 1 }, { unique: true });

module.exports = wrapTenantModel(
  mongoose.model('TelephonyAnalyticsDaily', TelephonyAnalyticsDailySchema)
);
