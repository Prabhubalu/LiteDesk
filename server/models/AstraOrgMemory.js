'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

/**
 * Astra v2 organization memory (tenant-scoped, shared across users).
 * Holds org-level grounding facts, glossary, and playbook hints the
 * orchestrator injects into the context packet. Namespaced by `scope`.
 */
const AstraOrgMemorySchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    /** Logical bucket, e.g. 'glossary' | 'playbook' | 'grounding' | 'defaults'. */
    scope: { type: String, trim: true, maxlength: 60, required: true, default: 'grounding' },
    key: { type: String, trim: true, maxlength: 120, required: true },
    value: { type: String, trim: true, maxlength: 4000, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true },
);

AstraOrgMemorySchema.index({ organizationId: 1, scope: 1, key: 1 }, { unique: true });

module.exports = wrapTenantModel(mongoose.model('AstraOrgMemory', AstraOrgMemorySchema));
