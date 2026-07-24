const AddonPricingDefinition = require('../models/AddonPricingDefinition');
const AddonDefinition = require('../models/AddonDefinition');
const addonPricingRegistry = require('../constants/addonPricingRegistry');
const { normalizeAddonKey, isValidAddonKey } = require('../constants/addonKeys');
const { getAddonPricing, normalizePricingShape, normalizePacksForAddon } = require('../services/addonPricingService');

function sanitizePlansInput(plans) {
  if (!plans || typeof plans !== 'object') return null;
  const keys = ['BASIC', 'PRO', 'ENTERPRISE'];
  const next = {};
  for (const key of keys) {
    const row = plans[key];
    if (!row || typeof row !== 'object') continue;
    next[key] = {
      agentLimit: row.agentLimit === null || row.agentLimit === undefined
        ? null
        : Number(row.agentLimit),
      pricePerAgentCents: row.pricePerAgentCents === null || row.pricePerAgentCents === undefined
        ? null
        : Number(row.pricePerAgentCents),
      flatPriceCents: row.flatPriceCents === null || row.flatPriceCents === undefined
        ? null
        : Number(row.flatPriceCents),
      currency: String(row.currency || 'USD').trim().toUpperCase(),
    };
  }
  return next;
}

exports.listAddonPricing = async (req, res) => {
  try {
    const definitions = await AddonDefinition.find({ enabled: true }).sort({ order: 1 }).lean();
    const rows = await Promise.all(
      definitions.map(async (def) => getAddonPricing(def.addonKey)),
    );
    return res.json({
      success: true,
      pricing: rows.filter(Boolean),
    });
  } catch (error) {
    console.error('[addonPricingAdminController] listAddonPricing', error);
    return res.status(500).json({ success: false, message: 'Failed to list addon pricing' });
  }
};

exports.getAddonPricing = async (req, res) => {
  try {
    const addonKey = normalizeAddonKey(req.params.addonKey);
    if (!isValidAddonKey(addonKey)) {
      return res.status(400).json({ success: false, message: 'Invalid addon key', code: 'INVALID_ADDON' });
    }

    const pricing = await getAddonPricing(addonKey);
    if (!pricing) {
      return res.status(404).json({ success: false, message: 'Pricing not found', code: 'NOT_FOUND' });
    }

    return res.json({ success: true, pricing });
  } catch (error) {
    console.error('[addonPricingAdminController] getAddonPricing', error);
    return res.status(500).json({ success: false, message: 'Failed to load addon pricing' });
  }
};

exports.upsertAddonPricing = async (req, res) => {
  try {
    const addonKey = normalizeAddonKey(req.params.addonKey);
    if (!isValidAddonKey(addonKey)) {
      return res.status(400).json({ success: false, message: 'Invalid addon key', code: 'INVALID_ADDON' });
    }

    const definition = await AddonDefinition.findOne({ addonKey }).lean();
    if (!definition) {
      return res.status(404).json({ success: false, message: 'Addon definition not found', code: 'ADDON_NOT_FOUND' });
    }

    const body = req.body || {};
    const fallback = addonPricingRegistry[addonKey] || {};
    const billingType = body.billingType || fallback.billingType || 'PER_AGENT';
    const defaultPlan = body.defaultPlan || fallback.defaultPlan || 'BASIC';
    const trialDays = body.trialDays ?? fallback.trialDays ?? 14;
    const plans = sanitizePlansInput(body.plans) || fallback.plans;
    const creditPacks = body.creditPacks !== undefined
      ? normalizePacksForAddon(addonKey, body.creditPacks)
      : undefined;

    const update = {
      addonKey,
      billingType,
      defaultPlan,
      trialDays: Math.max(0, Number(trialDays) || 0),
      plans,
      enabled: body.enabled !== false,
      updatedBy: req.user._id,
    };
    if (creditPacks !== undefined) {
      update.creditPacks = creditPacks;
    }

    const row = await AddonPricingDefinition.findOneAndUpdate(
      { addonKey },
      update,
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();

    return res.json({
      success: true,
      pricing: normalizePricingShape({ ...row, source: 'master' }, addonKey),
    });
  } catch (error) {
    console.error('[addonPricingAdminController] upsertAddonPricing', error);
    return res.status(500).json({ success: false, message: 'Failed to save addon pricing' });
  }
};
