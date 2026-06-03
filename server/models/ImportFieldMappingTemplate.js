const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const { SUPPORTED_MODULES } = require('../services/import/importConstants');

const Schema = mongoose.Schema;

const columnRuleSchema = new Schema(
  {
    targetFieldKey: { type: String, required: true, trim: true },
    sourceAliases: { type: [String], default: [] },
  },
  { _id: false }
);

const duplicatePolicySchema = new Schema(
  {
    shouldCheckDuplicates: { type: Boolean, default: true },
    duplicateCheckFields: { type: [String], default: [] },
    duplicateAction: {
      type: String,
      enum: ['skip', 'update'],
      default: 'skip',
    },
  },
  { _id: false }
);

const ImportFieldMappingTemplateSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    module: {
      type: String,
      enum: SUPPORTED_MODULES,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    columnRules: {
      type: [columnRuleSchema],
      required: true,
      validate: {
        validator(v) {
          return Array.isArray(v) && v.length > 0;
        },
        message: 'At least one column rule is required',
      },
    },
    duplicatePolicy: {
      type: duplicatePolicySchema,
      default: null,
    },
    sampleSourceHeaders: {
      type: [String],
      default: [],
    },
    schemaVersion: {
      type: Number,
      default: 1,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    modifiedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    stats: {
      useCount: { type: Number, default: 0 },
      lastUsedAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

ImportFieldMappingTemplateSchema.index({ organizationId: 1, module: 1, name: 1 });
ImportFieldMappingTemplateSchema.index(
  { organizationId: 1, module: 1, isDefault: 1 },
  { partialFilterExpression: { isDefault: true } }
);

module.exports = wrapTenantModel(
  mongoose.model('ImportFieldMappingTemplate', ImportFieldMappingTemplateSchema)
);
