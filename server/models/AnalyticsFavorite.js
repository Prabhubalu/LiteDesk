const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const { Schema } = mongoose;

const ANALYTICS_FAVORITE_ASSET_TYPES = Object.freeze(['report', 'widget', 'dashboard']);

const AnalyticsFavoriteSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    assetType: {
      type: String,
      enum: ANALYTICS_FAVORITE_ASSET_TYPES,
      required: true,
    },
    assetId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

AnalyticsFavoriteSchema.index(
  { organizationId: 1, userId: 1, assetType: 1, assetId: 1 },
  { unique: true }
);

module.exports = wrapTenantModel(mongoose.model('AnalyticsFavorite', AnalyticsFavoriteSchema));
module.exports.ANALYTICS_FAVORITE_ASSET_TYPES = ANALYTICS_FAVORITE_ASSET_TYPES;
