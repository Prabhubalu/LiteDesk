'use strict';

const Organization = require('../models/Organization');
const { ADDON_KEYS } = require('../constants/addonKeys');
const { findAiTokenPack } = require('../constants/aiCreditPackConstants');
const { getAddonPricing } = require('./addonPricingService');
const { isAddonInstalledForOrg } = require('../utils/addonAccessUtils');

/**
 * Purchase an AI token pack (platform-metered tokens).
 * @param {{ organizationId: string, packKey: string, initiatedByUserId?: string|null }} params
 */
async function purchaseAiCreditPack({ organizationId, packKey, initiatedByUserId }) {
  const addonKey = ADDON_KEYS.AI_CREDITS;
  const installed = await isAddonInstalledForOrg(organizationId, addonKey);
  if (!installed) {
    const error = new Error('AI token packs addon is not installed');
    error.code = 'ADDON_NOT_INSTALLED';
    throw error;
  }

  const pricing = await getAddonPricing(addonKey);
  if (!pricing) {
    const error = new Error('AI token pack pricing is not configured');
    error.code = 'PRICING_NOT_FOUND';
    throw error;
  }

  const pack = findAiTokenPack(pricing.creditPacks, packKey);
  if (!pack) {
    const error = new Error('Invalid AI token pack');
    error.code = 'INVALID_PACK';
    throw error;
  }

  const tokens = Math.max(0, Math.floor(Number(pack.tokens) || 0));
  if (tokens <= 0) {
    const error = new Error('Invalid AI token pack');
    error.code = 'INVALID_PACK';
    throw error;
  }

  const { ensureTokenLedger } = require('./ai/aiCreditService');
  await ensureTokenLedger(organizationId);

  const updated = await Organization.findOneAndUpdate(
    { _id: organizationId },
    {
      $inc: {
        'aiSettings.credits.balance': tokens,
        'aiSettings.credits.grantedTotal': tokens,
      },
      $set: {
        'aiSettings.credits.ledgerUnit': 'tokens',
      },
      $setOnInsert: {
        'aiSettings.keyMode': 'platform',
      },
    },
    { new: true }
  ).select('aiSettings.credits');

  if (!updated) {
    const error = new Error('Organization not found');
    error.code = 'ORGANIZATION_NOT_FOUND';
    throw error;
  }

  const balance = Math.max(0, Math.floor(Number(updated.aiSettings?.credits?.balance || 0)));
  const granted = Math.max(
    balance,
    Math.floor(Number(updated.aiSettings?.credits?.grantedTotal || 0)),
  );

  return {
    packKey: pack.packKey,
    tokensAdded: tokens,
    priceCents: pack.priceCents,
    currency: pack.currency,
    tokensBalance: balance,
    tokensAvailable: balance,
    tokensGranted: granted,
    tokensConsumed: Math.max(0, granted - balance),
    initiatedByUserId: initiatedByUserId || null,
  };
}

module.exports = {
  purchaseAiCreditPack,
};
