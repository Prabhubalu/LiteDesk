'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const {
  TARGET_LIFECYCLE,
  TARGET_STATUS,
  DISTRIBUTION_TYPES,
  METRIC_KINDS
} = require('../constants/targetConstants');

const SourceModuleSchema = new mongoose.Schema({
  appKey: { type: String, required: true, trim: true, uppercase: true },
  moduleKey: { type: String, required: true, trim: true, lowercase: true }
}, { _id: false });

const ContributionRuleSchema = new mongoose.Schema({
  id: { type: String, required: true },
  appKey: { type: String, required: true, trim: true, uppercase: true },
  moduleKey: { type: String, required: true, trim: true, lowercase: true },
  metricField: { type: String, default: null },
  metricKind: { type: String, enum: METRIC_KINDS, default: 'count' },
  filters: { type: [mongoose.Schema.Types.Mixed], default: [] },
  attribution: {
    type: { type: String, enum: ['owner', 'team', 'field'], default: 'owner' },
    field: { type: String, default: null }
  },
  weight: { type: Number, default: 1 },
  enabled: { type: Boolean, default: true }
}, { _id: false });

const ThresholdSchema = new mongoose.Schema({
  percent: { type: Number, required: true },
  label: { type: String, default: '' },
  notify: { type: Boolean, default: true },
  processId: { type: mongoose.Schema.Types.ObjectId, ref: 'Process', default: null }
}, { _id: false });

const ForecastRuleSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: false },
  includePipeline: { type: Boolean, default: true },
  historicalWeight: { type: Number, default: 1, min: 0, max: 1 }
}, { _id: false });

const TargetSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  targetTypeKey: { type: String, required: true, trim: true, lowercase: true },
  metricKind: { type: String, enum: METRIC_KINDS, default: 'count' },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', default: null },
  sourceModules: { type: [SourceModuleSchema], default: [] },
  contributionRules: { type: [ContributionRuleSchema], default: [] },
  targetValue: { type: Number, required: true, min: 0 },
  achievedValue: { type: Number, default: 0 },
  forecastValue: { type: Number, default: 0 },
  achievementProbability: { type: Number, default: null },
  riskLevel: { type: String, enum: ['low', 'medium', 'high', null], default: null },
  status: { type: String, enum: TARGET_STATUS, default: 'not_started' },
  lifecycleStatus: {
    type: String,
    enum: TARGET_LIFECYCLE,
    default: 'draft',
    index: true
  },
  distributionType: { type: String, enum: DISTRIBUTION_TYPES, default: 'equal' },
  periodStart: { type: Date, required: true },
  periodEnd: { type: Date, required: true },
  thresholds: { type: [ThresholdSchema], default: [] },
  forecastRules: { type: ForecastRuleSchema, default: () => ({}) },
  currentVersionNumber: { type: Number, default: 0 },
  activatedAt: { type: Date, default: null },
  lockedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  closedAt: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  dependencyWarnings: { type: [String], default: [] },
  lastRecalculatedAt: { type: Date, default: null }
}, { timestamps: true });

TargetSchema.index({ organizationId: 1, lifecycleStatus: 1, periodEnd: 1 });
TargetSchema.index({ organizationId: 1, ownerId: 1, lifecycleStatus: 1 });

module.exports = wrapTenantModel(mongoose.model('Target', TargetSchema));
