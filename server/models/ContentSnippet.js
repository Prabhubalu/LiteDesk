'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const { Schema } = mongoose;

const ContentSnippetSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    name: { type: String, trim: true, required: true, index: true },
    content: { type: String, default: '' },
    category: { type: String, trim: true, default: '', index: true },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
      index: true
    },
    latestVersion: { type: Number, default: 1, min: 1 },
    tags: { type: [String], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    modifiedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null, index: true }
  },
  { timestamps: true, collection: 'content_snippets' }
);

ContentSnippetSchema.index({ organizationId: 1, name: 1 }, { unique: true });

module.exports = wrapTenantModel(mongoose.model('ContentSnippet', ContentSnippetSchema));
