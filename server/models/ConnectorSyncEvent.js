'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const { Schema } = mongoose;

const ConnectorSyncEventSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    runId: {
      type: Schema.Types.ObjectId,
      ref: 'ConnectorSyncRun',
      default: null,
      index: true,
    },
    jobId: {
      type: Schema.Types.ObjectId,
      ref: 'ConnectorSyncJob',
      default: null,
      index: true,
    },
    connectorKey: { type: String, required: true, trim: true, lowercase: true, index: true },
    level: {
      type: String,
      enum: ['debug', 'info', 'warn', 'error'],
      default: 'info',
      index: true,
    },
    code: { type: String, trim: true, default: null },
    message: { type: String, required: true, trim: true },
    payload: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

ConnectorSyncEventSchema.index({ organizationId: 1, connectorKey: 1, createdAt: -1 });

module.exports = wrapTenantModel(mongoose.model('ConnectorSyncEvent', ConnectorSyncEventSchema));
