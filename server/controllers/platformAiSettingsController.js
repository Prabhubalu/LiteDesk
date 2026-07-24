'use strict';

const {
  getAdminPlatformAiConfig,
  updateAdminPlatformAiConfig,
} = require('../services/ai/platformAiConfigService');
const AddonPricingDefinition = require('../models/AddonPricingDefinition');
const addonPricingRegistry = require('../constants/addonPricingRegistry');
const { ADDON_KEYS } = require('../constants/addonKeys');
const {
  getAddonPricing,
  normalizePacksForAddon,
  normalizePricingShape,
} = require('../services/addonPricingService');

async function getAiTokenPacks() {
  const pricing = await getAddonPricing(ADDON_KEYS.AI_CREDITS);
  return Array.isArray(pricing?.creditPacks) ? pricing.creditPacks : [];
}

async function saveAiTokenPacks({ creditPacks, updatedByUserId }) {
  const addonKey = ADDON_KEYS.AI_CREDITS;
  const fallback = addonPricingRegistry[addonKey] || {};
  const packs = normalizePacksForAddon(addonKey, creditPacks);
  const row = await AddonPricingDefinition.findOneAndUpdate(
    { addonKey },
    {
      addonKey,
      billingType: fallback.billingType || 'USAGE',
      defaultPlan: fallback.defaultPlan || 'BASIC',
      trialDays: fallback.trialDays ?? 0,
      plans: fallback.plans || {},
      creditPacks: packs,
      enabled: true,
      updatedBy: updatedByUserId || null,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
  return normalizePricingShape({ ...row, source: 'master' }, addonKey).creditPacks;
}

async function getConfig(req, res) {
  try {
    const data = await getAdminPlatformAiConfig();
    const tokenPacks = await getAiTokenPacks();
    return res.json({ success: true, data: { ...data, tokenPacks } });
  } catch (err) {
    console.error('[platformAiSettings] getConfig:', err);
    return res.status(500).json({ success: false, message: 'Failed to load platform AI configuration' });
  }
}

async function updateConfig(req, res) {
  try {
    const { defaultLlmProvider, defaultLlmModel, apiKeys, tokenPacks } = req.body || {};
    const data = await updateAdminPlatformAiConfig({
      defaultLlmProvider,
      defaultLlmModel,
      apiKeys,
      updatedByUserId: req.user?._id || null,
    });

    let savedPacks;
    if (tokenPacks !== undefined) {
      savedPacks = await saveAiTokenPacks({
        creditPacks: tokenPacks,
        updatedByUserId: req.user?._id || null,
      });
    } else {
      savedPacks = await getAiTokenPacks();
    }

    return res.json({ success: true, data: { ...data, tokenPacks: savedPacks } });
  } catch (err) {
    console.error('[platformAiSettings] updateConfig:', err);
    const status = err?.code === 'AI_PROVIDER_INVALID' ? 400 : 500;
    return res.status(status).json({
      success: false,
      message: err?.message || 'Failed to save platform AI configuration',
      code: err?.code || undefined,
    });
  }
}

module.exports = {
  getConfig,
  updateConfig,
};
