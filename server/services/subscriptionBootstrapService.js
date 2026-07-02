/**
 * ============================================================================
 * Subscription Bootstrap Service
 * ============================================================================
 * 
 * Automatically provisions trial subscriptions when apps are enabled.
 * 
 * Rules:
 * - Only creates subscription if one does not exist
 * - Never creates duplicate subscriptions
 * - Safe to retry
 * - Sales excluded (already provisioned at org creation)
 * - Never throws (logs errors instead)
 * 
 * ============================================================================
 */

const OrganizationSubscription = require('../models/OrganizationSubscription');
const { getAppConfig } = require('../utils/appAccessUtils');
const appPricingRegistry = require('../constants/appPricingRegistry');
const { APP_KEYS } = require('../constants/appKeys');
const {
    isInternalOrganization,
    buildEnterpriseAppSubscription,
    normalizeExistingEntryForInternalOrg
} = require('../utils/internalOrganization');
const { onSubscriptionActivated } = require('./billing/email-credits');

/**
 * Ensure a subscription exists for an app
 * Creates a TRIAL subscription if one does not exist
 * 
 * @param {Object} params
 * @param {string|ObjectId} params.organizationId - Organization ID
 * @param {string} params.appKey - App key (SALES, AUDIT, PORTAL)
 * @param {string|ObjectId} params.initiatedByUserId - User ID who initiated the action
 * @returns {Promise<{created: boolean, subscription: Object|null}>}
 */
async function ensureSubscriptionForApp({ organizationId, appKey, initiatedByUserId }) {
    try {
        // Safeguard 1: Skip Sales (already provisioned at org creation)
        if (appKey === APP_KEYS.SALES) {
            console.info('[SubscriptionBootstrap] Skipping Sales - already provisioned', {
                orgId: organizationId,
                appKey
            });
            return { created: false, subscription: null };
        }

        // Safeguard 2: Validate app exists in appRegistry
        const appConfig = getAppConfig(appKey);
        if (!appConfig) {
            console.warn('[SubscriptionBootstrap] App not in appRegistry', {
                orgId: organizationId,
                appKey
            });
            return { created: false, subscription: null };
        }

        // Safeguard 3: Validate app exists in appPricingRegistry
        const pricingConfig = appPricingRegistry[appKey];
        if (!pricingConfig) {
            console.warn('[SubscriptionBootstrap] App not in appPricingRegistry', {
                orgId: organizationId,
                appKey
            });
            return { created: false, subscription: null };
        }

        // Safeguard 4: Check AUDIT_SYNC_ENABLED (if applicable)
        if (process.env.AUDIT_SYNC_ENABLED === 'false' && appKey === APP_KEYS.AUDIT) {
            console.info('[SubscriptionBootstrap] AUDIT_SYNC_ENABLED is false, skipping', {
                orgId: organizationId,
                appKey
            });
            return { created: false, subscription: null };
        }

        // Get or create organization subscription document
        let subscription = await OrganizationSubscription.findOne({ organizationId });

        if (!subscription) {
            // Create new subscription document
            subscription = await OrganizationSubscription.create({
                organizationId: organizationId,
                apps: []
            });
            console.info('[SubscriptionBootstrap] Created organization subscription document', {
                orgId: organizationId
            });
        }

        // Internal-org rule: Arivu's own tenants always get ENTERPRISE / unlimited /
        // ACTIVE on every app, with no trial. This applies both when first creating
        // an app entry AND when one already exists but has drifted (e.g. was
        // provisioned as BASIC before the org was flagged internal).
        const internal = await isInternalOrganization(organizationId);

        // Check if app subscription already exists
        const existingAppSubscription = subscription.apps.find(
            app => app.appKey === appKey
        );

        if (existingAppSubscription) {
            if (internal) {
                const changed = normalizeExistingEntryForInternalOrg(existingAppSubscription);
                if (changed) {
                    await subscription.save();
                    console.info('[SubscriptionBootstrap] INTERNAL_NORMALIZED', {
                        orgId: organizationId,
                        appKey,
                        planKey: existingAppSubscription.planKey,
                        seatLimit: existingAppSubscription.seatLimit
                    });
                }
                return { created: false, subscription: existingAppSubscription };
            }
            console.info('[SubscriptionBootstrap] Subscription already exists', {
                orgId: organizationId,
                appKey,
                status: existingAppSubscription.status
            });
            return { created: false, subscription: existingAppSubscription };
        }

        let appSubscription;
        let logShape;

        if (internal) {
            appSubscription = buildEnterpriseAppSubscription(appKey);
            logShape = {
                event: 'INTERNAL_ENTERPRISE_CREATED',
                planKey: appSubscription.planKey,
                seatLimit: appSubscription.seatLimit
            };
        } else {
            // Get default plan and trial days from pricing config
            const defaultPlan = pricingConfig.defaultPlan || 'BASIC';
            const trialDays = pricingConfig.trialDays || 14; // Default to 14 days if not specified

            // Get plan config
            const planConfig = pricingConfig.plans[defaultPlan];
            if (!planConfig) {
                console.error('[SubscriptionBootstrap] Default plan not found in pricing config', {
                    orgId: organizationId,
                    appKey,
                    defaultPlan
                });
                return { created: false, subscription: null };
            }

            // Calculate seat limit
            let seatLimit = null;
            if (pricingConfig.billingType === 'PER_USER') {
                seatLimit = planConfig.seatLimit || null;
            }
            // FLAT apps have null seatLimit

            // Calculate trial end date
            const trialEndsAt = new Date();
            trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);

            appSubscription = {
                appKey: appKey,
                planKey: defaultPlan,
                seatLimit: seatLimit,
                seatsUsed: 0,
                status: 'TRIAL',
                trialEndsAt: trialEndsAt,
                startedAt: new Date()
            };

            logShape = {
                event: 'TRIAL_CREATED',
                planKey: defaultPlan,
                trialDays,
                trialEndsAt: trialEndsAt.toISOString(),
                seatLimit
            };
        }

        // Add to apps array
        subscription.apps.push(appSubscription);
        await subscription.save();

        console.info(`[SubscriptionBootstrap] ${logShape.event}`, {
            orgId: organizationId,
            appKey,
            ...logShape,
            initiatedByUserId: initiatedByUserId
        });

        try {
            await onSubscriptionActivated(organizationId, { planKey: appSubscription.planKey });
        } catch (creditErr) {
            console.warn('[SubscriptionBootstrap] email policy sync failed:', creditErr?.message || creditErr);
        }

        return { created: true, subscription: appSubscription };

    } catch (error) {
        // Never throw - log error instead
        console.error('[SubscriptionBootstrap] Error ensuring subscription', {
            orgId: organizationId,
            appKey,
            error: error.message,
            stack: error.stack
        });
        return { created: false, subscription: null, error: error.message };
    }
}

module.exports = {
    ensureSubscriptionForApp
};

