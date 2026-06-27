'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const { CONTENT_OUTPUT_FORMATS } = require('../constants/contentPlatformConstants');

const { Schema } = mongoose;

const ContentRenderOutputSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    jobId: {
      type: Schema.Types.ObjectId,
      ref: 'ContentRenderJob',
      default: null,
      index: true
    },
    templateId: {
      type: Schema.Types.ObjectId,
      ref: 'ContentTemplate',
      required: true,
      index: true
    },
    templateVersion: { type: Number, required: true, min: 1 },
    outputFormat: {
      type: String,
      enum: CONTENT_OUTPUT_FORMATS,
      required: true
    },
    checksum: { type: String, trim: true, default: null, index: true },
    mimeType: { type: String, trim: true, required: true },
    storageProvider: { type: String, trim: true, default: 'local' },
    storageKey: { type: String, trim: true, required: true },
    fileSizeBytes: { type: Number, default: null },
    generatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    generatedAt: { type: Date, default: Date.now, index: true }
  },
  { timestamps: true, collection: 'content_render_outputs' }
);

ContentRenderOutputSchema.index({ organizationId: 1, templateId: 1, generatedAt: -1 });

module.exports = wrapTenantModel(mongoose.model('ContentRenderOutput', ContentRenderOutputSchema));
