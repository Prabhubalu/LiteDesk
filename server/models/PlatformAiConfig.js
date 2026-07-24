'use strict';

/**
 * Singleton platform AI config (master DB).
 * Editable only by platform administrators via Control Plane.
 * Stores encrypted provider API keys + default LLM provider/model for Arivu platform mode.
 */

const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const PlatformAiConfigSchema = new Schema(
  {
    _id: { type: String, default: 'default' },
    /** Resolved when tenant selects provider "arivu" (platform default). */
    defaultLlmProvider: {
      type: String,
      enum: ['openai', 'azure_openai', 'anthropic', 'gemini', 'openrouter', 'nvidia', 'bedrock'],
      default: 'anthropic',
    },
    /** Empty / null = Auto (tier defaults for the provider). */
    defaultLlmModel: {
      type: String,
      trim: true,
      default: null,
    },
    /**
     * Encrypted API keys keyed by provider id.
     * e.g. { anthropic: '<cipher>', openai: '<cipher>' }
     */
    encryptedApiKeys: {
      type: Schema.Types.Mixed,
      default: {},
    },
    /** Last 4 chars per provider for admin UI (never full key). */
    apiKeyLast4: {
      type: Schema.Types.Mixed,
      default: {},
    },
    updatedByUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, collection: 'platform_ai_config' }
);

module.exports =
  mongoose.models.PlatformAiConfig
  || mongoose.model('PlatformAiConfig', PlatformAiConfigSchema);
