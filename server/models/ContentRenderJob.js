'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const {
  CONTENT_RENDER_JOB_STATUSES,
  CONTENT_RENDER_JOB_PRIORITIES,
  CONTENT_OUTPUT_FORMATS
} = require('../constants/contentPlatformConstants');

const { Schema } = mongoose;

const ContentRenderJobSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    jobId: { type: String, trim: true, required: true, index: true },
    templateId: {
      type: Schema.Types.ObjectId,
      ref: 'ContentTemplate',
      required: true,
      index: true
    },
    templateVersion: { type: Number, required: true, min: 1 },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    priority: {
      type: String,
      enum: CONTENT_RENDER_JOB_PRIORITIES,
      default: 'normal',
      index: true
    },
    status: {
      type: String,
      enum: CONTENT_RENDER_JOB_STATUSES,
      default: 'queued',
      index: true
    },
    outputFormat: {
      type: String,
      enum: CONTENT_OUTPUT_FORMATS,
      default: 'pdf'
    },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    retryCount: { type: Number, default: 0, min: 0 },
    runtimeContext: { type: Schema.Types.Mixed, default: {} },
    error: { type: Schema.Types.Mixed, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null }
  },
  { timestamps: true, collection: 'content_render_jobs' }
);

ContentRenderJobSchema.index({ organizationId: 1, jobId: 1 }, { unique: true });
ContentRenderJobSchema.index({ organizationId: 1, status: 1, createdAt: -1 });

module.exports = wrapTenantModel(mongoose.model('ContentRenderJob', ContentRenderJobSchema));
