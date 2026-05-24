/**
 * ============================================================================
 * PLATFORM CORE: Organization Model (Dual-Purpose)
 * ============================================================================
 * 
 * This model serves TWO purposes:
 * 
 * 1. PLATFORM CORE (Tenant Organization):
 *    - Tenant/workspace management (isTenant: true)
 *    - Subscription and billing
 *    - App enablement (enabledApps)
 *    - Usage limits
 *    - Organization settings
 * 
 * 2. SALES APP (SALES Organization Entity):
 *    - Customer/Partner/Vendor records (isTenant: false)
 *    - SALES-specific fields (types, status, tiers, etc.)
 * 
 * ⚠️ ARCHITECTURAL NOTE: Single model for both tenant and SALES entity
 *    This is intentional for now - use isTenant flag to distinguish
 *    Future: Could be split into TenantOrganization (Platform Core) and
 *            SalesOrganization (SALES App) if needed for clearer separation.
 * 
 * ✅ FIXED: enabledModules default changed to empty array (app-agnostic)
 *    - Legacy field kept for backward compatibility
 *    - Use enabledApps for app-level enablement
 * 
 * See PLATFORM_CORE_ANALYSIS.md for details.
 * ============================================================================
 */

const mongoose = require('mongoose');
const { RECORD_SOURCE_VALUES, DEFAULT_RECORD_SOURCE } = require('../constants/recordSource');

const OrganizationSchema = new mongoose.Schema({
    // ===== TENANT/SUBSCRIPTION FIELDS (PLATFORM CORE) =====
    // Basic Information
    name: { 
        type: String, 
        required: true,
        trim: true
    },
    slug: { 
        type: String, 
        unique: true,
        sparse: true, // Allow null/undefined for SALES organizations
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
    
    // Enabled Apps (app-level enablement for tenant organizations)
    // Controls which applications are available to the organization
    // This is the single source of truth for organization app subscriptions
    // Note: 'CRM' is not an app - it's legacy terminology. Use SALES instead.
    // - 'SALES': Sales application (replaces legacy CRM)
    // - 'HELPDESK': Helpdesk application
    // - 'PROJECTS': Projects application
    // - 'PORTAL': Customer/Partner portal application
    // - 'AUDIT': Audit management application
    // - 'LMS': Learning Management System application
    enabledApps: [
        {
            appKey: { 
                type: String, 
                required: true,
                enum: ['SALES', 'HELPDESK', 'PROJECTS', 'PORTAL', 'AUDIT', 'LMS']
            },
            status: { 
                type: String, 
                enum: ['ACTIVE', 'SUSPENDED'], 
                default: 'ACTIVE' 
            },
            enabledAt: { 
                type: Date, 
                default: Date.now 
            }
        }
    ],
    
    // Legacy: Enabled Modules (CRM-specific, deprecated)
    // ⚠️ PLATFORM CORE VIOLATION: Default contains CRM-specific module names
    //    Kept for backward compatibility - will be migrated to enabledApps
    //    Changed default to empty array to be app-agnostic
    // @deprecated Use enabledApps instead
    enabledModules: {
        type: [String],
        default: [] // Changed from ['contacts', 'deals', 'tasks', 'events'] to be app-agnostic
    },
    
    // Module Participation Overrides (organization-level)
    // Tracks which applications use which core modules
    // Format: { moduleKey: { appKey: enabled } }
    // Example: { 'people': { 'SALES': true, 'HELPDESK': false } }
    moduleOverrides: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    
    // CRM Initialization Status (multi-pod safe)
    // Tracks whether CRM modules have been initialized for this organization
    // Used as source of truth for lazy CRM initialization across multiple pods
    crmInitialized: {
        type: Boolean,
        default: false,
        index: true // Index for fast lookups
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
        locale: { 
            type: String, 
            default: 'en-US' 
        },
        language: { 
            type: String, 
            default: 'en' 
        },
        logoUrl: String,
        primaryColor: { 
            type: String, 
            default: '#7f56d9' 
        }
    },
    
    // Data Region (read-only if fixed, set during organization creation)
    dataRegion: {
        type: String,
        default: 'us-east-1' // Default region, can be set during org creation
    },
    
    // Security Configuration (platform-wide security policies)
    security: {
        // Password Policy
        passwordPolicy: {
            minLength: { type: Number, default: 8 },
            requireUppercase: { type: Boolean, default: true },
            requireLowercase: { type: Boolean, default: true },
            requireNumbers: { type: Boolean, default: true },
            requireSpecialChars: { type: Boolean, default: false },
            expirationDays: { type: Number, default: 90 }, // 0 = no expiration
            preventReuse: { type: Number, default: 5 } // Number of previous passwords to prevent reuse
        },
        // Session Rules
        sessionRules: {
            durationHours: { type: Number, default: 24 }, // Session duration in hours
            idleTimeoutMinutes: { type: Number, default: 30 }, // Idle timeout in minutes
            maxConcurrentSessions: { type: Number, default: 5 } // Max concurrent sessions per user
        },
        // Login Restrictions
        loginRestrictions: {
            ipWhitelist: [{ type: String }], // Allowed IP addresses (empty = no restriction)
            ipBlacklist: [{ type: String }], // Blocked IP addresses
            allowedRegions: [{ type: String }], // Allowed regions (empty = no restriction)
            blockFailedAttempts: { type: Boolean, default: true },
            maxFailedAttempts: { type: Number, default: 5 },
            lockoutDurationMinutes: { type: Number, default: 15 }
        },
        // Two-Factor Authentication
        twoFactorAuth: {
            enabled: { type: Boolean, default: false },
            required: { type: Boolean, default: false }, // Require 2FA for all users
            methods: [{ type: String, enum: ['totp', 'sms', 'email'], default: ['totp'] }] // Allowed 2FA methods
        }
    },

    // Integrations (organization-level integration state)
    // Format: { [integrationKey]: { enabled, status, connectedAt, disconnectedAt } }
    integrations: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
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
            // Format: arivu_{slug} or arivu_{organizationId}
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
    // Values from module field config (Settings → Fields), not a fixed schema enum
    types: {
        type: [String],
        default: []
    },
    website: { type: String, trim: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    tags: [{ type: String, trim: true }],

    /** System-managed creation channel (set server-side only) */
    source: {
        type: String,
        enum: RECORD_SOURCE_VALUES,
        default: DEFAULT_RECORD_SOURCE
    },
    
    // Ownership/links (SALES)
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
        trim: true
    },
    customerTier: {
        type: String,
        trim: true
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
        trim: true
    },
    partnerTier: {
        type: String,
        trim: true
    },
    partnerType: {
        type: String,
        trim: true
    },
    partnerSince: { type: Date },
    partnerOnboardingSteps: mongoose.Schema.Types.Mixed,
    territory: [{ type: String, trim: true }],
    discountRate: { type: Number, min: 0, max: 100 },
    
    // Vendor-specific
    vendorStatus: {
        type: String,
        trim: true
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
        trim: true
    },
    terms: { type: String, trim: true },
    shippingAddress: { type: String, trim: true },
    logisticsPartner: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Organization' 
    },
    
    // Activity Logs (Generic audit trail - app-agnostic structure)
    // ⚠️ NOTE: Used by CRM app for organization entity changes
    //    The action field is a generic string, but action values may be app-specific
    //    SALES app may use values like "customer_status_changed", "partner_tier_updated", etc.
    //    Other apps can use their own action types. The structure itself is app-agnostic.
    activityLogs: [{
        user: { type: String, required: true },
        userId: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'User' 
        },
        action: { type: String, required: true }, // Generic action type (values are app-specific)
        details: { type: mongoose.Schema.Types.Mixed },
        timestamp: { 
            type: Date, 
            default: Date.now, 
            required: true 
        }
    }],

    // Description version history (native, task/deal parity)
    descriptionVersions: [{
        content: { type: String, default: '' },
        createdAt: { type: Date, default: Date.now, required: true },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }],
    
    // Legacy support (for migration)
    legacyOrganizationId: { 
        type: mongoose.Schema.Types.ObjectId
    },
    
    // Distinguish tenant vs CRM organization
    isTenant: {
        type: Boolean,
        default: false // CRM organizations by default
    },
    
    // Derived Status (computed from Configuration Registry)
    // This field is computed from lifecycle mappings and is nullable
    // If no config exists or computation fails, this remains null
    derivedStatus: {
        type: String,
        trim: true,
        default: null,
        index: true
    },

    // Custom fields (user-defined via Settings → Modules & Fields)
    customFields: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },

    // Trash (soft delete) - See docs/TRASH_IMPLEMENTATION_SPEC.md
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deletionReason: { type: String, trim: true, maxlength: 500 }
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

// Helper method to check if an app is enabled (tenant only)
// Supports both new object structure and legacy string array for backward compatibility
OrganizationSchema.methods.hasApp = function(appKey) {
    if (!this.isTenant) return false;
    if (!this.enabledApps || this.enabledApps.length === 0) return false;
    
    // Check if enabledApps is array of objects (new structure)
    if (typeof this.enabledApps[0] === 'object' && this.enabledApps[0] !== null) {
        return this.enabledApps.some(
            app => app.appKey === appKey && app.status === 'ACTIVE'
        );
    }
    
    // Legacy: array of strings
    return this.enabledApps.includes(appKey);
};

// Helper method to check if a feature is enabled (tenant only)
// Backward compatibility: For legacy CRM module names, checks if SALES app is enabled
// @deprecated For legacy CRM module names, use hasApp('SALES') instead
// Note: CRM is not an app - it's legacy terminology. SALES app replaces it.
OrganizationSchema.methods.hasFeature = function(featureName) {
    if (!this.isTenant) return false;
    
    // If enabledApps exists and is populated, use app-aware logic
    if (this.enabledApps && this.enabledApps.length > 0) {
        // Map legacy module names to SALES app
        const salesModules = ['contacts', 'deals', 'tasks', 'events', 'people', 'organizations', 'projects', 'items', 'documents', 'transactions', 'forms', 'processes', 'reports'];
        if (salesModules.includes(featureName)) {
            return this.hasApp('SALES');
        }
        // For non-SALES features, fall back to enabledModules for backward compatibility
        return this.enabledModules && this.enabledModules.includes(featureName);
    }
    
    // Fallback to legacy enabledModules
    return this.enabledModules && this.enabledModules.includes(featureName);
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
