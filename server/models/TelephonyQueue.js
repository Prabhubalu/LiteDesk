'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const STRATEGIES = ['round_robin', 'longest_idle', 'least_calls', 'skill_based', 'priority'];

const TelephonyQueueSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    name: { type: String, trim: true, required: true },
    strategy: { type: String, enum: STRATEGIES, default: 'round_robin', index: true },
    overflowQueueId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TelephonyQueue',
      default: null,
    },
    businessHours: { type: mongoose.Schema.Types.Mixed, default: null },
    skills: [{ type: String, trim: true }],
    priority: { type: Number, default: 0, index: true },
    isDefault: { type: Boolean, default: false, index: true },
    enabled: { type: Boolean, default: true, index: true },
    lastAssignedAt: { type: Date, default: null },
    lastAssignedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
    collection: 'telephony_queues',
  }
);

TelephonyQueueSchema.index({ organizationId: 1, name: 1 });
TelephonyQueueSchema.index({ organizationId: 1, isDefault: 1 });

module.exports = wrapTenantModel(mongoose.model('TelephonyQueue', TelephonyQueueSchema));
module.exports.STRATEGIES = STRATEGIES;
