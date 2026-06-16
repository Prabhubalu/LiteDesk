const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const {
  ASSIGNMENT_TRIGGER_TYPES,
  ASSIGNMENT_DISTRIBUTION_MODES,
  ASSIGNMENT_REVERT_MODES,
  ASSIGNMENT_ESCALATION_ACTIONS
} = require('../constants/assignmentRules');

const { Schema } = mongoose;

const ConditionClauseSchema = new Schema(
  {
    field: { type: String, required: true, trim: true },
    operator: { type: String, required: true, trim: true },
    value: { type: Schema.Types.Mixed, default: null }
  },
  { _id: false }
);

const ConditionGroupSchema = new Schema(
  {
    combinator: {
      type: String,
      enum: ['all', 'any'],
      default: 'all'
    },
    clauses: {
      type: [ConditionClauseSchema],
      default: []
    }
  },
  { _id: false }
);

const DistributionSchema = new Schema(
  {
    mode: {
      type: String,
      enum: ASSIGNMENT_DISTRIBUTION_MODES,
      default: 'queue'
    },
    queueClaimTimeoutMinutes: { type: Number, default: null },
    userWeights: {
      type: [
        {
          userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
          weight: { type: Number, required: true, min: 1 }
        }
      ],
      default: []
    }
  },
  { _id: false }
);

const EscalationSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
    actionType: {
      type: String,
      enum: ASSIGNMENT_ESCALATION_ACTIONS,
      default: 'reassign_group'
    },
    thresholdPercent: { type: Number, default: 100, min: 1, max: 100 },
    cooldownMinutes: { type: Number, default: 30, min: 0 },
    chainGroupIds: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Group' }],
      default: []
    }
  },
  { _id: false }
);

const ReassignmentSchema = new Schema(
  {
    enabled: { type: Boolean, default: true },
    revertMode: {
      type: String,
      enum: ASSIGNMENT_REVERT_MODES,
      default: 'reapply_rules'
    },
    lockOnManualOverride: { type: Boolean, default: false }
  },
  { _id: false }
);

const TriggerConfigSchema = new Schema(
  {
    /** null for immediate; >= 1 for delayed (validated in controller). */
    delayMinutes: { type: Number, default: null, required: false },
    scheduleType: { type: String, enum: ['one_time', 'recurring'], required: false },
    frequency: { type: String, enum: ['daily', 'weekly', 'custom'], required: false },
    cron: { type: String, required: false },
    runAt: { type: Date, required: false },
    everyMinutes: { type: Number, default: null, min: 1 },
    scheduleTime: { type: String, required: false },
    scheduleDayOfWeek: { type: Number, required: false, min: 0, max: 6 },
    evaluateScope: { type: Schema.Types.Mixed, default: null },
    recheckConditionsAtExecution: { type: Boolean, default: true }
  },
  { _id: false }
);

const AssignmentRuleSchema = new Schema(
  {
    ruleId: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    enabled: { type: Boolean, default: true },
    order: { type: Number, default: 0, min: 0 },
    triggerType: {
      type: String,
      enum: ASSIGNMENT_TRIGGER_TYPES,
      default: 'immediate'
    },
    triggerConfig: { type: TriggerConfigSchema, default: () => ({}) },
    conditions: { type: ConditionGroupSchema, default: () => ({}) },
    primaryGroupId: { type: Schema.Types.ObjectId, ref: 'Group', required: false },
    distribution: { type: DistributionSchema, default: () => ({}) },
    fallbackGroupIds: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Group' }],
      default: []
    },
    escalation: { type: EscalationSchema, default: () => ({}) },
    reassignment: { type: ReassignmentSchema, default: () => ({}) },
    metadata: { type: Schema.Types.Mixed, default: {} }
  },
  { _id: false }
);

const AssignmentRuleSetSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    appKey: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true
    },
    moduleKey: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true
    },
    enabled: { type: Boolean, default: true },
    version: { type: Number, default: 1, min: 1 },
    applyStrategy: {
      type: String,
      enum: ['new_records_only', 'manual_re_evaluation', 'freeze_mode'],
      default: 'new_records_only'
    },
    rules: {
      type: [AssignmentRuleSchema],
      default: []
    },
    simulationOnly: { type: Boolean, default: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

AssignmentRuleSetSchema.index(
  { organizationId: 1, appKey: 1, moduleKey: 1 },
  { unique: true }
);

module.exports = wrapTenantModel(mongoose.model('AssignmentRuleSet', AssignmentRuleSetSchema));
