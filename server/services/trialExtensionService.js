const Organization = require('../models/Organization');
const OrganizationSubscription = require('../models/OrganizationSubscription');

const TRIAL_EXTENSION_DAYS = 7;
const MIN_EXTENSION_REASON_LENGTH = 10;

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

    const orgSubscription = await OrganizationSubscription.findOne({ organizationId });
    if (orgSubscription) {
        let changed = false;
        for (const app of orgSubscription.apps) {
            if (app.status === 'SUSPENDED' && app.trialEndsAt) {
                app.status = 'TRIAL';
                app.trialEndsAt = newTrialEndDate;
                changed = true;
            }
        }
        if (changed) {
            await orgSubscription.save();
        }
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
        daysRemaining: onTrial && typeof organization.getTrialDaysRemaining === 'function'
            ? organization.getTrialDaysRemaining()
            : 0
    };
}

module.exports = {
    TRIAL_EXTENSION_DAYS,
    MIN_EXTENSION_REASON_LENGTH,
    extendOrganizationTrial,
    buildTrialStatusSnapshot
};
