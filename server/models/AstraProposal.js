'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

/**
 * Autopilot Next Best Action proposals (tenant-scoped).
 * Writes stay propose→confirm — accepting runs through Astra mutation / client executor.
 */
const AstraProposalActionSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true, maxlength: 120, default: '' },
    kind: { type: String, trim: true, maxlength: 64, default: 'review_record' },
    moduleKey: { type: String, trim: true, maxlength: 64, default: '' },
    recordId: { type: String, trim: true, maxlength: 64, default: '' },
    rationale: { type: String, trim: true, maxlength: 240, default: '' },
    priority: {
      type: String,
      enum: ['high', 'medium', 'low'],
      default: 'medium',
    },
    targetLabel: { type: String, trim: true, maxlength: 80, default: '' },
    fields: { type: mongoose.Schema.Types.Mixed, default: undefined },
    executeNow: { type: Boolean, default: false },
  },
  { _id: false },
);

const AstraProposalSchema = new mongoose.Schema(
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
    /** Stable dedupe key: kind:module:record:trigger */
    fingerprint: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    trigger: {
      type: String,
      trim: true,
      maxlength: 64,
      default: 'nba_scan',
    },
    status: {
      type: String,
      enum: ['proposed', 'accepted', 'dismissed'],
      default: 'proposed',
      index: true,
    },
    action: {
      type: AstraProposalActionSchema,
      required: true,
    },
    acceptedAt: { type: Date, default: null },
    dismissedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null, index: true },
  },
  { timestamps: true },
);

AstraProposalSchema.index(
  { organizationId: 1, userId: 1, fingerprint: 1 },
  { unique: true },
);
AstraProposalSchema.index({ organizationId: 1, userId: 1, status: 1, updatedAt: -1 });

module.exports = wrapTenantModel(mongoose.model('AstraProposal', AstraProposalSchema));
