'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const {
  SLA_TRIGGER_TYPES,
  SLA_EXECUTION_MODES
} = require('../constants/slaPolicy');

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
    combinator: { type: String, enum: ['all', 'any'], default: 'all' },
    clauses: { type: [ConditionClauseSchema], default: [] },
    groups: { type: [], default: [] }
  },
  { _id: false }
);
ConditionGroupSchema.add({ groups: [ConditionGroupSchema] });

const SlaTargetSchema = new Schema(
  {
    milestoneKey: { type: String, required: true, trim: true },
    priorityKey: { type: String, default: null, trim: true },
    durationMinutes: { type: Number, required: true, min: 1 },
    calendarOverride: { type: String, default: null }
  },
  { _id: false }
);

const SlaNotificationSchema = new Schema(
  {
    milestoneKey: { type: String, default: null },
    timing: { type: String, enum: ['before', 'at', 'after'], default: 'before' },
    offsetMinutes: { type: Number, default: 30, min: 0 },
    recipients: { type: [String], default: [] },
    channels: { type: [String], default: ['inApp'] },
    priorityKeys: { type: [String], default: [] }
  },
  { _id: false }
);

const SlaEscalationStepSchema = new Schema(
  {
    role: { type: String, default: null },
    actionType: { type: String, default: 'notify_hierarchy' },
    delayMinutes: { type: Number, default: 0, min: 0 },
    config: { type: Schema.Types.Mixed, default: {} }
  },
  { _id: false }
);

const SlaPolicySchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    policyKey: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    active: { type: Boolean, default: true },
    precedence: { type: Number, default: 0 },
    isDefault: { type: Boolean, default: false },
    executionMode: {
      type: String,
      enum: SLA_EXECUTION_MODES,
      default: 'first_match'
    },
    scope: {
      appKey: { type: String, uppercase: true, trim: true, default: null },
      moduleKey: { type: String, lowercase: true, trim: true, required: true },
      recordType: { type: String, default: null, trim: true }
    },
    entryCriteria: { type: ConditionGroupSchema, default: () => ({}) },
    trigger: {
      type: {
        type: String,
        enum: SLA_TRIGGER_TYPES,
        default: 'record_created'
      },
      field: { type: String, default: null },
      eventName: { type: String, default: null },
      fromValue: { type: Schema.Types.Mixed, default: null },
      toValue: { type: Schema.Types.Mixed, default: null },
      dateField: { type: String, default: null },
      config: { type: Schema.Types.Mixed, default: {} }
    },
    targets: { type: [SlaTargetSchema], default: [] },
    pauseConditions: { type: [ConditionGroupSchema], default: [] },
    resumeConditions: { type: [ConditionGroupSchema], default: [] },
    successCriteria: { type: ConditionGroupSchema, default: () => ({}) },
    breachConditions: { type: ConditionGroupSchema, default: () => ({}) },
    notifications: { type: [SlaNotificationSchema], default: [] },
    escalations: {
      enabled: { type: Boolean, default: false },
      cooldownMinutes: { type: Number, default: 15, min: 0 },
      steps: { type: [SlaEscalationStepSchema], default: [] }
    },
    calendar: {
      mode: { type: String, enum: ['business', 'calendar24x7'], default: 'business' },
      businessHourSetId: { type: String, default: null },
      holidayCalendarId: { type: String, default: null },
      inlineBusinessHours: { type: Schema.Types.Mixed, default: null },
      priorityOverrides: { type: Schema.Types.Mixed, default: {} }
    },
    advanced: { type: Schema.Types.Mixed, default: {} },
    version: { type: Number, default: 1 },
    deletedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

SlaPolicySchema.index(
  { organizationId: 1, policyKey: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } }
);
SlaPolicySchema.index({ organizationId: 1, 'scope.moduleKey': 1, active: 1, precedence: -1 });

module.exports = wrapTenantModel(mongoose.model('SlaPolicy', SlaPolicySchema));
