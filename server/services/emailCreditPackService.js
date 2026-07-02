'use strict';

const { ADDON_KEYS, normalizeAddonKey } = require('../constants/addonKeys');
const { findCreditPack } = require('../constants/emailCreditPackConstants');
const { getAddonPricing } = require('./addonPricingService');
const { isAddonInstalledForOrg } = require('../utils/addonAccessUtils');
const { onCreditPackPurchased } = require('./billing/email-credits');
const {
  ensureOrgEmailPolicy,
  getOrgEmailPolicy,
  serializeOrgEmailPolicy
} = require('./orgEmailPolicyService');

/**
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @param {string} packKey
 * @param {import('mongoose').Types.ObjectId|string} [initiatedByUserId]
 */
async function purchaseEmailCreditPack({ organizationId, packKey, initiatedByUserId }) {
  const addonKey = ADDON_KEYS.EMAIL_CREDITS;
  const installed = await isAddonInstalledForOrg(organizationId, addonKey);
  if (!installed) {
    const error = new Error('Email credit packs addon is not installed');
    error.code = 'ADDON_NOT_INSTALLED';
    throw error;
  }

  const pricing = await getAddonPricing(addonKey);
  if (!pricing) {
    const error = new Error('Email credit pack pricing is not configured');
    error.code = 'PRICING_NOT_FOUND';
    throw error;
  }

  const pack = findCreditPack(pricing.creditPacks, packKey);
  if (!pack) {
    const error = new Error('Invalid credit pack');
    error.code = 'INVALID_PACK';
    throw error;
  }

  await ensureOrgEmailPolicy(organizationId);
  await onCreditPackPurchased(organizationId, pack.credits);

  const policy = await getOrgEmailPolicy(organizationId);

  return {
    packKey: pack.packKey,
    creditsAdded: pack.credits,
    priceCents: pack.priceCents,
    currency: pack.currency,
    initiatedByUserId: initiatedByUserId || null,
    policy: serializeOrgEmailPolicy(policy)
  };
}

module.exports = {
  purchaseEmailCreditPack
};
