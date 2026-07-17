'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

/**
 * Tenant-defined Agentic AI specialists for Arivu Assistant routing.
 * Propose-only execution — agents do not write CRM records by themselves.
 */
const AiTenantAgentSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 400,
      default: '',
    },
    /** Specialist system prompt used when this agent is selected. */
    systemPrompt: {
      type: String,
      required: true,
      trim: true,
      maxlength: 6000,
    },
    /** Phrases that help route user questions to this agent. */
    triggerPhrases: {
      type: [String],
      default: [],
    },
    /** Optional module affinity (e.g. deals, people). Empty = any page. */
    moduleKeys: {
      type: [String],
      default: [],
    },
    enabled: {
      type: Boolean,
      default: true,
      index: true,
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

AiTenantAgentSchema.index(
  { organizationId: 1, name: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } },
);
AiTenantAgentSchema.index({ organizationId: 1, enabled: 1, updatedAt: -1 });

module.exports = wrapTenantModel(mongoose.model('AiTenantAgent', AiTenantAgentSchema));
