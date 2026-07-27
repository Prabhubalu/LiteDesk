'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const { Schema } = mongoose;

/**
 * CRM-facing contracts generated from discovered Tally object schemas (ATIP Schema Generator).
 */
const TallyGeneratedSchemaSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    companyGuid: { type: String, required: true, trim: true, index: true },
    snapshotId: {
      type: Schema.Types.ObjectId,
      ref: 'TallyMetadataSnapshot',
      required: true,
      index: true,
    },
    objectSchemaId: {
      type: Schema.Types.ObjectId,
      ref: 'TallyObjectSchema',
      default: null,
    },
    tallyObjectKey: { type: String, required: true, trim: true, lowercase: true, index: true },
    arivuEntityType: { type: String, trim: true, default: null, index: true },
    arivuModuleKey: { type: String, trim: true, default: null },
    supportTier: {
      type: String,
      enum: ['supported', 'reference_only', 'discover_only', 'unsupported'],
      default: 'discover_only',
      index: true,
    },
    fields: { type: [Schema.Types.Mixed], default: [] },
    relationships: { type: [Schema.Types.Mixed], default: [] },
    constraints: { type: Schema.Types.Mixed, default: {} },
    validationModel: { type: Schema.Types.Mixed, default: {} },
    mappingDefinitionStubs: { type: [Schema.Types.Mixed], default: [] },
    dtoContract: { type: Schema.Types.Mixed, default: {} },
    schemaVersion: { type: Number, default: 1 },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

TallyGeneratedSchemaSchema.index(
  { organizationId: 1, companyGuid: 1, tallyObjectKey: 1 },
  { unique: true }
);

module.exports = wrapTenantModel(mongoose.model('TallyGeneratedSchema', TallyGeneratedSchemaSchema));
