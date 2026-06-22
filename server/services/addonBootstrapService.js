const OrganizationSubscription = require('../models/OrganizationSubscription');
const TenantAddonConfiguration = require('../models/TenantAddonConfiguration');
const { normalizeAddonKey, isValidAddonKey } = require('../constants/addonKeys');
const { getAddonDefinition, findAddonSubscriptionEntry } = require('../utils/addonAccessUtils');
const { getAddonPricing, getAgentLimitForPlan } = require('../services/addonPricingService');
const { isInternalOrganization } = require('../utils/internalOrganization');
const { ADDON_KEYS } = require('../constants/addonKeys');
const {
  seedLiveChatRolesForOrganization,
  patchLiveChatPermissionsOnOrganizationRoles,
} = require('./liveChatRoleSeedService');
const { backfillLiveChatUserPermissions } = require('./liveChatPermissionBackfillService');
const { runWithOrganizationTenantContext } = require('../utils/runWithOrganizationTenant');
const { ensureDefaultQueue } = require('./liveChatQueueService');
const { seedLiveChatProcessRecipesForOrganization } = require('./liveChatProcessRecipeSeedService');
const {
  seedDefaultLiveChatAssignmentRulesForOrganization,
} = require('./liveChatAssignmentRuleSeedService');

const ENTERPRISE_PLAN_KEY = 'ENTERPRISE';

function buildEnterpriseAddonSubscription(addonKey) {
  return {
    addonKey: normalizeAddonKey(addonKey),
    planKey: ENTERPRISE_PLAN_KEY,
    agentLimit: null,
    agentsUsed: 0,
    status: 'ACTIVE',
    trialEndsAt: null,
    startedAt: new Date(),
    installedBy: null,
  };
}

/**
 * Provision trial/active addon entitlement + tenant configuration on install.
 */
async function ensureSubscriptionForAddon({ organizationId, addonKey, initiatedByUserId }) {
  try {
    const normalized = normalizeAddonKey(addonKey);
    if (!isValidAddonKey(normalized)) {
      return { created: false, subscription: null, error: 'INVALID_ADDON' };
    }

    const definition = await getAddonDefinition(normalized);
    if (!definition) {
      return { created: false, subscription: null, error: 'ADDON_NOT_FOUND' };
    }

    const pricing = await getAddonPricing(normalized);
    if (!pricing) {
      return { created: false, subscription: null, error: 'PRICING_NOT_FOUND' };
    }

    let subscription = await OrganizationSubscription.findOne({ organizationId });
    if (!subscription) {
      subscription = await OrganizationSubscription.create({
        organizationId,
        apps: [],
        addons: [],
      });
    }

    const internal = await isInternalOrganization(organizationId);
    let existing = findAddonSubscriptionEntry(subscription, normalized);
    let subscriptionCreated = false;

    if (!existing) {
      if (internal) {
        existing = buildEnterpriseAddonSubscription(normalized);
        existing.installedBy = initiatedByUserId || null;
      } else {
        const planKey = pricing.defaultPlan || 'BASIC';
        const trialDays = pricing.trialDays ?? 14;
        const trialEndsAt = trialDays > 0
          ? new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000)
          : null;

        existing = {
          addonKey: normalized,
          planKey,
          agentLimit: getAgentLimitForPlan(pricing, planKey),
          agentsUsed: 0,
          status: trialDays > 0 ? 'TRIAL' : 'ACTIVE',
          trialEndsAt,
          startedAt: new Date(),
          installedBy: initiatedByUserId || null,
        };
      }
      subscription.addons.push(existing);
      subscriptionCreated = true;
      await subscription.save();
    }

    let config = await TenantAddonConfiguration.findOne({
      organizationId,
      addonKey: normalized,
    });

    if (!config) {
      config = await TenantAddonConfiguration.create({
        organizationId,
        addonKey: normalized,
        enabled: true,
        settings: {},
        installedBy: initiatedByUserId || null,
        installedAt: new Date(),
      });
    } else if (config.archivedAt) {
      config.archivedAt = null;
      config.disabledAt = null;
      config.enabled = true;
      await config.save();
    }

    if (normalized === ADDON_KEYS.LIVE_CHAT) {
      await runWithOrganizationTenantContext(organizationId, async () => {
        await seedLiveChatRolesForOrganization(organizationId);
        await patchLiveChatPermissionsOnOrganizationRoles(organizationId);
        await backfillLiveChatUserPermissions(organizationId);
        await ensureDefaultQueue(organizationId);
        await seedLiveChatProcessRecipesForOrganization(organizationId, {
          initiatedByUserId: initiatedByUserId || null,
        });
        await seedDefaultLiveChatAssignmentRulesForOrganization(organizationId, {
          initiatedByUserId: initiatedByUserId || null,
        });
      });
    }

    return {
      created: subscriptionCreated,
      subscription: existing,
      configuration: config,
    };
  } catch (error) {
    console.error('[AddonBootstrap] ensureSubscriptionForAddon failed', {
      organizationId,
      addonKey,
      error: error.message,
    });
    return { created: false, subscription: null, error: error.message };
  }
}

module.exports = {
  ensureSubscriptionForAddon,
  buildEnterpriseAddonSubscription,
};
