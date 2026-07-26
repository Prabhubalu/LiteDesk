'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const { Schema } = mongoose;

const ConnectorExternalObjectSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    connectorKey: { type: String, required: true, trim: true, lowercase: true, index: true },
    entityType: { type: String, required: true, trim: true, index: true },
    externalId: { type: String, required: true, trim: true },
    arivuId: { type: String, required: true, trim: true, index: true },
    arivuModule: { type: String, trim: true, default: null },
    companyGuid: { type: String, trim: true, default: null, index: true },
    lastSyncedAt: { type: Date, default: null },
    lastDirection: {
      type: String,
      enum: ['inbound', 'outbound', 'bidirectional'],
      default: null,
    },
    payloadHash: { type: String, trim: true, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

ConnectorExternalObjectSchema.index(
  { organizationId: 1, connectorKey: 1, entityType: 1, companyGuid: 1, externalId: 1 },
  { unique: true }
);
ConnectorExternalObjectSchema.index(
  { organizationId: 1, connectorKey: 1, entityType: 1, companyGuid: 1, arivuId: 1 },
  { unique: true }
);

module.exports = wrapTenantModel(
  mongoose.model('ConnectorExternalObject', ConnectorExternalObjectSchema)
);
