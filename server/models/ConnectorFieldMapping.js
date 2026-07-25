'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const { Schema } = mongoose;

const fieldRuleSchema = new Schema(
  {
    arivuFieldKey: { type: String, required: true, trim: true },
    externalFieldKey: { type: String, required: true, trim: true },
    transform: { type: String, trim: true, default: null },
    confidence: { type: Number, min: 0, max: 1, default: null },
    approved: { type: Boolean, default: false },
  },
  { _id: false }
);

const ConnectorFieldMappingSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    connectorKey: { type: String, required: true, trim: true, lowercase: true, index: true },
    entityType: { type: String, required: true, trim: true, index: true },
    companyGuid: { type: String, trim: true, default: null, index: true },
    version: { type: Number, default: 1 },
    active: { type: Boolean, default: true, index: true },
    rules: { type: [fieldRuleSchema], default: [] },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

ConnectorFieldMappingSchema.index(
  { organizationId: 1, connectorKey: 1, entityType: 1, companyGuid: 1, version: 1 },
  { unique: true }
);

module.exports = wrapTenantModel(mongoose.model('ConnectorFieldMapping', ConnectorFieldMappingSchema));
