'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

/**
 * Tenant-defined Agentic AI specialists routed by Astra.
 * Propose CRM mutations (create/update); never delete.
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
    /** Optional tool capabilities (allowlisted). e.g. web_research, crm_write */
    capabilities: {
      type: [String],
      default: [],
    },
    /**
     * Super Agent (ASTRA_SUPER_AGENTS_V1): can be @mentioned in asks/comments.
     */
    mentionable: {
      type: Boolean,
      default: false,
      index: true,
    },
    /**
     * Optional cron (5-field). Non-empty = eligible for scheduled Super Agent scans.
     * Writes always land as AstraProposal (propose→confirm).
     */
    scheduleCron: {
      type: String,
      trim: true,
      maxlength: 64,
      default: '',
    },
    /** Skills this Super Agent may invoke (ids from aiAstraSkillsRegistry). */
    skillIds: {
      type: [String],
      default: [],
    },
    /** Narrower tool allowlist than capabilities (crm_data, nba, propose_write, …). */
    toolAllowlist: {
      type: [String],
      default: [],
    },
    /** Knowledge scope: CRM modules + future Connected Search sources. */
    knowledgeScope: {
      modules: { type: [String], default: [] },
      sources: { type: [String], default: [] },
    },
    /** User who receives scheduled proposals (defaults to createdBy on schedule tick). */
    scheduleOwnerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    lastScheduledAt: {
      type: Date,
      default: null,
    },
    /** True when Astra auto-created this specialist from an unmatched question. */
    autoCreated: {
      type: Boolean,
      default: false,
      index: true,
    },
    /** Original user question that spawned an auto-created agent (truncated). */
    sourceQuestion: {
      type: String,
      trim: true,
      maxlength: 400,
      default: '',
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
AiTenantAgentSchema.index({ organizationId: 1, mentionable: 1, enabled: 1 });
AiTenantAgentSchema.index({ organizationId: 1, scheduleCron: 1, enabled: 1 });

module.exports = wrapTenantModel(mongoose.model('AiTenantAgent', AiTenantAgentSchema));
