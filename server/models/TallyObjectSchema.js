'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const { Schema } = mongoose;

const fieldSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    label: { type: String, trim: true, default: null },
    dataType: { type: String, trim: true, default: 'string' },
    required: { type: Boolean, default: false },
    isKey: { type: Boolean, default: false },
    isEnum: { type: Boolean, default: false },
    enumValues: { type: [String], default: [] },
    parentObject: { type: String, trim: true, default: null },
    childObject: { type: String, trim: true, default: null },
    sampleValues: { type: [Schema.Types.Mixed], default: [] },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

/**
 * Normalized per-object schema derived from a metadata snapshot (ATIP 1B).
 */
const TallyObjectSchemaSchema = new Schema(
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
    objectKey: { type: String, required: true, trim: true, lowercase: true, index: true },
    objectName: { type: String, required: true, trim: true },
    collectionName: { type: String, trim: true, default: null },
    fields: { type: [fieldSchema], default: [] },
    keys: { type: [String], default: [] },
    parents: { type: [String], default: [] },
    children: { type: [String], default: [] },
    methods: { type: [String], default: [] },
    supportTier: {
      type: String,
      enum: ['supported', 'reference_only', 'discover_only', 'unsupported'],
      default: 'discover_only',
      index: true,
    },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

TallyObjectSchemaSchema.index(
  { organizationId: 1, companyGuid: 1, objectKey: 1 },
  { unique: true }
);

module.exports = wrapTenantModel(mongoose.model('TallyObjectSchema', TallyObjectSchemaSchema));
