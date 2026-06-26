'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const { Schema } = mongoose;

const ContentThemeSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    name: { type: String, trim: true, required: true, index: true },
    description: { type: String, trim: true, default: '' },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
      index: true
    },
    latestVersion: { type: Number, default: 1, min: 1 },
    colors: { type: Schema.Types.Mixed, default: {} },
    typography: { type: Schema.Types.Mixed, default: {} },
    tables: { type: Schema.Types.Mixed, default: {} },
    charts: { type: Schema.Types.Mixed, default: {} },
    headers: { type: Schema.Types.Mixed, default: {} },
    footers: { type: Schema.Types.Mixed, default: {} },
    watermark: { type: Schema.Types.Mixed, default: {} },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    modifiedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null, index: true }
  },
  { timestamps: true, collection: 'content_themes' }
);

ContentThemeSchema.index({ organizationId: 1, name: 1 }, { unique: true });

module.exports = wrapTenantModel(mongoose.model('ContentTheme', ContentThemeSchema));
