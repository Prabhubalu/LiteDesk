'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const { SLA_EXECUTION_EVENT_TYPES } = require('../constants/slaPolicy');

const { Schema } = mongoose;

const SlaExecutionLogSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    instanceId: { type: Schema.Types.ObjectId, ref: 'SlaInstance', default: null },
    policyKey: { type: String, default: null, trim: true },
    moduleKey: { type: String, required: true, lowercase: true, trim: true },
    recordId: { type: Schema.Types.ObjectId, required: true, index: true },
    eventType: {
      type: String,
      enum: SLA_EXECUTION_EVENT_TYPES,
      required: true
    },
    payload: { type: Schema.Types.Mixed, default: {} },
    occurredAt: { type: Date, default: Date.now, index: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

SlaExecutionLogSchema.index({ organizationId: 1, moduleKey: 1, occurredAt: -1 });

module.exports = wrapTenantModel(mongoose.model('SlaExecutionLog', SlaExecutionLogSchema));
