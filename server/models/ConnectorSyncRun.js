'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const { Schema } = mongoose;

const ConnectorSyncRunSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    jobId: {
      type: Schema.Types.ObjectId,
      ref: 'ConnectorSyncJob',
      required: true,
      index: true,
    },
    connectorKey: { type: String, required: true, trim: true, lowercase: true, index: true },
    companyGuid: { type: String, trim: true, default: null },
    status: {
      type: String,
      enum: ['running', 'succeeded', 'failed', 'partial'],
      default: 'running',
      index: true,
    },
    startedAt: { type: Date, default: Date.now },
    finishedAt: { type: Date, default: null },
    stats: { type: Schema.Types.Mixed, default: {} },
    error: { type: String, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

ConnectorSyncRunSchema.index({ organizationId: 1, jobId: 1, createdAt: -1 });

module.exports = wrapTenantModel(mongoose.model('ConnectorSyncRun', ConnectorSyncRunSchema));
