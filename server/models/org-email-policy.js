'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const OrgEmailPolicySchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      unique: true,
      index: true
    },
    status: { type: String, enum: ['active', 'suspended'], default: 'active' },

    monthlyCredits: { type: Number, default: 0, min: 0 },
    creditsRemaining: { type: Number, default: 0, min: 0 },

    dailySendLimit: { type: Number, default: 0, min: 0 },
    maxHourlyRate: { type: Number, default: 0, min: 0 },
    burstRatePerMin: { type: Number, default: 0, min: 0 },
    maxCampaignSize: { type: Number, default: 0, min: 0 },

    warmupEnabled: { type: Boolean, default: true },
    reputationEnabled: { type: Boolean, default: true },

    amdsSyncedAt: { type: Date, default: null },
    amdsSyncError: { type: String, default: null },

    creditsReserved: { type: Number, default: 0, min: 0 },

    senderReputation: { type: Number, default: null, min: 0, max: 100 },
    reputationPreviousScore: { type: Number, default: null },
    reputationDelta: { type: Number, default: null },
    reputationFactors: { type: [mongoose.Schema.Types.Mixed], default: [] },
    reputationUpdatedAt: { type: Date, default: null },
    reputationRecoveryDayStartScore: { type: Number, default: null, min: 0, max: 100 },
    reputationRemainingGainToday: { type: Number, default: null, min: 0 },

    reputationGuidanceReasons: { type: [mongoose.Schema.Types.Mixed], default: [] },
    reputationGuidanceRecommendations: { type: [mongoose.Schema.Types.Mixed], default: [] },
    reputationGuidanceUpdatedAt: { type: Date, default: null },

    effectiveHourlyRate: { type: Number, default: null, min: 0 },
    effectiveBurstRate: { type: Number, default: null, min: 0 },
    warmupStage: { type: String, default: null, trim: true },
    infraMultiplier: { type: Number, default: null, min: 0, max: 1 },
    throughputUpdatedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

const OrgEmailPolicy = mongoose.model('OrgEmailPolicy', OrgEmailPolicySchema);

module.exports = wrapTenantModel(OrgEmailPolicy);
