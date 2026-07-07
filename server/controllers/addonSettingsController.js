const AddonDefinition = require('../models/AddonDefinition');
const TenantAddonConfiguration = require('../models/TenantAddonConfiguration');
const OrganizationSubscription = require('../models/OrganizationSubscription');
const Organization = require('../models/Organization');
const { normalizeAddonKey, isValidAddonKey } = require('../constants/addonKeys');
const {
  getTenantAddonConfiguration,
  findAddonSubscriptionEntry,
  isAddonInstalledForOrg,
} = require('../utils/addonAccessUtils');
const { getAddonPricing } = require('../services/addonPricingService');
const { ensureSubscriptionForAddon } = require('../services/addonBootstrapService');
const {
  getWidgetSettings,
  updateWidgetSettings,
  ensureEmbedPublicKey,
} = require('../services/liveChatWidgetService');
const { updateSessionFieldSettings, getSessionFieldConfigForViewer } = require('../services/liveChatSessionFieldConfigService');
const { assertLiveChatUninstallAllowed } = require('../services/liveChatUninstallGuard');
const {
  listOutcomesForOrganization,
  updateCustomOutcomes,
} = require('../services/liveChatOutcomeService');
const { ADDON_KEYS } = require('../constants/addonKeys');
const { purchaseEmailCreditPack } = require('../services/emailCreditPackService');
const {
  getOrgEmailPolicy,
  serializeOrgEmailPolicy,
  ensureOrgEmailPolicy
} = require('../services/orgEmailPolicyService');
const { isParentAppEntitledForOrg } = require('../services/addonParentAppService');
const {
  getArticlesAddonSettings,
  updateArticlesAddonSettings,
} = require('../services/contentStudio/articlesAddonSettingsService');

function canManageAddons(req) {
  if (req.user?.isOwner) return true;
  const role = String(req.user?.role || '').toLowerCase();
  if (role === 'admin' || role === 'owner') return true;
  const settings = req.user?.permissions?.settings || {};
  return Boolean(settings.edit || settings.manageBilling);
}

function mapCatalogItem(definition, tenantConfig, subscriptionEntry, pricing, emailPolicy, installEligibility) {
  const normalized = normalizeAddonKey(definition.addonKey);
  const installed = !!tenantConfig;
  let status = 'AVAILABLE';
  if (installed) {
    if (tenantConfig.enabled === false) status = 'DISABLED';
    else if (tenantConfig.archivedAt) status = 'ARCHIVED';
    else if (subscriptionEntry) status = String(subscriptionEntry.status || 'ACTIVE').toUpperCase();
    else status = 'INSTALLED';
  }

  return {
    addonKey: normalized,
    name: definition.name,
    description: definition.description || definition.marketplace?.shortDescription || '',
    category: definition.category,
    icon: definition.icon,
    requiredApps: definition.requiredApps || [],
    optionalApps: definition.optionalApps || [],
    marketplace: definition.marketplace || {},
    installed,
    installEligible: installEligibility?.eligible !== false,
    installBlockReason: installEligibility?.reason || null,
    missingApps: installEligibility?.missingApps || [],
    status,
    enabled: tenantConfig?.enabled !== false,
    subscription: subscriptionEntry
      ? {
          planKey: subscriptionEntry.planKey,
          status: subscriptionEntry.status,
          trialEndsAt: subscriptionEntry.trialEndsAt,
          agentLimit: subscriptionEntry.agentLimit,
          agentsUsed: subscriptionEntry.agentsUsed ?? 0,
          startedAt: subscriptionEntry.startedAt,
        }
      : null,
    pricing: pricing
      ? {
          billingType: pricing.billingType,
          defaultPlan: pricing.defaultPlan,
          trialDays: pricing.trialDays,
          plans: pricing.plans,
          creditPacks: pricing.creditPacks || [],
        }
      : null,
    emailPolicy:
      normalized === ADDON_KEYS.EMAIL_CREDITS && emailPolicy
        ? serializeOrgEmailPolicy(emailPolicy)
        : null,
  };
}

async function resolveInstallEligibility(organizationId, definition) {
  const requiredApps = Array.isArray(definition?.requiredApps) ? definition.requiredApps : [];
  if (requiredApps.length === 0) {
    return { eligible: true };
  }

  const missingApps = [];
  for (const appKey of requiredApps) {
    const entitled = await isParentAppEntitledForOrg(organizationId, appKey);
    if (!entitled) {
      missingApps.push(appKey);
    }
  }

  if (missingApps.length > 0) {
    return {
      eligible: false,
      reason: `Requires app entitlement: ${missingApps.join(', ')}`,
      missingApps,
    };
  }

  return { eligible: true };
}

exports.listAddons = async (req, res) => {
  try {
    if (!canManageAddons(req)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions', code: 'FORBIDDEN' });
    }

    const organizationId = req.user.organizationId;
    const definitions = await AddonDefinition.find({ enabled: true }).sort({ order: 1, name: 1 }).lean();
    const subscription = await OrganizationSubscription.findOne({ organizationId }).lean();
    const tenantConfigs = await TenantAddonConfiguration.find({ organizationId }).lean();
    const configByKey = new Map(tenantConfigs.map((row) => [normalizeAddonKey(row.addonKey), row]));
    let emailPolicy = null;

    const addons = [];
    for (const definition of definitions) {
      const normalized = normalizeAddonKey(definition.addonKey);
      const pricing = await getAddonPricing(normalized);
      const tenantConfig = configByKey.get(normalized) || null;
      const subscriptionEntry = findAddonSubscriptionEntry(subscription, normalized);
      if (normalized === ADDON_KEYS.EMAIL_CREDITS) {
        emailPolicy = await getOrgEmailPolicy(organizationId);
      }
      const installEligibility = await resolveInstallEligibility(organizationId, definition);
      addons.push(
        mapCatalogItem(
          definition,
          tenantConfig,
          subscriptionEntry,
          pricing,
          emailPolicy,
          installEligibility,
        ),
      );
    }

    const installed = addons.filter((row) => row.installed);
    const catalog = addons.filter((row) => !row.installed);

    return res.json({
      success: true,
      addons,
      installed,
      catalog,
    });
  } catch (error) {
    console.error('[addonSettingsController] listAddons', error);
    return res.status(500).json({ success: false, message: 'Failed to list addons' });
  }
};

exports.getAddon = async (req, res) => {
  try {
    if (!canManageAddons(req)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions', code: 'FORBIDDEN' });
    }

    const addonKey = normalizeAddonKey(req.params.addonKey);
    if (!isValidAddonKey(addonKey)) {
      return res.status(400).json({ success: false, message: 'Invalid addon key', code: 'INVALID_ADDON' });
    }

    const definition = await AddonDefinition.findOne({ addonKey, enabled: true }).lean();
    if (!definition) {
      return res.status(404).json({ success: false, message: 'Addon not found', code: 'ADDON_NOT_FOUND' });
    }

    const organizationId = req.user.organizationId;
    const tenantConfig = await getTenantAddonConfiguration(organizationId, addonKey);
    const subscription = await OrganizationSubscription.findOne({ organizationId }).lean();
    const subscriptionEntry = findAddonSubscriptionEntry(subscription, addonKey);
    const pricing = await getAddonPricing(addonKey);
    let emailPolicy = null;
    if (addonKey === ADDON_KEYS.EMAIL_CREDITS) {
      emailPolicy = await getOrgEmailPolicy(organizationId);
    }
    const installEligibility = await resolveInstallEligibility(organizationId, definition);

    return res.json({
      success: true,
      addon: mapCatalogItem(
        definition,
        tenantConfig,
        subscriptionEntry,
        pricing,
        emailPolicy,
        installEligibility,
      ),
      configuration: tenantConfig,
    });
  } catch (error) {
    console.error('[addonSettingsController] getAddon', error);
    return res.status(500).json({ success: false, message: 'Failed to load addon' });
  }
};

exports.installAddon = async (req, res) => {
  try {
    if (!canManageAddons(req)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions', code: 'FORBIDDEN' });
    }

    const addonKey = normalizeAddonKey(req.params.addonKey);
    if (!isValidAddonKey(addonKey)) {
      return res.status(400).json({ success: false, message: 'Invalid addon key', code: 'INVALID_ADDON' });
    }

    const organizationId = req.user.organizationId;
    if (await isAddonInstalledForOrg(organizationId, addonKey)) {
      return res.json({
        success: true,
        message: 'Addon is already installed',
        code: 'ADDON_ALREADY_INSTALLED',
      });
    }

    const definition = await AddonDefinition.findOne({ addonKey, enabled: true }).lean();
    if (!definition) {
      return res.status(404).json({ success: false, message: 'Addon not found', code: 'ADDON_NOT_FOUND' });
    }

    const installEligibility = await resolveInstallEligibility(organizationId, definition);
    if (!installEligibility.eligible) {
      return res.status(403).json({
        success: false,
        message: installEligibility.reason,
        code: 'PARENT_APP_REQUIRED',
        missingApps: installEligibility.missingApps,
      });
    }

    const result = await ensureSubscriptionForAddon({
      organizationId,
      addonKey,
      initiatedByUserId: req.user._id,
    });

    if (result.error) {
      return res.status(400).json({
        success: false,
        message: result.error,
        code: result.code || 'INSTALL_FAILED',
        missingApps: result.missingApps,
      });
    }

    if (addonKey === ADDON_KEYS.LIVE_CHAT) {
      await ensureEmbedPublicKey(organizationId);
      await Organization.updateOne(
        { _id: organizationId },
        { $set: { 'embed.chat.enabled': true } },
      );
    }

    if (addonKey === ADDON_KEYS.EMAIL_CREDITS) {
      await ensureOrgEmailPolicy(organizationId);
    }

    return res.status(201).json({
      success: true,
      message: 'Addon installed',
      subscription: result.subscription,
      configuration: result.configuration,
    });
  } catch (error) {
    console.error('[addonSettingsController] installAddon', error);
    return res.status(500).json({ success: false, message: 'Failed to install addon' });
  }
};

exports.disableAddon = async (req, res) => {
  try {
    if (!canManageAddons(req)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions', code: 'FORBIDDEN' });
    }

    const addonKey = normalizeAddonKey(req.params.addonKey);
    const config = await TenantAddonConfiguration.findOne({
      organizationId: req.user.organizationId,
      addonKey,
    });

    if (!config) {
      return res.status(404).json({ success: false, message: 'Addon is not installed', code: 'NOT_INSTALLED' });
    }

    config.enabled = false;
    config.disabledAt = new Date();
    await config.save();

    if (addonKey === ADDON_KEYS.LIVE_CHAT) {
      await Organization.updateOne(
        { _id: req.user.organizationId },
        { $set: { 'embed.chat.enabled': false } },
      );
    }

    return res.json({ success: true, message: 'Addon disabled' });
  } catch (error) {
    console.error('[addonSettingsController] disableAddon', error);
    return res.status(500).json({ success: false, message: 'Failed to disable addon' });
  }
};

exports.enableAddon = async (req, res) => {
  try {
    if (!canManageAddons(req)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions', code: 'FORBIDDEN' });
    }

    const addonKey = normalizeAddonKey(req.params.addonKey);
    const config = await TenantAddonConfiguration.findOne({
      organizationId: req.user.organizationId,
      addonKey,
    });

    if (!config) {
      return res.status(404).json({ success: false, message: 'Addon is not installed', code: 'NOT_INSTALLED' });
    }

    config.enabled = true;
    config.disabledAt = null;
    await config.save();

    if (addonKey === ADDON_KEYS.LIVE_CHAT) {
      await ensureEmbedPublicKey(req.user.organizationId);
      await Organization.updateOne(
        { _id: req.user.organizationId },
        { $set: { 'embed.chat.enabled': true } },
      );
    }

    return res.json({ success: true, message: 'Addon enabled' });
  } catch (error) {
    console.error('[addonSettingsController] enableAddon', error);
    return res.status(500).json({ success: false, message: 'Failed to enable addon' });
  }
};

exports.archiveAddon = async (req, res) => {
  try {
    if (!canManageAddons(req)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions', code: 'FORBIDDEN' });
    }

    const addonKey = normalizeAddonKey(req.params.addonKey);
    const organizationId = req.user.organizationId;

    const config = await TenantAddonConfiguration.findOne({ organizationId, addonKey });
    if (!config) {
      return res.status(404).json({ success: false, message: 'Addon is not installed', code: 'NOT_INSTALLED' });
    }

    config.enabled = false;
    config.archivedAt = new Date();
    config.disabledAt = new Date();
    await config.save();

    if (addonKey === ADDON_KEYS.LIVE_CHAT) {
      await Organization.updateOne(
        { _id: organizationId },
        { $set: { 'embed.chat.enabled': false } },
      );
    }

    const subscription = await OrganizationSubscription.findOne({ organizationId });
    const entry = findAddonSubscriptionEntry(subscription, addonKey);
    if (entry) {
      entry.status = 'ARCHIVED';
      await subscription.save();
    }

    return res.json({ success: true, message: 'Addon archived' });
  } catch (error) {
    console.error('[addonSettingsController] archiveAddon', error);
    return res.status(500).json({ success: false, message: 'Failed to archive addon' });
  }
};

exports.uninstallAddon = async (req, res) => {
  try {
    if (!canManageAddons(req)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions', code: 'FORBIDDEN' });
    }

    const addonKey = normalizeAddonKey(req.params.addonKey);
    const organizationId = req.user.organizationId;

    const config = await TenantAddonConfiguration.findOne({ organizationId, addonKey });
    if (!config) {
      return res.status(404).json({ success: false, message: 'Addon is not installed', code: 'NOT_INSTALLED' });
    }

    if (addonKey === ADDON_KEYS.LIVE_CHAT) {
      await assertLiveChatUninstallAllowed(organizationId);
    }

    await TenantAddonConfiguration.deleteOne({ _id: config._id });

    const subscription = await OrganizationSubscription.findOne({ organizationId });
    if (subscription?.addons?.length) {
      subscription.addons = subscription.addons.filter(
        (row) => normalizeAddonKey(row.addonKey) !== addonKey,
      );
      await subscription.save();
    }

    if (addonKey === ADDON_KEYS.LIVE_CHAT) {
      await Organization.updateOne(
        { _id: organizationId },
        { $set: { 'embed.chat.enabled': false } },
      );
    }

    return res.json({ success: true, message: 'Addon uninstalled' });
  } catch (error) {
    const status = error.statusCode || 500;
    if (status !== 500) {
      return res.status(status).json({
        success: false,
        message: error.message,
        code: error.code,
        linkedSessionCount: error.linkedSessionCount,
      });
    }
    console.error('[addonSettingsController] uninstallAddon', error);
    return res.status(500).json({ success: false, message: 'Failed to uninstall addon' });
  }
};

exports.getLiveChatWidgetSettings = async (req, res) => {
  try {
    if (!canManageAddons(req)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions', code: 'FORBIDDEN' });
    }

    const widget = await getWidgetSettings(req.user.organizationId);
    return res.json({ success: true, widget });
  } catch (error) {
    console.error('[addonSettingsController] getLiveChatWidgetSettings', error);
    return res.status(500).json({ success: false, message: 'Failed to load Live Chat widget settings' });
  }
};

exports.updateLiveChatWidgetSettings = async (req, res) => {
  try {
    if (!canManageAddons(req)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions', code: 'FORBIDDEN' });
    }

    const widget = await updateWidgetSettings(req.user.organizationId, req.body || {});
    return res.json({ success: true, widget });
  } catch (error) {
    const status = error.statusCode || 500;
    if (status !== 500) {
      return res.status(status).json({
        success: false,
        message: error.message,
        code: error.code || 'UPDATE_FAILED',
      });
    }
    console.error('[addonSettingsController] updateLiveChatWidgetSettings', error);
    return res.status(500).json({ success: false, message: 'Failed to update Live Chat widget settings' });
  }
};

exports.getLiveChatOutcomeSettings = async (req, res) => {
  try {
    if (!canManageAddons(req)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions', code: 'FORBIDDEN' });
    }

    const outcomes = await listOutcomesForOrganization(req.user.organizationId);
    return res.json({ success: true, outcomes });
  } catch (error) {
    console.error('[addonSettingsController] getLiveChatOutcomeSettings', error);
    return res.status(500).json({ success: false, message: 'Failed to load Live Chat outcomes' });
  }
};

exports.updateLiveChatOutcomeSettings = async (req, res) => {
  try {
    if (!canManageAddons(req)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions', code: 'FORBIDDEN' });
    }

    const customOutcomes = Array.isArray(req.body?.customOutcomes) ? req.body.customOutcomes : [];
    const outcomes = await updateCustomOutcomes(req.user.organizationId, customOutcomes);
    return res.json({ success: true, outcomes });
  } catch (error) {
    const status = error.statusCode || 500;
    if (status !== 500) {
      return res.status(status).json({
        success: false,
        message: error.message,
        code: error.code || 'UPDATE_FAILED',
      });
    }
    console.error('[addonSettingsController] updateLiveChatOutcomeSettings', error);
    return res.status(500).json({ success: false, message: 'Failed to update Live Chat outcomes' });
  }
};

exports.getLiveChatSessionFieldSettings = async (req, res) => {
  try {
    if (!canManageAddons(req)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions', code: 'FORBIDDEN' });
    }

    const data = await getSessionFieldConfigForViewer({
      organizationId: req.user.organizationId,
      isAdmin: true,
    });
    return res.json({ success: true, data });
  } catch (error) {
    console.error('[addonSettingsController] getLiveChatSessionFieldSettings', error);
    return res.status(500).json({ success: false, message: 'Failed to load session field settings' });
  }
};

exports.updateLiveChatSessionFieldSettings = async (req, res) => {
  try {
    if (!canManageAddons(req)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions', code: 'FORBIDDEN' });
    }

    const data = await updateSessionFieldSettings(req.user.organizationId, req.body || {});
    return res.json({ success: true, data });
  } catch (error) {
    const status = error.statusCode || 500;
    if (status !== 500) {
      return res.status(status).json({
        success: false,
        message: error.message,
        code: error.code || 'UPDATE_FAILED',
      });
    }
    console.error('[addonSettingsController] updateLiveChatSessionFieldSettings', error);
    return res.status(500).json({ success: false, message: 'Failed to update session field settings' });
  }
};

exports.purchaseEmailCreditPack = async (req, res) => {
  try {
    if (!canManageAddons(req)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions', code: 'FORBIDDEN' });
    }

    const packKey = String(req.body?.packKey || '').trim();
    if (!packKey) {
      return res.status(400).json({ success: false, message: 'packKey is required', code: 'INVALID_PACK' });
    }

    const result = await purchaseEmailCreditPack({
      organizationId: req.user.organizationId,
      packKey,
      initiatedByUserId: req.user._id
    });

    return res.status(201).json({
      success: true,
      message: 'Credit pack purchased',
      data: result
    });
  } catch (error) {
    const code = error?.code;
    if (code === 'ADDON_NOT_INSTALLED') {
      return res.status(404).json({ success: false, message: error.message, code });
    }
    if (code === 'INVALID_PACK' || code === 'PRICING_NOT_FOUND') {
      return res.status(400).json({ success: false, message: error.message, code });
    }
    console.error('[addonSettingsController] purchaseEmailCreditPack', error);
    return res.status(500).json({ success: false, message: 'Failed to purchase credit pack' });
  }
};

exports.getArticlesAddonSettings = async (req, res) => {
  try {
    if (!canManageAddons(req)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions', code: 'FORBIDDEN' });
    }

    const { getArticlesAddonSettings, resolveRequestPublicOrigin } = require('../services/contentStudio/articlesAddonSettingsService');
    const data = await getArticlesAddonSettings(req.user.organizationId, {
      requestOrigin: resolveRequestPublicOrigin(req),
    });
    return res.json({ success: true, ...data });
  } catch (error) {
    console.error('[addonSettingsController] getArticlesAddonSettings', error);
    return res.status(500).json({ success: false, message: 'Failed to load Articles settings' });
  }
};

exports.updateArticlesAddonSettings = async (req, res) => {
  try {
    if (!canManageAddons(req)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions', code: 'FORBIDDEN' });
    }

    const {
      updateArticlesAddonSettings,
      resolveRequestPublicOrigin,
    } = require('../services/contentStudio/articlesAddonSettingsService');
    const data = await updateArticlesAddonSettings(req.user.organizationId, req.body || {}, {
      requestOrigin: resolveRequestPublicOrigin(req),
    });
    return res.json({ success: true, ...data });
  } catch (error) {
    if (error?.code === 'ADDON_NOT_INSTALLED') {
      return res.status(404).json({ success: false, message: error.message, code: error.code });
    }
    console.error('[addonSettingsController] updateArticlesAddonSettings', error);
    return res.status(500).json({ success: false, message: 'Failed to save Articles settings' });
  }
};

exports.sendArticlesPublishWebhookTest = async (req, res) => {
  try {
    if (!canManageAddons(req)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions', code: 'FORBIDDEN' });
    }

    const { sendArticlesPublishWebhookTest } = require('../services/contentStudio/contentPublishingWebhookService');
    const payload = await sendArticlesPublishWebhookTest(req.user.organizationId);
    return res.json({ success: true, payload });
  } catch (error) {
    if (error?.code === 'WEBHOOK_NOT_CONFIGURED') {
      return res.status(400).json({ success: false, message: error.message, code: error.code });
    }
    console.error('[addonSettingsController] sendArticlesPublishWebhookTest', error);
    return res.status(502).json({
      success: false,
      message: error?.message || 'Failed to deliver test webhook',
      code: 'WEBHOOK_DELIVERY_FAILED',
    });
  }
};

