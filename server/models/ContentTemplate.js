'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const {
  CONTENT_TEMPLATE_STATUSES,
  CONTENT_OUTPUT_FORMATS,
  CONTENT_PAPER_SIZES,
  CONTENT_ORIENTATIONS
} = require('../constants/contentPlatformConstants');
const { DEFAULT_PAGE_MARGINS_MM } = require('../constants/contentPaperSizes');

const { Schema } = mongoose;

const ContentTemplateSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    name: { type: String, trim: true, required: true, index: true },
    templateNumber: { type: String, trim: true },
    description: { type: String, trim: true, default: '' },
    purpose: { type: String, trim: true, default: '', index: true },
    category: { type: String, trim: true, default: '', index: true },
    moduleScope: { type: String, trim: true, default: '', index: true },
    status: {
      type: String,
      enum: CONTENT_TEMPLATE_STATUSES,
      default: 'draft',
      index: true
    },
    latestVersion: { type: Number, default: 1, min: 1 },
    latestPublishedVersion: { type: Number, default: null, min: 1 },
    draftVersionId: {
      type: Schema.Types.ObjectId,
      ref: 'ContentTemplateVersion',
      default: null
    },
    outputFormat: {
      type: String,
      enum: CONTENT_OUTPUT_FORMATS,
      default: 'pdf',
      index: true
    },
    paperSize: {
      type: String,
      enum: CONTENT_PAPER_SIZES,
      default: 'A4'
    },
    orientation: {
      type: String,
      enum: CONTENT_ORIENTATIONS,
      default: 'portrait'
    },
    customPageWidth: {
      type: Number,
      default: null,
      min: 50,
      max: 2000
    },
    customPageHeight: {
      type: Number,
      default: null,
      min: 50,
      max: 2000
    },
    margins: {
      top: { type: Number, default: DEFAULT_PAGE_MARGINS_MM.top },
      right: { type: Number, default: DEFAULT_PAGE_MARGINS_MM.right },
      bottom: { type: Number, default: DEFAULT_PAGE_MARGINS_MM.bottom },
      left: { type: Number, default: DEFAULT_PAGE_MARGINS_MM.left }
    },
    defaultThemeId: {
      type: Schema.Types.ObjectId,
      ref: 'ContentTheme',
      default: null,
      index: true
    },
    locale: { type: String, trim: true, default: 'en' },
    timezone: { type: String, trim: true, default: 'UTC' },
    currency: { type: String, trim: true, default: null },
    currencyDisplay: {
      type: String,
      enum: ['code', 'symbol'],
      default: 'code'
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    visibility: {
      type: String,
      enum: ['private', 'organization', 'public'],
      default: 'organization'
    },
    isDefault: { type: Boolean, default: false, index: true },
    tags: { type: [String], default: [] },
    language: { type: String, trim: true, default: 'en' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    modifiedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true, collection: 'content_templates' }
);

ContentTemplateSchema.index({ organizationId: 1, name: 1 });
ContentTemplateSchema.index({ organizationId: 1, status: 1, updatedAt: -1 });
ContentTemplateSchema.index({ organizationId: 1, templateNumber: 1 }, { unique: true, sparse: true });
ContentTemplateSchema.index(
  { organizationId: 1, moduleScope: 1, purpose: 1, isDefault: 1 },
  { partialFilterExpression: { isDefault: true, deletedAt: null } }
);

ContentTemplateSchema.pre('validate', async function assignTemplateNumber(next) {
  if (this.templateNumber || !this.isNew) return next();
  try {
    const { assignModuleRecordNumber } = require('../utils/assignModuleRecordNumber');
    await assignModuleRecordNumber(this, { moduleKey: 'templates', fieldKey: 'templateNumber' });
    return next();
  } catch (err) {
    return next(err);
  }
});

module.exports = wrapTenantModel(mongoose.model('ContentTemplate', ContentTemplateSchema));
