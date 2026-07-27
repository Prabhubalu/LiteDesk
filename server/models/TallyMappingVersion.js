'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const { Schema } = mongoose;

const ruleChangeSchema = new Schema(
  {
    action: {
      type: String,
      enum: ['accept', 'reject', 'modify', 'custom', 'auto_accept', 'invalidate'],
      required: true,
    },
    tallyField: { type: String, trim: true, default: null },
    arivuField: { type: String, trim: true, default: null },
    confidence: { type: Number, default: null },
    transformRule: { type: Schema.Types.Mixed, default: null },
    actorUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    at: { type: Date, default: Date.now },
    note: { type: String, trim: true, default: null },
  },
  { _id: false }
);

/**
 * Versioned module + field mapping set with accept/reject history (ATIP Mapping Engine).
 */
const TallyMappingVersionSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    companyGuid: { type: String, required: true, trim: true, index: true },
    version: { type: Number, required: true, default: 1 },
    status: {
      type: String,
      enum: ['draft', 'active', 'superseded', 'invalidated'],
      default: 'draft',
      index: true,
    },
    snapshotId: {
      type: Schema.Types.ObjectId,
      ref: 'TallyMetadataSnapshot',
      default: null,
    },
    generatedSchemaVersion: { type: Number, default: null },
    /** Field rules: [{ tallyField, arivuField, confidence, transform, direction, entityType }] */
    fieldRules: { type: [Schema.Types.Mixed], default: [] },
    moduleRules: { type: [Schema.Types.Mixed], default: [] },
    taxRules: { type: [Schema.Types.Mixed], default: [] },
    history: { type: [ruleChangeSchema], default: [] },
    averageConfidence: { type: Number, default: null },
    autoAcceptedCount: { type: Number, default: 0 },
    pendingReviewCount: { type: Number, default: 0 },
    activatedAt: { type: Date, default: null },
    activatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

TallyMappingVersionSchema.index(
  { organizationId: 1, companyGuid: 1, version: 1 },
  { unique: true }
);
TallyMappingVersionSchema.index({ organizationId: 1, companyGuid: 1, status: 1 });

module.exports = wrapTenantModel(mongoose.model('TallyMappingVersion', TallyMappingVersionSchema));
