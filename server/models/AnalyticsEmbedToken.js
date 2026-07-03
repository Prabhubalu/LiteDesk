const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const { ANALYTICS_EMBED_TOKEN_STATUSES } = require('../constants/analyticsEmbedToken');

const { Schema } = mongoose;

const AnalyticsEmbedTokenSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    dashboardId: {
      type: Schema.Types.ObjectId,
      ref: 'AnalyticsDashboard',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    tokenPrefix: { type: String, required: true, trim: true, index: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    status: {
      type: String,
      enum: ANALYTICS_EMBED_TOKEN_STATUSES,
      default: 'active',
      index: true,
    },
    expiresAt: { type: Date, default: null },
    lastUsedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    revokedAt: { type: Date, default: null },
    revokedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

AnalyticsEmbedTokenSchema.index({ organizationId: 1, dashboardId: 1, status: 1 });

module.exports = wrapTenantModel(mongoose.model('AnalyticsEmbedToken', AnalyticsEmbedTokenSchema));
