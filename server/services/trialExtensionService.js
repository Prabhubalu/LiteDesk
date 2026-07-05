const Organization = require('../models/Organization');
const OrganizationSubscription = require('../models/OrganizationSubscription');
const InstanceRegistry = require('../models/InstanceRegistry');

const TRIAL_EXTENSION_DAYS = 7;
const MIN_EXTENSION_REASON_LENGTH = 10;

/**
 * Align app and addon trial windows with the organization trial end date.
 * Reactivates SUSPENDED trial apps when the new end date is in the future.
 */
function applyTrialEndDateToOrgSubscription(orgSubscription, trialEndDate) {
    if (!orgSubscription || !trialEndDate) return false;

    let changed = false;
    const trialStillActive = trialEndDate > new Date();

    for (const app of orgSubscription.apps) {
        if (app.status === 'TRIAL' || app.status === 'SUSPENDED' || app.trialEndsAt) {
            app.trialEndsAt = trialEndDate;
            if (app.status === 'SUSPENDED' && trialStillActive) {
                app.status = 'TRIAL';
            }
            changed = true;
        }
    }

    for (const addon of orgSubscription.addons || []) {
        if (addon.status === 'TRIAL' || addon.status === 'SUSPENDED' || addon.trialEndsAt) {
            addon.trialEndsAt = trialEndDate;
            if (addon.status === 'SUSPENDED' && trialStillActive) {
                addon.status = 'TRIAL';
            }
            changed = true;
        }
    }

    return changed;
}

/**
 * When the organization trial is still active, align per-app/addon trials with it.
 * Repairs stale SUSPENDED/expired app rows after org-level trial extension.
 */
function reconcileOrgSubscriptionWithOrganizationTrial(organization, orgSubscription) {
    if (!organization || !orgSubscription) return false;

    const subscription = organization.subscription || {};
    if (subscription.status !== 'trial' || !subscription.trialEndDate) return false;

    const trialEndDate = new Date(subscription.trialEndDate);
    if (trialEndDate <= new Date()) return false;

    return applyTrialEndDateToOrgSubscription(orgSubscription, trialEndDate);
}

/**
 * Extend an expired organization trial once for TRIAL_EXTENSION_DAYS from today.
 */
async function extendOrganizationTrial({ organizationId, userId, reason }) {
    const trimmedReason = String(reason || '').trim();
    if (trimmedReason.length < MIN_EXTENSION_REASON_LENGTH) {
        return {
            ok: false,
            code: 'REASON_REQUIRED',
            message: `Please provide a reason of at least ${MIN_EXTENSION_REASON_LENGTH} characters.`
        };
    }

    const organization = await Organization.findById(organizationId);
    if (!organization) {
        return {
            ok: false,
            code: 'ORG_NOT_FOUND',
            message: 'Organization not found.'
        };
    }

    if (!organization.isTenant) {
        return {
            ok: false,
            code: 'NOT_TENANT',
            message: 'Trial extension is only available for tenant organizations.'
        };
    }

    if (organization.subscription.status !== 'trial') {
        return {
            ok: false,
            code: 'NOT_ON_TRIAL',
            message: 'Trial extension is only available while on a trial subscription.'
        };
    }

    if (!organization.isTrialExpired()) {
        return {
            ok: false,
            code: 'TRIAL_NOT_EXPIRED',
            message: 'Your trial is still active.'
        };
    }

    if (organization.subscription.trialExtensionUsed) {
        return {
            ok: false,
            code: 'EXTENSION_ALREADY_USED',
            message: 'Trial has already been extended once.'
        };
    }

    const now = new Date();
    const newTrialEndDate = new Date(now);
    newTrialEndDate.setDate(newTrialEndDate.getDate() + TRIAL_EXTENSION_DAYS);

    organization.subscription.trialEndDate = newTrialEndDate;
    organization.subscription.trialExtensionUsed = true;
    organization.subscription.trialExtendedAt = now;
    organization.subscription.trialExtensionReason = trimmedReason;

    await organization.save();

    const dbName = organization.database?.name;
    if (dbName) {
        const instance = await InstanceRegistry.findOne({ 'databaseConnection.database': dbName });
        if (instance) {
            instance.subscription.trialEndDate = newTrialEndDate;
            if (instance.subscription.status === 'trial' || instance.subscription.tier === 'trial') {
                instance.subscription.status = 'trial';
            }
            await instance.save();
        }
    }

    const orgSubscription = await OrganizationSubscription.findOne({ organizationId });
    if (orgSubscription && applyTrialEndDateToOrgSubscription(orgSubscription, newTrialEndDate)) {
        await orgSubscription.save();
    }

    console.info('[TrialExtension] Trial extended', {
        organizationId: String(organizationId),
        userId: userId != null ? String(userId) : null,
        newTrialEndDate: newTrialEndDate.toISOString(),
        extensionDays: TRIAL_EXTENSION_DAYS
    });

    return {
        ok: true,
        subscription: organization.subscription.toObject(),
        trialDaysRemaining: organization.getTrialDaysRemaining(),
        trialEndDate: newTrialEndDate
    };
}

function buildTrialStatusSnapshot(organization) {
    if (!organization) {
        return {
            expired: false,
            extensionUsed: false,
            trialEndDate: null,
            daysRemaining: 0
        };
    }

    const subscription = organization.subscription || {};
    const onTrial = subscription.status === 'trial';
    const expired = onTrial && typeof organization.isTrialExpired === 'function'
        ? organization.isTrialExpired()
        : false;

    return {
        expired,
        extensionUsed: subscription.trialExtensionUsed === true,
        trialEndDate: subscription.trialEndDate || null,
        subscriptionStatus: subscription.status || null,
        daysRemaining: onTrial && typeof organization.getTrialDaysRemaining === 'function'
            ? organization.getTrialDaysRemaining()
            : 0
    };
}

module.exports = {
    TRIAL_EXTENSION_DAYS,
    MIN_EXTENSION_REASON_LENGTH,
    applyTrialEndDateToOrgSubscription,
    reconcileOrgSubscriptionWithOrganizationTrial,
    extendOrganizationTrial,
    buildTrialStatusSnapshot
};
