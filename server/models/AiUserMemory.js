'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

/**
 * Durable Astra prefs per user (tenant-scoped).
 * Feeds NBA / Autopilot ranking — not free-form chat memory dumps.
 */
const AiUserMemorySchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    /** Prefer open pipeline when ranking deals */
    preferOpenFirst: { type: Boolean, default: true },
    /** Default deal amount floor for suggestions (USD) */
    amountThreshold: { type: Number, default: null },
    preferredChart: {
      type: String,
      enum: ['', 'pie', 'bar', 'donut', 'table'],
      default: '',
    },
    /** Per-chat model override (must be in org provider catalog) */
    preferredLlmModel: {
      type: String,
      trim: true,
      maxlength: 120,
      default: '',
    },
    /** Fingerprints user dismissed — deprioritize in Autopilot */
    dismissedFingerprints: {
      type: [String],
      default: [],
    },
    /** Last focused CRM record for @Astra continuity */
    lastModuleKey: { type: String, trim: true, default: '' },
    lastRecordId: { type: String, trim: true, default: '' },
    lastRecordTitle: { type: String, trim: true, maxlength: 120, default: '' },
  },
  { timestamps: true },
);

AiUserMemorySchema.index({ organizationId: 1, userId: 1 }, { unique: true });

module.exports = wrapTenantModel(mongoose.model('AiUserMemory', AiUserMemorySchema));
