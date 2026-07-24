'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

/**
 * Per-tenant Astra agent seat (seeded from platform builtins, then customizable).
 */
const AstraTenantAgentSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    /** Stable seat key (matches platform builtin name when seeded). */
    key: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    /** Platform builtin name when seeded/cloned; null = fully custom. */
    defaultKey: {
      type: String,
      trim: true,
      maxlength: 80,
      default: null,
    },
    title: {
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
    systemHint: {
      type: String,
      trim: true,
      maxlength: 32000,
      default: '',
    },
    autonomy: {
      type: String,
      enum: ['assist', 'confirm'],
      default: 'assist',
    },
    toolAllowlist: {
      type: [String],
      default: [],
    },
    enabled: {
      type: Boolean,
      default: true,
      index: true,
    },
    catalogVersion: {
      type: Number,
      default: 1,
    },
    isCustomized: {
      type: Boolean,
      default: false,
      index: true,
    },
    /** master | runtime | builtin | custom */
    source: {
      type: String,
      enum: ['master', 'runtime', 'builtin', 'custom'],
      default: 'custom',
      index: true,
    },
    toolRecipes: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    triggerPhrases: {
      type: [String],
      default: [],
    },
    basePrompt: {
      type: String,
      trim: true,
      maxlength: 8000,
      default: '',
    },
    basePromptVersion: {
      type: Number,
      default: 1,
    },
    learnedProfile: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    embedding: {
      type: [Number],
      default: undefined,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true },
);

AstraTenantAgentSchema.index(
  { organizationId: 1, key: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } },
);
AstraTenantAgentSchema.index({ organizationId: 1, enabled: 1, updatedAt: -1 });

module.exports = wrapTenantModel(mongoose.model('AstraTenantAgent', AstraTenantAgentSchema));
