'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const { Schema } = mongoose;

const ConnectorOutboxSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    connectorKey: { type: String, required: true, trim: true, lowercase: true, index: true },
    entityType: { type: String, required: true, trim: true, index: true },
    arivuId: { type: String, required: true, trim: true, index: true },
    companyGuid: { type: String, trim: true, default: null, index: true },
    operation: {
      type: String,
      enum: ['create', 'update', 'delete', 'upsert'],
      required: true,
    },
    payload: { type: Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: ['pending', 'processing', 'processed', 'failed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    idempotencyKey: { type: String, trim: true, default: null },
    attempts: { type: Number, default: 0 },
    lastError: { type: String, default: null },
    processedAt: { type: Date, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

ConnectorOutboxSchema.index({ organizationId: 1, connectorKey: 1, status: 1, createdAt: 1 });
ConnectorOutboxSchema.index(
  { organizationId: 1, connectorKey: 1, idempotencyKey: 1 },
  { unique: true, sparse: true }
);

module.exports = wrapTenantModel(mongoose.model('ConnectorOutbox', ConnectorOutboxSchema));
