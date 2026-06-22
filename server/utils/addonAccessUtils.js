const AddonDefinition = require('../models/AddonDefinition');
const TenantAddonConfiguration = require('../models/TenantAddonConfiguration');
const OrganizationSubscription = require('../models/OrganizationSubscription');
const { normalizeAddonKey, isValidAddonKey } = require('../constants/addonKeys');

async function getAddonDefinition(addonKey) {
  const normalized = normalizeAddonKey(addonKey);
  if (!isValidAddonKey(normalized)) return null;
  return AddonDefinition.findOne({ addonKey: normalized, enabled: true }).lean();
}

async function getTenantAddonConfiguration(organizationId, addonKey) {
  return TenantAddonConfiguration.findOne({
    organizationId,
    addonKey: normalizeAddonKey(addonKey),
  }).lean();
}

function findAddonSubscriptionEntry(subscription, addonKey) {
  if (!subscription?.addons?.length) return null;
  const normalized = normalizeAddonKey(addonKey);
  return subscription.addons.find((row) => normalizeAddonKey(row.addonKey) === normalized) || null;
}

async function getOrgAddonSubscription(organizationId, addonKey) {
  const subscription = await OrganizationSubscription.findOne({ organizationId }).lean();
  if (!subscription) return null;
  return findAddonSubscriptionEntry(subscription, addonKey);
}

/**
 * Tenant has an active entitlement (trial or paid) and config is not disabled/archived.
 */
async function isAddonEntitledForOrg(organizationId, addonKey) {
  const normalized = normalizeAddonKey(addonKey);
  const config = await getTenantAddonConfiguration(organizationId, normalized);
  if (!config || config.enabled === false || config.archivedAt) return false;

  const subscription = await OrganizationSubscription.findOne({ organizationId }).lean();
  const entry = findAddonSubscriptionEntry(subscription, normalized);
  if (!entry) return false;

  const status = String(entry.status || '').toUpperCase();
  if (status === 'SUSPENDED' || status === 'ARCHIVED') return false;

  if (status === 'TRIAL' && entry.trialEndsAt && new Date(entry.trialEndsAt) < new Date()) {
    return false;
  }

  return true;
}

async function isAddonInstalledForOrg(organizationId, addonKey) {
  const config = await getTenantAddonConfiguration(organizationId, addonKey);
  return !!config;
}

module.exports = {
  getAddonDefinition,
  getTenantAddonConfiguration,
  getOrgAddonSubscription,
  findAddonSubscriptionEntry,
  isAddonEntitledForOrg,
  isAddonInstalledForOrg,
};
