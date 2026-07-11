'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const { Schema } = mongoose;

const ContentCollectionSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    addonKey: {
      type: String,
      trim: true,
      lowercase: true,
      required: true,
      index: true,
    },
    name: { type: String, trim: true, required: true },
    slug: { type: String, trim: true, required: true, index: true },
    description: { type: String, trim: true, default: '' },
    emoji: { type: String, trim: true, default: '', maxlength: 8 },
    heroIconKey: { type: String, trim: true, default: '', maxlength: 64 },
    heroIconColor: { type: String, trim: true, default: '', maxlength: 16 },
    imageUrl: { type: String, trim: true, default: '', maxlength: 2048 },
    parentId: {
      type: Schema.Types.ObjectId,
      ref: 'ContentCollection',
      default: null,
      index: true,
    },
    sortOrder: { type: Number, default: 0 },
    deletedAt: { type: Date, default: null, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

ContentCollectionSchema.index(
  { organizationId: 1, addonKey: 1, slug: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);

module.exports = wrapTenantModel(mongoose.model('ContentCollection', ContentCollectionSchema));
