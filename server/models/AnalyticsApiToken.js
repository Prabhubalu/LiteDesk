const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const {
  ANALYTICS_API_TOKEN_STATUSES,
  ANALYTICS_API_TOKEN_SCOPES,
} = require('../constants/analyticsApiToken');

const { Schema } = mongoose;

const AnalyticsApiTokenSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    tokenPrefix: { type: String, required: true, trim: true, index: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    scopes: {
      type: [String],
      enum: ANALYTICS_API_TOKEN_SCOPES,
      default: ['reports:read', 'reports:execute'],
    },
    allowedReportIds: [{ type: Schema.Types.ObjectId, ref: 'AnalyticsReport' }],
    actorUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ANALYTICS_API_TOKEN_STATUSES,
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

AnalyticsApiTokenSchema.index({ organizationId: 1, status: 1, updatedAt: -1 });

module.exports = wrapTenantModel(mongoose.model('AnalyticsApiToken', AnalyticsApiTokenSchema));
