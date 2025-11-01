const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const OrganizationV2Schema = new Schema({
  // Core
  name: { type: String, required: true, trim: true },
  legacyOrganizationId: { type: Schema.Types.ObjectId, index: true },
  types: {
    type: [String],
    required: true,
    enum: ['Customer', 'Partner', 'Vendor', 'Distributor', 'Dealer'],
    default: []
  },
  website: { type: String, trim: true },
  phone: { type: String, trim: true },
  address: { type: String, trim: true },
  industry: { type: String, trim: true },

  // Ownership/links
  assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
  primaryContact: { type: Schema.Types.ObjectId, ref: 'People' },

  // Customer-specific
  customerStatus: {
    type: String,
    enum: ['Active', 'Prospect', 'Churned', 'Lead Customer']
  },
  customerTier: {
    type: String,
    enum: ['Gold', 'Silver', 'Bronze']
  },
  slaLevel: { type: String, trim: true },
  paymentTerms: { type: String, trim: true },
  creditLimit: { type: Number, min: 0 },
  accountManager: { type: Schema.Types.ObjectId, ref: 'User' },
  annualRevenue: { type: Number, min: 0 },
  numberOfEmployees: { type: Number, min: 0 },

  // Partner-specific
  partnerStatus: {
    type: String,
    enum: ['Active', 'Onboarding', 'Inactive']
  },
  partnerTier: {
    type: String,
    enum: ['Platinum', 'Gold', 'Silver', 'Bronze']
  },
  partnerType: {
    type: String,
    enum: ['Reseller', 'System Integrator', 'Referral', 'Technology Partner']
  },
  partnerSince: { type: Date },
  partnerOnboardingSteps: Schema.Types.Mixed,
  territory: [{ type: String, trim: true }],
  discountRate: { type: Number, min: 0, max: 100 },

  // Vendor-specific
  vendorStatus: {
    type: String,
    enum: ['Approved', 'Pending', 'Suspended']
  },
  vendorRating: { type: Number, min: 0 },
  vendorContract: { type: Schema.Types.ObjectId, ref: 'Contract' },
  preferredPaymentMethod: { type: String, trim: true },
  taxId: { type: String, trim: true },

  // Distributor/Dealer-specific
  channelRegion: { type: String, trim: true },
  distributionTerritory: [{ type: String, trim: true }],
  distributionCapacityMonthly: { type: Number, min: 0 },
  dealerLevel: {
    type: String,
    enum: ['Authorized', 'Franchise', 'Retailer']
  },
  terms: { type: String, trim: true },
  shippingAddress: { type: String, trim: true },
  logisticsPartner: { type: Schema.Types.ObjectId, ref: 'Organization' }
}, {
  timestamps: true
});

OrganizationV2Schema.index({ name: 1 });
OrganizationV2Schema.index({ types: 1 });
OrganizationV2Schema.index({ industry: 1 });
OrganizationV2Schema.index({ customerStatus: 1 });
OrganizationV2Schema.index({ partnerStatus: 1 });
OrganizationV2Schema.index({ vendorStatus: 1 });
OrganizationV2Schema.index({ legacyOrganizationId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('OrganizationV2', OrganizationV2Schema);


