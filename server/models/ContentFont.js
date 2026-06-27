'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const { CONTENT_FONT_SOURCES } = require('../constants/contentPlatformConstants');

const { Schema } = mongoose;

const ContentFontSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    fontName: { type: String, trim: true, required: true, index: true },
    source: { type: String, enum: CONTENT_FONT_SOURCES, required: true },
    license: { type: String, trim: true, default: '' },
    fallback: { type: String, trim: true, default: 'sans-serif' },
    unicodeRanges: { type: String, trim: true, default: '' },
    storageKey: { type: String, trim: true, default: null },
    usageCount: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null, index: true }
  },
  { timestamps: true, collection: 'content_fonts' }
);

ContentFontSchema.index({ organizationId: 1, fontName: 1 }, { unique: true });

module.exports = wrapTenantModel(mongoose.model('ContentFont', ContentFontSchema));
