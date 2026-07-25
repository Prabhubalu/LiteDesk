'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const { Schema } = mongoose;

const ConnectorSyncJobSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    connectorKey: { type: String, required: true, trim: true, lowercase: true, index: true },
    companyGuid: { type: String, trim: true, default: null, index: true },
    jobType: { type: String, required: true, trim: true, index: true },
    direction: {
      type: String,
      enum: ['inbound', 'outbound', 'bidirectional'],
      required: true,
    },
    status: {
      type: String,
      enum: ['queued', 'running', 'succeeded', 'failed', 'cancelled'],
      default: 'queued',
      index: true,
    },
    priority: { type: Number, default: 0 },
    payload: { type: Schema.Types.Mixed, default: {} },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 3 },
    scheduledAt: { type: Date, default: Date.now, index: true },
    startedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
    lastError: { type: String, default: null },
    bullJobId: { type: String, trim: true, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

ConnectorSyncJobSchema.index({ organizationId: 1, connectorKey: 1, status: 1, createdAt: -1 });
ConnectorSyncJobSchema.index({ organizationId: 1, companyGuid: 1, status: 1 });

module.exports = wrapTenantModel(mongoose.model('ConnectorSyncJob', ConnectorSyncJobSchema));
