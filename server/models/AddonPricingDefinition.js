/**
 * Master-configurable addon pricing (platform DB).
 * Arivu Master updates plans, trial days, and per-agent rates here.
 */

const mongoose = require('mongoose');

const AddonPlanSchema = new mongoose.Schema({
  agentLimit: { type: Number, default: null },
  pricePerAgentCents: { type: Number, default: null },
  flatPriceCents: { type: Number, default: null },
  currency: { type: String, trim: true, default: 'USD' },
}, { _id: false });

const AddonPricingDefinitionSchema = new mongoose.Schema({
  addonKey: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    unique: true,
  },
  billingType: {
    type: String,
    enum: ['PER_AGENT', 'FLAT', 'PER_ORG', 'USAGE'],
    default: 'PER_AGENT',
  },
  defaultPlan: {
    type: String,
    enum: ['BASIC', 'PRO', 'ENTERPRISE'],
    default: 'BASIC',
  },
  trialDays: {
    type: Number,
    default: 14,
    min: 0,
  },
  plans: {
    BASIC: { type: AddonPlanSchema, default: () => ({}) },
    PRO: { type: AddonPlanSchema, default: () => ({}) },
    ENTERPRISE: { type: AddonPlanSchema, default: () => ({}) },
  },
  enabled: {
    type: Boolean,
    default: true,
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('AddonPricingDefinition', AddonPricingDefinitionSchema);
