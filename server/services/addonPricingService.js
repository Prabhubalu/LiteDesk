const AddonPricingDefinition = require('../models/AddonPricingDefinition');
const addonPricingRegistry = require('../constants/addonPricingRegistry');
const { normalizeAddonKey, ADDON_KEYS } = require('../constants/addonKeys');
const { normalizeCreditPacks } = require('../constants/emailCreditPackConstants');
const { normalizeAiTokenPacks } = require('../constants/aiCreditPackConstants');

function mergePlan(defaultPlan = {}, overridePlan = {}) {
  return {
    agentLimit: overridePlan.agentLimit ?? defaultPlan.agentLimit ?? null,
    pricePerAgentCents: overridePlan.pricePerAgentCents ?? defaultPlan.pricePerAgentCents ?? null,
    flatPriceCents: overridePlan.flatPriceCents ?? defaultPlan.flatPriceCents ?? null,
    currency: overridePlan.currency || defaultPlan.currency || 'USD',
  };
}

function normalizePacksForAddon(addonKey, packs) {
  const normalized = normalizeAddonKey(addonKey);
  if (normalized === ADDON_KEYS.AI_CREDITS) {
    return normalizeAiTokenPacks(packs);
  }
  return normalizeCreditPacks(packs);
}

function normalizePricingShape(raw, addonKey) {
  const fallback = addonPricingRegistry[normalizeAddonKey(addonKey)] || {};
  const billingType = raw?.billingType || fallback.billingType || 'PER_AGENT';
  const defaultPlan = raw?.defaultPlan || fallback.defaultPlan || 'BASIC';
  const trialDays = raw?.trialDays ?? fallback.trialDays ?? 14;
  const plans = {
    BASIC: mergePlan(fallback.plans?.BASIC, raw?.plans?.BASIC),
    PRO: mergePlan(fallback.plans?.PRO, raw?.plans?.PRO),
    ENTERPRISE: mergePlan(fallback.plans?.ENTERPRISE, raw?.plans?.ENTERPRISE),
  };
  return {
    addonKey: normalizeAddonKey(addonKey),
    billingType,
    defaultPlan,
    trialDays,
    plans,
    creditPacks: normalizePacksForAddon(addonKey, raw?.creditPacks ?? fallback.creditPacks),
    enabled: raw?.enabled !== false,
    source: raw?.source || 'registry',
  };
}

/**
 * Resolve effective pricing for an addon (DB override → code registry fallback).
 */
async function getAddonPricing(addonKey) {
  const normalized = normalizeAddonKey(addonKey);
  const fallback = addonPricingRegistry[normalized];
  if (!fallback) return null;

  try {
    const row = await AddonPricingDefinition.findOne({ addonKey: normalized }).lean();
    if (row) {
      return normalizePricingShape({ ...row, source: 'master' }, normalized);
    }
  } catch (err) {
    console.warn('[addonPricingService] Failed to load master pricing', {
      addonKey: normalized,
      error: err?.message,
    });
  }

  return normalizePricingShape(fallback, normalized);
}

async function listAddonPricing() {
  const keys = Object.keys(addonPricingRegistry);
  const rows = await Promise.all(keys.map((key) => getAddonPricing(key)));
  return rows.filter(Boolean);
}

function getAgentLimitForPlan(pricing, planKey) {
  if (!pricing) return null;
  if (pricing.billingType === 'FLAT' || pricing.billingType === 'PER_ORG') {
    return null;
  }
  const plan = pricing.plans?.[planKey];
  return plan?.agentLimit ?? null;
}

module.exports = {
  getAddonPricing,
  listAddonPricing,
  getAgentLimitForPlan,
  normalizePricingShape,
  normalizePacksForAddon,
};
