'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

/**
 * Per-tenant overlay for platform tool metadata (run() stays in code).
 */
const AstraTenantToolConfigSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    toolName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    /** Same as toolName when seeded from platform. */
    defaultToolName: {
      type: String,
      trim: true,
      maxlength: 120,
      default: null,
    },
    title: {
      type: String,
      trim: true,
      maxlength: 160,
      default: '',
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
    enabled: {
      type: Boolean,
      default: true,
      index: true,
    },
    isCustomized: {
      type: Boolean,
      default: false,
      index: true,
    },
    catalogVersion: {
      type: Number,
      default: 1,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true },
);

AstraTenantToolConfigSchema.index(
  { organizationId: 1, toolName: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } },
);

module.exports = wrapTenantModel(
  mongoose.model('AstraTenantToolConfig', AstraTenantToolConfigSchema),
);
