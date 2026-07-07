'use strict';

const Organization = require('../models/Organization');
const OrganizationSubscription = require('../models/OrganizationSubscription');
const { normalizeAppKey, isAppEnabledForOrg } = require('../utils/appAccessUtils');
const { isInternalOrganization } = require('../utils/internalOrganization');

function findAppSubscriptionEntry(subscription, appKey) {
  if (!subscription?.apps?.length) return null;
  const normalized = normalizeAppKey(appKey);
  return subscription.apps.find((row) => normalizeAppKey(row.appKey) === normalized) || null;
}

function isAppSubscriptionUsable(entry) {
  if (!entry) return false;
  const status = String(entry.status || '').toUpperCase();
  if (status === 'SUSPENDED' || status === 'CANCELLED' || status === 'ARCHIVED') {
    return false;
  }
  if (status === 'TRIAL' && entry.trialEndsAt && new Date(entry.trialEndsAt) < new Date()) {
    return false;
  }
  return status === 'ACTIVE' || status === 'TRIAL';
}

function isParentAppEntitled({ organization, subscription, appKey }) {
  if (isAppEnabledForOrg(organization, appKey)) {
    return true;
  }
  const entry = findAppSubscriptionEntry(subscription, appKey);
  return isAppSubscriptionUsable(entry);
}

function evaluateRequiredAppsEntitlement({ organization, subscription, requiredApps }) {
  const apps = Array.isArray(requiredApps)
    ? requiredApps.map(normalizeAppKey).filter(Boolean)
    : [];

  if (apps.length === 0) {
    return { ok: true, missingApps: [] };
  }

  const missingApps = apps.filter(
    (appKey) => !isParentAppEntitled({ organization, subscription, appKey }),
  );

  if (missingApps.length > 0) {
    return {
      ok: false,
      code: 'PARENT_APP_REQUIRED',
      message: `Install requires active app entitlement: ${missingApps.join(', ')}`,
      missingApps,
    };
  }

  return { ok: true, missingApps: [] };
}

/**
 * Parent app is entitled when enabled on the org or has a usable subscription entry.
 */
async function isParentAppEntitledForOrg(organizationId, appKey) {
  const organization = await Organization.findById(organizationId).lean();
  if (!organization) return false;

  const subscription = await OrganizationSubscription.findOne({ organizationId }).lean();
  return isParentAppEntitled({ organization, subscription, appKey });
}

/**
 * Validate addon requiredApps before install.
 * @returns {{ ok: true } | { ok: false, code: string, message: string, missingApps: string[] }}
 */
async function assertAddonParentAppsEntitled({ organizationId, addonDefinition }) {
  const requiredApps = Array.isArray(addonDefinition?.requiredApps)
    ? addonDefinition.requiredApps.map(normalizeAppKey).filter(Boolean)
    : [];

  if (requiredApps.length === 0) {
    return { ok: true };
  }

  if (await isInternalOrganization(organizationId)) {
    return { ok: true };
  }

  const organization = await Organization.findById(organizationId).lean();
  const subscription = await OrganizationSubscription.findOne({ organizationId }).lean();
  const result = evaluateRequiredAppsEntitlement({
    organization,
    subscription,
    requiredApps,
  });

  if (!result.ok) {
    return result;
  }

  return { ok: true };
}

module.exports = {
  isParentAppEntitled,
  isParentAppEntitledForOrg,
  isAppSubscriptionUsable,
  evaluateRequiredAppsEntitlement,
  assertAddonParentAppsEntitled,
};
