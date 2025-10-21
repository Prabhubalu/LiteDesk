const mongoose = require('mongoose');

const OrganizationSchema = new mongoose.Schema({
    // Basic Information
    name: { 
        type: String, 
        required: true 
    },
    slug: { 
        type: String, 
        unique: true,
        lowercase: true
    },
    industry: { 
        type: String, 
        required: true 
    },
    
    // Subscription Management
    subscription: {
        status: { 
            type: String, 
            enum: ['trial', 'active', 'expired', 'cancelled'],
            default: 'trial'
        },
        tier: { 
            type: String, 
            enum: ['trial', 'starter', 'professional', 'enterprise'],
            default: 'trial'
        },
        trialStartDate: { 
            type: Date, 
            default: Date.now 
        },
        trialEndDate: { 
            type: Date,
            default: function() {
                // 15 days from now
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
    
    // Limits & Features based on subscription tier
    limits: {
        maxUsers: { 
            type: Number, 
            default: 3  // Trial limit
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
    
    // Enabled Modules
    enabledModules: {
        type: [String],
        default: ['contacts', 'deals', 'tasks', 'events']  // Trial modules
    },
    
    // Organization Settings
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
    }
}, { 
    timestamps: true 
});

// Helper method to check if trial is expired
OrganizationSchema.methods.isTrialExpired = function() {
    if (this.subscription.status !== 'trial') {
        return false;
    }
    return new Date() > this.subscription.trialEndDate;
};

// Helper method to get days remaining in trial
OrganizationSchema.methods.getTrialDaysRemaining = function() {
    if (this.subscription.status !== 'trial') {
        return 0;
    }
    const now = new Date();
    const diff = this.subscription.trialEndDate - now;
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};

// Helper method to check if a feature is enabled
OrganizationSchema.methods.hasFeature = function(featureName) {
    return this.enabledModules.includes(featureName);
};

// Helper method to update limits based on tier
OrganizationSchema.methods.updateLimitsForTier = function(tier) {
    const tierLimits = {
        trial: {
            maxUsers: 3,
            maxContacts: 100,
            maxDeals: 50,
            maxStorageGB: 1
        },
        starter: {
            maxUsers: 5,
            maxContacts: 1000,
            maxDeals: 500,
            maxStorageGB: 10
        },
        professional: {
            maxUsers: 25,
            maxContacts: 10000,
            maxDeals: 5000,
            maxStorageGB: 100
        },
        enterprise: {
            maxUsers: -1,  // Unlimited
            maxContacts: -1,
            maxDeals: -1,
            maxStorageGB: 1000
        }
    };
    
    this.limits = tierLimits[tier] || tierLimits.trial;
    return this.limits;
};

// Helper method to get enabled modules based on tier
OrganizationSchema.methods.getModulesForTier = function(tier) {
    const tierModules = {
        trial: ['contacts', 'deals', 'tasks', 'events'],
        starter: ['contacts', 'organizations', 'deals', 'tasks', 'events', 'items'],
        professional: ['contacts', 'organizations', 'deals', 'projects', 'tasks', 'events', 'items', 'documents', 'transactions', 'forms', 'processes'],
        enterprise: ['contacts', 'organizations', 'deals', 'projects', 'tasks', 'events', 'items', 'documents', 'transactions', 'forms', 'processes', 'reports']
    };
    
    return tierModules[tier] || tierModules.trial;
};

// Pre-save hook to generate slug from name if not provided
OrganizationSchema.pre('save', function(next) {
    if (!this.slug && this.name) {
        this.slug = this.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }
    next();
});

module.exports = mongoose.model('Organization', OrganizationSchema);

