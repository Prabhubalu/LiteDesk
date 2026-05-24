'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const TargetPlatformSettingsSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    unique: true
  },
  maxTargetsPerUser: { type: Number, default: 50 },
  maxTeamSize: { type: Number, default: 100 },
  recalcRateLimitPerMinute: { type: Number, default: 120 },
  batchRecalcEnabled: { type: Boolean, default: true },
  incentivesEnabled: { type: Boolean, default: false },
  gamificationEnabled: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = wrapTenantModel(mongoose.model('TargetPlatformSettings', TargetPlatformSettingsSchema));
