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
    /** ATIP Audit Engine extensions */
    correlationId: { type: String, trim: true, default: null, index: true },
    moduleKey: { type: String, trim: true, default: null, index: true },
    recordId: { type: String, trim: true, default: null },
    operation: { type: String, trim: true, default: null },
    beforeValue: { type: Schema.Types.Mixed, default: null },
    afterValue: { type: Schema.Types.Mixed, default: null },
    source: { type: String, trim: true, default: null },
    destination: { type: String, trim: true, default: null },
    durationMs: { type: Number, default: null },
    worker: { type: String, trim: true, default: null },
    problemCode: { type: String, trim: true, default: null },
    causeCode: { type: String, trim: true, default: null },
    resolutionCode: { type: String, trim: true, default: null },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

ConnectorSyncEventSchema.index({ organizationId: 1, connectorKey: 1, createdAt: -1 });

module.exports = wrapTenantModel(mongoose.model('ConnectorSyncEvent', ConnectorSyncEventSchema));
