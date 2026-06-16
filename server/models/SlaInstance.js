'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const { SLA_INSTANCE_STATUSES } = require('../constants/slaPolicy');

const { Schema } = mongoose;

const PauseSegmentSchema = new Schema(
  {
    from: { type: Date, required: true },
    to: { type: Date, required: true }
  },
  { _id: false }
);

const SlaInstanceSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    policyId: { type: Schema.Types.ObjectId, ref: 'SlaPolicy', required: true },
    policyKey: { type: String, required: true, trim: true },
    policySnapshot: { type: Schema.Types.Mixed, default: {} },
    moduleKey: { type: String, required: true, lowercase: true, trim: true },
    recordId: { type: Schema.Types.ObjectId, required: true, index: true },
    milestoneKey: { type: String, required: true, trim: true },
    cycleNo: { type: Number, default: 1, min: 1 },
    status: {
      type: String,
      enum: SLA_INSTANCE_STATUSES,
      default: 'pending',
      index: true
    },
    startedAt: { type: Date, default: null },
    targetAt: { type: Date, default: null, index: true },
    metAt: { type: Date, default: null },
    breachedAt: { type: Date, default: null },
    pausedAt: { type: Date, default: null },
    pauseSegments: { type: [PauseSegmentSchema], default: [] },
    stoppedAt: { type: Date, default: null },
    elapsedMinutes: { type: Number, default: null },
    alertsSent: { type: Schema.Types.Mixed, default: {} },
    escalationState: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

SlaInstanceSchema.index({ organizationId: 1, moduleKey: 1, recordId: 1, status: 1 });
SlaInstanceSchema.index({ organizationId: 1, status: 1, targetAt: 1 });

module.exports = wrapTenantModel(mongoose.model('SlaInstance', SlaInstanceSchema));
