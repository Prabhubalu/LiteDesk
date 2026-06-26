'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const { Schema } = mongoose;

const ContentReusableComponentSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    componentId: { type: String, trim: true, required: true, index: true },
    name: { type: String, trim: true, required: true, index: true },
    category: { type: String, trim: true, default: '', index: true },
    schema: { type: Schema.Types.Mixed, required: true },
    icon: { type: String, trim: true, default: null },
    supportedOutputs: { type: [String], default: ['pdf', 'html', 'email'] },
    configurableProperties: { type: Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
      index: true
    },
    latestVersion: { type: Number, default: 1, min: 1 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    modifiedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null, index: true }
  },
  { timestamps: true, collection: 'content_components' }
);

ContentReusableComponentSchema.index({ organizationId: 1, componentId: 1 }, { unique: true });

module.exports = wrapTenantModel(
  mongoose.model('ContentReusableComponent', ContentReusableComponentSchema)
);
