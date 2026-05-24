'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const TargetContributionLedgerSchema = new mongoose.Schema({
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
  assignmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TargetAssignment',
    default: null
  },
  ruleId: { type: String, required: true },
  idempotencyKey: { type: String, required: true },
  direction: { type: String, enum: ['credit', 'debit'], required: true },
  amount: { type: Number, required: true },
  sourceAppKey: { type: String, required: true, uppercase: true },
  sourceModuleKey: { type: String, required: true, lowercase: true },
  sourceRecordId: { type: String, required: true },
  sourceEventType: { type: String, default: null },
  attributedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  occurredAt: { type: Date, required: true, default: Date.now },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

TargetContributionLedgerSchema.index({ targetId: 1, idempotencyKey: 1 }, { unique: true });
TargetContributionLedgerSchema.index({ targetId: 1, occurredAt: -1 });

module.exports = wrapTenantModel(mongoose.model('TargetContributionLedger', TargetContributionLedgerSchema));
