'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const { Schema } = mongoose;

const ContentTemplateVersionSchema = new Schema(
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
      required: true,
      index: true
    },
    version: { type: Number, required: true, min: 1, index: true },
    jsonDefinition: { type: Schema.Types.Mixed, required: true },
    published: { type: Boolean, default: false, index: true },
    releaseNotes: { type: String, trim: true, default: '' },
    validationStatus: {
      type: String,
      enum: ['pending', 'passed', 'failed'],
      default: 'pending'
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    publishedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    publishedAt: { type: Date, default: null }
  },
  { timestamps: true, collection: 'content_template_versions' }
);

ContentTemplateVersionSchema.index(
  { organizationId: 1, templateId: 1, version: 1 },
  { unique: true }
);

module.exports = wrapTenantModel(
  mongoose.model('ContentTemplateVersion', ContentTemplateVersionSchema)
);
