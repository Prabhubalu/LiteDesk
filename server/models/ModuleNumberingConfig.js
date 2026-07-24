'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const RESET_RULES = Object.freeze(['never', 'daily', 'monthly', 'yearly']);

const ModuleNumberingConfigSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    moduleKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    format: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    prefix: {
      type: String,
      trim: true,
      default: '',
      maxlength: 32,
    },
    suffix: {
      type: String,
      trim: true,
      default: '',
      maxlength: 32,
    },
    sequenceLength: {
      type: Number,
      default: 6,
      min: 1,
      max: 15,
    },
    startingSequence: {
      type: Number,
      default: 1,
      min: 1,
    },
    currentSequence: {
      type: Number,
      default: 0,
      min: 0,
    },
    resetRule: {
      type: String,
      enum: RESET_RULES,
      default: 'never',
    },
    allowManualEdit: {
      type: Boolean,
      default: false,
    },
    numberFieldKey: {
      type: String,
      required: true,
      trim: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

ModuleNumberingConfigSchema.index(
  { organizationId: 1, moduleKey: 1 },
  { unique: true }
);

module.exports = wrapTenantModel(
  mongoose.model('ModuleNumberingConfig', ModuleNumberingConfigSchema)
);
module.exports.RESET_RULES = RESET_RULES;
