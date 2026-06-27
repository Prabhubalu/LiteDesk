'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const { CONTENT_DEPENDENCY_TYPES } = require('../constants/contentPlatformConstants');

const { Schema } = mongoose;

const ContentDependencySchema = new Schema(
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
    dependencyType: {
      type: String,
      enum: CONTENT_DEPENDENCY_TYPES,
      required: true,
      index: true
    },
    dependencyKey: { type: String, trim: true, required: true, index: true },
    dependencyLabel: { type: String, trim: true, default: '' },
    metadata: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true, collection: 'content_dependencies' }
);

ContentDependencySchema.index(
  { organizationId: 1, templateId: 1, dependencyType: 1, dependencyKey: 1 },
  { unique: true }
);

module.exports = wrapTenantModel(mongoose.model('ContentDependency', ContentDependencySchema));
