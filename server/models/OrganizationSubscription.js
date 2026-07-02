/**
 * ============================================================================
 * PLATFORM CORE: Organization Subscription Model
 * ============================================================================
 * 
 * Single source of truth for what an organization is entitled to use.
 * 
 * Billing Model:
 * - Organization-level subscriptions
 * - App-scoped entitlements
 * - Per-app seat limits
 * - Subscription status (ACTIVE, TRIAL, SUSPENDED)
 * 
 * Rules:
 * - One document per organization
 * - Apps are independent
 * - SALES always exists for legacy orgs
 * - Seat counts are derived, not guessed
 * 
 * ============================================================================
 */

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const OrganizationSubscriptionSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        unique: true,
        index: true
    },

    apps: [
        {
            appKey: {
                type: String,
                required: true
            },
            planKey: {
                type: String,
                required: true,
                enum: ['BASIC', 'PRO', 'ENTERPRISE']
            },
            seatLimit: {
                type: Number,
                default: null // null = unlimited
            },
            seatsUsed: {
                type: Number,
                default: 0
            },
            status: {
                type: String,
                enum: ['ACTIVE', 'TRIAL', 'SUSPENDED'],
                default: 'ACTIVE'
            },
            trialEndsAt: {
                type: Date,
                default: null
            },
            startedAt: {
                type: Date,
                default: Date.now
            }
        }
    ],

    addons: [
        {
            addonKey: {
                type: String,
                required: true,
                trim: true,
                lowercase: true,
            },
            planKey: {
                type: String,
                required: true,
                enum: ['BASIC', 'PRO', 'ENTERPRISE'],
            },
            agentLimit: {
                type: Number,
                default: null, // null = unlimited (PER_AGENT billing)
            },
            agentsUsed: {
                type: Number,
                default: 0,
            },
            status: {
                type: String,
                enum: ['ACTIVE', 'TRIAL', 'SUSPENDED', 'ARCHIVED'],
                default: 'TRIAL',
            },
            trialEndsAt: {
                type: Date,
                default: null,
            },
            startedAt: {
                type: Date,
                default: Date.now,
            },
            installedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
                default: null,
            },
        },
    ],

    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update updatedAt on save
OrganizationSubscriptionSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    this._appsChanged = this.isModified('apps');
    next();
});

OrganizationSubscriptionSchema.post('save', function(doc) {
    if (!this._appsChanged && !this.isNew) return;
    setImmediate(() => {
        const { syncEmailPolicyFromOrganizationSubscription } = require('../services/billing/email-credits');
        syncEmailPolicyFromOrganizationSubscription(doc.organizationId).catch((err) => {
            console.warn('[OrganizationSubscription] email policy sync failed:', err?.message || err);
        });
    });
});

// Index for app lookups
OrganizationSubscriptionSchema.index({ 'apps.appKey': 1 });
OrganizationSubscriptionSchema.index({ 'addons.addonKey': 1 });

const OrganizationSubscription = mongoose.model('OrganizationSubscription', OrganizationSubscriptionSchema);

module.exports = wrapTenantModel(OrganizationSubscription);

