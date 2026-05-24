'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const TargetAssignmentSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Target',
    required: true,
    index: true
  },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', default: null },
  weight: { type: Number, default: 1, min: 0 },
  capacity: { type: Number, default: null },
  allocatedValue: { type: Number, default: 0 },
  achievedValue: { type: Number, default: 0 },
  forecastValue: { type: Number, default: 0 }
}, { timestamps: true });

TargetAssignmentSchema.index({ targetId: 1, userId: 1 });

module.exports = wrapTenantModel(mongoose.model('TargetAssignment', TargetAssignmentSchema));
