'use strict';

const mongoose = require('mongoose');
const OrganizationSubscription = require('../models/OrganizationSubscription');
const TenantAddonConfiguration = require('../models/TenantAddonConfiguration');
const AddonDefinition = require('../models/AddonDefinition');
const { findAddonSubscriptionEntry } = require('../utils/addonAccessUtils');
const { normalizeAddonKey } = require('../constants/addonKeys');
const { getAddonPricing } = require('../services/addonPricingService');

function normalizeOrganizationId(organizationId) {
  if (!organizationId) return null;
  const raw = typeof organizationId === 'object' && organizationId._id
    ? organizationId._id
    : organizationId;
  if (!mongoose.Types.ObjectId.isValid(String(raw))) return null;
  return new mongoose.Types.ObjectId(String(raw));
}

function mapAddonPlan(config, entry) {
  if (config?.archivedAt) return 'Archived';
  if (config?.enabled === false) return 'DISABLED';
  if (!entry) return 'Active';

  const status = String(entry.status || 'ACTIVE').toUpperCase();
  if (status === 'TRIAL') return 'Trial';
  if (status === 'SUSPENDED') return 'Suspended';
  if (status === 'ACTIVE') return entry.planKey || 'Active';
  return status;
}

function buildLineItem({ addonKey, definition, config, entry, pricing }) {
  const plan = mapAddonPlan(config, entry);
  const usage = {};
  if (pricing?.billingType === 'PER_AGENT' && entry) {
    usage.agents = {
      current: entry.agentsUsed ?? 0,
      limit: entry.agentLimit ?? null,
    };
  }

  return {
    itemType: 'addon',
    appKey: `addon:${addonKey}`,
    addonKey,
    appName: definition.name,
    description: definition.description || definition.marketplace?.shortDescription || '',
    plan,
    canUpgrade: plan === 'Trial' || plan === 'Suspended' || plan === 'DISABLED',
    usage,
    limits: {},
    status: entry?.status || (config?.enabled !== false ? 'ACTIVE' : 'DISABLED'),
    subscriptionDetails: entry
      ? {
          planKey: entry.planKey,
          trialEndsAt: entry.trialEndsAt,
          startedAt: entry.startedAt,
          billingType: pricing?.billingType || null,
        }
      : null,
  };
}

async function buildAddonSubscriptionLineItems(organizationId) {
  const orgId = normalizeOrganizationId(organizationId);
  if (!orgId) return [];

  const [subscription, configs, definitions] = await Promise.all([
    OrganizationSubscription.findOne({ organizationId: orgId }).lean(),
    TenantAddonConfiguration.find({ organizationId: orgId }).lean(),
    AddonDefinition.find({ enabled: true }).lean(),
  ]);

  const defByKey = new Map(definitions.map((row) => [normalizeAddonKey(row.addonKey), row]));
  const installedConfigs = (configs || []).filter((row) => !row.archivedAt);
  const items = [];
  const seenKeys = new Set();

  for (const config of installedConfigs) {
    const addonKey = normalizeAddonKey(config.addonKey);
    const definition = defByKey.get(addonKey);
    if (!definition) continue;

    const entry = findAddonSubscriptionEntry(subscription, addonKey);
    const pricing = await getAddonPricing(addonKey);
    items.push(buildLineItem({ addonKey, definition, config, entry, pricing }));
    seenKeys.add(addonKey);
  }

  for (const entry of subscription?.addons || []) {
    const addonKey = normalizeAddonKey(entry?.addonKey);
    if (!addonKey || seenKeys.has(addonKey)) continue;

    const definition = defByKey.get(addonKey);
    if (!definition) continue;

    const config = installedConfigs.find((row) => normalizeAddonKey(row.addonKey) === addonKey) || null;
    const pricing = await getAddonPricing(addonKey);
    items.push(buildLineItem({ addonKey, definition, config, entry, pricing }));
    seenKeys.add(addonKey);
  }

  return items;
}

module.exports = {
  buildAddonSubscriptionLineItems,
};
