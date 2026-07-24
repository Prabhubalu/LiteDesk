'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const {
  CONTENT_STUDIO_CONTENT_TYPES,
  CONTENT_STUDIO_STATUSES,
  CONTENT_STUDIO_VISIBILITY,
  CONTENT_STUDIO_COVER_POSITIONS,
  CONTENT_STUDIO_SUBTITLE_SIZES,
} = require('../constants/contentStudioConstants');

const { Schema } = mongoose;

const ContentDocumentPresentationSchema = new Schema(
  {
    coverPosition: {
      type: String,
      enum: CONTENT_STUDIO_COVER_POSITIONS,
      default: 'below-title',
    },
    titleOverlapCover: { type: Boolean, default: false },
    subtitleSize: {
      type: String,
      enum: CONTENT_STUDIO_SUBTITLE_SIZES,
      default: 'md',
    },
    headingColor: { type: String, trim: true, default: '' },
    subheadingColor: { type: String, trim: true, default: '' },
  },
  { _id: false },
);

const ContentDocumentSeoSchema = new Schema(
  {
    metaTitle: { type: String, trim: true, default: '' },
    metaDescription: { type: String, trim: true, default: '' },
    canonicalUrl: { type: String, trim: true, default: '' },
    robots: { type: String, trim: true, default: '' },
    // String: ContentAsset ObjectId hex or MarketingAsset assetId UUID (Blog).
    ogImageAssetId: { type: String, trim: true, default: null },
  },
  { _id: false },
);

const ContentDocumentSchema = new Schema(
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
    appKey: {
      type: String,
      trim: true,
      uppercase: true,
      required: true,
      index: true,
    },
    contentType: {
      type: String,
      enum: CONTENT_STUDIO_CONTENT_TYPES,
      required: true,
      index: true,
    },
    title: { type: String, trim: true, required: true, index: true },
    /** Module Numbering Record ID for articles addon */
    articleNumber: { type: String, trim: true },
    /** Module Numbering Record ID for blog addon */
    blogNumber: { type: String, trim: true },
    subtitle: { type: String, trim: true, default: '' },
    slug: { type: String, trim: true, required: true, index: true },
    summary: { type: String, trim: true, default: '' },
    searchText: { type: String, trim: true, default: '' },
    status: {
      type: String,
      enum: CONTENT_STUDIO_STATUSES,
      default: 'draft',
      index: true,
    },
    visibility: {
      type: String,
      enum: CONTENT_STUDIO_VISIBILITY,
      default: 'internal',
      index: true,
    },
    language: { type: String, trim: true, default: 'en' },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    authorName: {
      type: String,
      trim: true,
      default: '',
    },
    // String so Blog covers can store MarketingAsset ObjectId hex or assetId UUID.
    coverAssetId: {
      type: String,
      trim: true,
      default: null,
    },
    categoryIds: [{ type: Schema.Types.ObjectId, ref: 'ContentCategory' }],
    tagIds: [{ type: Schema.Types.ObjectId, ref: 'ContentTag' }],
    collectionId: {
      type: Schema.Types.ObjectId,
      ref: 'ContentCollection',
      default: null,
      index: true,
    },
    seo: { type: ContentDocumentSeoSchema, default: () => ({}) },
    presentation: { type: ContentDocumentPresentationSchema, default: () => ({}) },
    currentVersionId: {
      type: Schema.Types.ObjectId,
      ref: 'ContentDocumentVersion',
      default: null,
    },
    publishedVersionId: {
      type: Schema.Types.ObjectId,
      ref: 'ContentDocumentVersion',
      default: null,
    },
    latestVersion: { type: Number, default: 1, min: 1 },
    publishedAt: { type: Date, default: null, index: true },
    featured: { type: Boolean, default: false, index: true },
    sticky: { type: Boolean, default: false, index: true },
    tags: {
      type: [{ type: String, trim: true, lowercase: true }],
      default: [],
      validate: {
        validator(value) {
          return !Array.isArray(value) || value.length <= 20;
        },
        message: 'A content document may have at most 20 tags',
      },
    },
    readingTimeMinutes: { type: Number, default: null, min: 1 },
    scheduledAt: { type: Date, default: null, index: true },
    archivedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

ContentDocumentSchema.index(
  { organizationId: 1, slug: 1, contentType: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);
ContentDocumentSchema.index({ organizationId: 1, status: 1, contentType: 1 });
ContentDocumentSchema.index({ organizationId: 1, addonKey: 1, updatedAt: -1 });
ContentDocumentSchema.index(
  { organizationId: 1, articleNumber: 1 },
  { unique: true, sparse: true }
);
ContentDocumentSchema.index(
  { organizationId: 1, blogNumber: 1 },
  { unique: true, sparse: true }
);

ContentDocumentSchema.pre('validate', async function assignContentRecordNumber(next) {
  if (!this.isNew) return next();
  try {
    const { assignModuleRecordNumber } = require('../utils/assignModuleRecordNumber');
    const addon = String(this.addonKey || '').toLowerCase();
    if (addon === 'articles' && !this.articleNumber) {
      await assignModuleRecordNumber(this, {
        moduleKey: 'articles',
        fieldKey: 'articleNumber',
      });
    } else if (addon === 'blog' && !this.blogNumber) {
      await assignModuleRecordNumber(this, {
        moduleKey: 'blog',
        fieldKey: 'blogNumber',
      });
    }
    return next();
  } catch (err) {
    return next(err);
  }
});

module.exports = wrapTenantModel(mongoose.model('ContentDocument', ContentDocumentSchema));
