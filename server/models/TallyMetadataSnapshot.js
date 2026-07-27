'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const { Schema } = mongoose;

/**
 * Immutable versioned dump of live Tally metadata discovery (ATIP 1B).
 * Runtime schemas/mappings derive from these snapshots — not static catalogs.
 */
const TallyMetadataSnapshotSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    companyGuid: { type: String, required: true, trim: true, index: true },
    connectionId: {
      type: Schema.Types.ObjectId,
      ref: 'TallyConnection',
      default: null,
      index: true,
    },
    version: { type: Number, required: true, default: 1 },
    contentHash: { type: String, required: true, trim: true, index: true },
    tallyVersion: { type: String, trim: true, default: null },
    tdlFingerprint: { type: String, trim: true, default: null },
    tdlPackVersion: { type: String, trim: true, default: null },
    financialYear: { type: String, trim: true, default: null },
    features: { type: Schema.Types.Mixed, default: {} },
    objects: { type: [Schema.Types.Mixed], default: [] },
    collections: { type: [Schema.Types.Mixed], default: [] },
    enumerations: { type: [Schema.Types.Mixed], default: [] },
    relationships: { type: [Schema.Types.Mixed], default: [] },
    rawPayload: { type: Schema.Types.Mixed, default: {} },
    discoveredAt: { type: Date, default: Date.now, index: true },
    discoveredBy: { type: String, enum: ['agent', 'manual', 'scheduled', 'bootstrap'], default: 'agent' },
    status: {
      type: String,
      enum: ['pending', 'ready', 'failed', 'superseded'],
      default: 'ready',
      index: true,
    },
    error: { type: String, trim: true, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

TallyMetadataSnapshotSchema.index(
  { organizationId: 1, companyGuid: 1, version: 1 },
  { unique: true }
);
TallyMetadataSnapshotSchema.index({ organizationId: 1, companyGuid: 1, status: 1, version: -1 });

module.exports = wrapTenantModel(mongoose.model('TallyMetadataSnapshot', TallyMetadataSnapshotSchema));
