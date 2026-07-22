'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

/**
 * Astra v2 personal memory (per-user, tenant-scoped).
 * Durable coworker preferences + lightweight recall used by the context engine.
 * Not a chat transcript dump — session transcripts live in sessionMemory.
 */
const AstraPersonalMemorySchema = new mongoose.Schema(
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
    /** Stable key/value facts Astra should remember about how this user works. */
    facts: {
      type: [
        new mongoose.Schema(
          {
            key: { type: String, trim: true, maxlength: 120, required: true },
            value: { type: String, trim: true, maxlength: 2000, default: '' },
            source: { type: String, trim: true, maxlength: 60, default: 'astra' },
            confidence: { type: Number, min: 0, max: 1, default: 0.6 },
          },
          { _id: false, timestamps: true },
        ),
      ],
      default: [],
    },
    /** Free-form preferences (voice, defaults) consumed by promptLibrary/context. */
    preferences: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    /** Last surface/record focus for @Astra continuity. */
    lastSurface: { type: String, trim: true, maxlength: 80, default: '' },
    lastModuleKey: { type: String, trim: true, maxlength: 80, default: '' },
    lastRecordId: { type: String, trim: true, maxlength: 80, default: '' },
  },
  { timestamps: true },
);

AstraPersonalMemorySchema.index({ organizationId: 1, userId: 1 }, { unique: true });

module.exports = wrapTenantModel(mongoose.model('AstraPersonalMemory', AstraPersonalMemorySchema));
