const mongoose = require('mongoose');

const OrganizationSchema = new mongoose.Schema({
    // ===== TENANT/SUBSCRIPTION FIELDS =====
    // Basic Information
    name: { 
        type: String, 
        required: true,
        trim: true
    },
    slug: { 
        type: String, 
        unique: true,
        sparse: true, // Allow null/undefined for CRM organizations
        lowercase: true
    },
    industry: { 
        type: String,
        trim: true
    },
    
    // Subscription Management (only for tenant organizations)
    subscription: {
        status: { 
            type: String, 
            enum: ['trial', 'active', 'expired', 'cancelled'],
            default: 'trial'
        },
        tier: { 
            type: String, 
            enum: ['trial', 'paid'],
            default: 'trial'
        },
        trialStartDate: { 
            type: Date, 
            default: Date.now 
        },
        trialEndDate: { 
            type: Date,
            default: function() {
                const date = new Date();
                date.setDate(date.getDate() + 15);
                return date;
            }
        },
        currentPeriodStart: Date,
        currentPeriodEnd: Date,
        autoRenew: { 
            type: Boolean, 
            default: true 
        },
        stripeCustomerId: String,
        stripeSubscriptionId: String
    },
    
    // Limits & Features based on subscription tier (only for tenant organizations)
    limits: {
        maxUsers: { 
            type: Number, 
            default: 3
        },
        maxContacts: { 
            type: Number, 
            default: 100 
        },
        maxDeals: { 
            type: Number, 
            default: 50 
        },
        maxStorageGB: { 
            type: Number, 
            default: 1 
        }
    },
    
    // Enabled Modules (only for tenant organizations)
    enabledModules: {
        type: [String],
        default: ['contacts', 'deals', 'tasks', 'events']
    },
    
    // Organization Settings (only for tenant organizations)
    settings: {
        dateFormat: { 
            type: String, 
            default: 'MM/DD/YYYY' 
        },
        timeZone: { 
            type: String, 
            default: 'UTC' 
        },
        currency: { 
            type: String, 
            default: 'USD' 
        },
        logoUrl: String,
        primaryColor: { 
            type: String, 
            default: '#7f56d9' 
        }
    },
    
    // Status
    isActive: { 
        type: Boolean, 
        default: true 
    },
    
    // Database Configuration (for dedicated database per organization)
    database: {
        name: {
            type: String,
            // Format: litedesk_{slug} or litedesk_{organizationId}
        },
        connectionString: {
            type: String,
            // Full MongoDB connection string to organization's database
        },
        createdAt: Date,
        initialized: {
            type: Boolean,
            default: false
        }
    },
    
    // ===== CRM FIELDS (from OrganizationV2) =====
    // CRM Core
    types: {
        type: [String],
        enum: ['Customer', 'Partner', 'Vendor', 'Distributor', 'Dealer'],
        default: []
    },
    website: { type: String, trim: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    
    // Ownership/links (CRM)
    createdBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        index: true 
    },
    assignedTo: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    },
    primaryContact: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'People' 
    },
    
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
    accountManager: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    },
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
    partnerOnboardingSteps: mongoose.Schema.Types.Mixed,
    territory: [{ type: String, trim: true }],
    discountRate: { type: Number, min: 0, max: 100 },
    
    // Vendor-specific
    vendorStatus: {
        type: String,
        enum: ['Approved', 'Pending', 'Suspended']
    },
    vendorRating: { type: Number, min: 0 },
    vendorContract: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Contract' 
    },
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
    logisticsPartner: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Organization' 
    },
    
    // Activity Logs (CRM)
    activityLogs: [{
        user: { type: String, required: true },
        userId: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'User' 
        },
        action: { type: String, required: true },
        details: { type: mongoose.Schema.Types.Mixed },
        timestamp: { 
            type: Date, 
            default: Date.now, 
            required: true 
        }
    }],
    
    // Legacy support (for migration)
    legacyOrganizationId: { 
        type: mongoose.Schema.Types.ObjectId
    },
    
    // Distinguish tenant vs CRM organization
    isTenant: {
        type: Boolean,
        default: false // CRM organizations by default
    }
}, { 
    timestamps: true 
});

// Indexes
OrganizationSchema.index({ name: 1 });
OrganizationSchema.index({ types: 1 });
OrganizationSchema.index({ industry: 1 });
OrganizationSchema.index({ customerStatus: 1 });
OrganizationSchema.index({ partnerStatus: 1 });
OrganizationSchema.index({ vendorStatus: 1 });
OrganizationSchema.index({ isTenant: 1 });
OrganizationSchema.index({ legacyOrganizationId: 1 }, { unique: true, sparse: true });

// Prevent createdBy from being modified after creation (for CRM organizations)
OrganizationSchema.pre('findOneAndUpdate', function() {
    const update = this.getUpdate();
    if (update && update.createdBy !== undefined) {
        delete update.createdBy;
    }
    if (update && update.$set && update.$set.createdBy !== undefined) {
        delete update.$set.createdBy;
    }
});

OrganizationSchema.pre('save', async function(next) {
    // Prevent createdBy modification for CRM organizations
    if (!this.isTenant && !this.isNew && this.isModified('createdBy')) {
        try {
            const original = await this.constructor.findById(this._id).select('createdBy').lean();
            if (original && original.createdBy) {
                this.createdBy = original.createdBy;
                this.unmarkModified('createdBy');
            }
            next();
        } catch (error) {
            next(new Error('createdBy field cannot be modified after creation'));
        }
    } else {
        next();
    }
});

// Helper method to check if trial is expired (tenant only)
OrganizationSchema.methods.isTrialExpired = function() {
    if (!this.isTenant || this.subscription.status !== 'trial') {
        return false;
    }
    return new Date() > this.subscription.trialEndDate;
};

// Helper method to get days remaining in trial (tenant only)
OrganizationSchema.methods.getTrialDaysRemaining = function() {
    if (!this.isTenant || this.subscription.status !== 'trial') {
        return 0;
    }
    const now = new Date();
    const diff = this.subscription.trialEndDate - now;
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};

// Helper method to check if a feature is enabled (tenant only)
OrganizationSchema.methods.hasFeature = function(featureName) {
    if (!this.isTenant) return false;
    return this.enabledModules.includes(featureName);
};

// Helper method to update limits based on tier (tenant only)
OrganizationSchema.methods.updateLimitsForTier = function(tier) {
    if (!this.isTenant) return this;
    
    const tierLimits = {
        trial: {
            maxUsers: -1, // Unlimited - let users explore the product
            maxContacts: -1, // Unlimited
            maxDeals: -1, // Unlimited
            maxStorageGB: -1 // Unlimited
        },
        paid: {
            maxUsers: -1, // Unlimited
            maxContacts: -1, // Unlimited
            maxDeals: -1, // Unlimited
            maxStorageGB: 1000
        }
    };
    
    this.limits = tierLimits[tier] || tierLimits.trial;
    return this.limits;
};

// Helper method to get enabled modules based on tier (tenant only)
OrganizationSchema.methods.getModulesForTier = function(tier) {
    if (!this.isTenant) return [];
    
    const tierModules = {
        trial: ['contacts', 'deals', 'tasks', 'events'],
        paid: ['contacts', 'organizations', 'deals', 'projects', 'tasks', 'events', 'items', 'documents', 'transactions', 'forms', 'processes', 'reports']
    };
    
    return tierModules[tier] || tierModules.trial;
};

// Pre-save hook to generate slug from name if not provided (tenant only)
OrganizationSchema.pre('save', function(next) {
    if (this.isTenant && !this.slug && this.name) {
        this.slug = this.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }
    next();
});

module.exports = mongoose.model('Organization', OrganizationSchema);
