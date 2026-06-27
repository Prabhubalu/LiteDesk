'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const { CONTENT_ASSET_TYPES } = require('../constants/contentPlatformConstants');

const { Schema } = mongoose;

const ContentAssetSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    assetId: { type: String, trim: true, required: true, index: true },
    type: { type: String, enum: CONTENT_ASSET_TYPES, required: true, index: true },
    mimeType: { type: String, trim: true, required: true },
    filename: { type: String, trim: true, required: true },
    storageKey: { type: String, trim: true, required: true },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    checksum: { type: String, trim: true, default: null, index: true },
    accessibilityAltText: { type: String, trim: true, default: '' },
    tags: { type: [String], default: [] },
    version: { type: Number, default: 1, min: 1 },
    usageCount: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null, index: true }
  },
  { timestamps: true, collection: 'content_assets' }
);

ContentAssetSchema.index({ organizationId: 1, assetId: 1 }, { unique: true });

module.exports = wrapTenantModel(mongoose.model('ContentAsset', ContentAssetSchema));
