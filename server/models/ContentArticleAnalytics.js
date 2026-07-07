'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const { Schema } = mongoose;

const ContentArticleAnalyticsSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    contentDocumentId: {
      type: Schema.Types.ObjectId,
      ref: 'ContentDocument',
      required: true,
      index: true,
    },
    articleSlug: { type: String, trim: true, default: '', index: true },
    helpfulYes: { type: Number, default: 0, min: 0 },
    helpfulNo: { type: Number, default: 0, min: 0 },
    sharesFacebook: { type: Number, default: 0, min: 0 },
    sharesX: { type: Number, default: 0, min: 0 },
    sharesLinkedin: { type: Number, default: 0, min: 0 },
    lastFeedbackAt: { type: Date, default: null },
  },
  { timestamps: true },
);

ContentArticleAnalyticsSchema.index(
  { organizationId: 1, contentDocumentId: 1 },
  { unique: true },
);

module.exports = wrapTenantModel(mongoose.model('ContentArticleAnalytics', ContentArticleAnalyticsSchema));
