'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const { Schema } = mongoose;

const sideCountsSchema = new Schema(
  {
    created: { type: Number, default: 0 },
    updated: { type: Number, default: 0 },
    skipped: { type: Number, default: 0 },
  },
  { _id: false }
);

const recordRefSchema = new Schema(
  {
    side: { type: String, enum: ['arivu', 'tally'], required: true },
    action: { type: String, enum: ['created', 'updated', 'skipped'], required: true },
    moduleKey: { type: String, trim: true, default: null },
    tallyModuleKey: { type: String, trim: true, default: null },
    recordId: { type: String, trim: true, default: null },
    recordName: { type: String, trim: true, default: null },
    externalId: { type: String, trim: true, default: null },
    reason: { type: String, trim: true, default: null },
    routeHint: { type: String, trim: true, default: null },
  },
  { _id: true }
);

const TallySyncRunLogSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    companyGuid: { type: String, trim: true, default: null, index: true },
    companyName: { type: String, trim: true, default: null },
    moduleKey: { type: String, trim: true, default: null, index: true },
    tallyModuleKey: { type: String, trim: true, default: null, index: true },
    tallyModuleName: { type: String, trim: true, default: null },
    arivuModuleName: { type: String, trim: true, default: null },
    startedAt: { type: Date, default: Date.now, index: true },
    finishedAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ['running', 'completed', 'failed', 'partial'],
      default: 'running',
      index: true,
    },
    arivu: { type: sideCountsSchema, default: () => ({}) },
    tally: { type: sideCountsSchema, default: () => ({}) },
    records: { type: [recordRefSchema], default: [] },
    jobId: { type: Schema.Types.ObjectId, default: null },
    error: { type: String, trim: true, default: null },
    correlationId: { type: String, trim: true, default: null, index: true },
    durationMs: { type: Number, default: null },
    worker: { type: String, trim: true, default: null },
    problemCode: { type: String, trim: true, default: null },
    causeCode: { type: String, trim: true, default: null },
    resolutionCode: { type: String, trim: true, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

TallySyncRunLogSchema.index({ organizationId: 1, startedAt: -1 });
TallySyncRunLogSchema.index({ organizationId: 1, companyGuid: 1, startedAt: -1 });

module.exports = wrapTenantModel(mongoose.model('TallySyncRunLog', TallySyncRunLogSchema));
