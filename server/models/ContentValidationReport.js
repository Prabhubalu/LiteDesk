'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const { Schema } = mongoose;

const ContentValidationReportSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    templateId: {
      type: Schema.Types.ObjectId,
      ref: 'ContentTemplate',
      default: null,
      index: true
    },
    templateVersion: { type: Number, default: null },
    status: {
      type: String,
      enum: ['passed', 'failed'],
      required: true,
      index: true
    },
    validationErrors: { type: [Schema.Types.Mixed], default: [] },
    warnings: { type: [Schema.Types.Mixed], default: [] },
    suggestions: { type: [Schema.Types.Mixed], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true, collection: 'content_validation_reports' }
);

ContentValidationReportSchema.index({ organizationId: 1, templateId: 1, createdAt: -1 });

module.exports = wrapTenantModel(
  mongoose.model('ContentValidationReport', ContentValidationReportSchema)
);
