'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const TargetVersionSnapshotSchema = new mongoose.Schema({
  name: String,
  targetTypeKey: String,
  metricKind: String,
  sourceModules: mongoose.Schema.Types.Mixed,
  contributionRules: mongoose.Schema.Types.Mixed,
  targetValue: Number,
  distributionType: String,
  periodStart: Date,
  periodEnd: Date,
  thresholds: mongoose.Schema.Types.Mixed,
  forecastRules: mongoose.Schema.Types.Mixed,
  assignments: mongoose.Schema.Types.Mixed
}, { _id: false });

const TargetVersionSchema = new mongoose.Schema({
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Target',
    required: true,
    index: true
  },
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  versionNumber: { type: Number, required: true, min: 1 },
  reason: {
    type: String,
    enum: ['activate', 'distribution_change', 'period_change', 'manual'],
    default: 'activate'
  },
  snapshot: { type: TargetVersionSnapshotSchema, required: true },
  publishedAt: { type: Date, required: true, default: Date.now },
  publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

TargetVersionSchema.index({ targetId: 1, versionNumber: 1 }, { unique: true });

module.exports = wrapTenantModel(mongoose.model('TargetVersion', TargetVersionSchema));
