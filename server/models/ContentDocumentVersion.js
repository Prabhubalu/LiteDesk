'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const { Schema } = mongoose;

const ContentDocumentVersionSchema = new Schema(
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
    version: { type: Number, required: true, min: 1 },
    document: { type: Schema.Types.Mixed, required: true },
    blocks: { type: Schema.Types.Mixed, required: true },
    publishStatus: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
      index: true,
    },
    notes: { type: String, trim: true, default: '' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

ContentDocumentVersionSchema.index(
  { organizationId: 1, contentDocumentId: 1, version: 1 },
  { unique: true },
);

module.exports = wrapTenantModel(mongoose.model('ContentDocumentVersion', ContentDocumentVersionSchema));
