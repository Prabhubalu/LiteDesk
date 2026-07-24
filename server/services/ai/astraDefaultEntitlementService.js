'use strict';

/**
 * Fresh platform tenants get Arivu AI + a one-time 1M token starter pool.
 * Never re-grants (guarded by aiSettings.credits.starterGrantAt).
 */

const Organization = require('../../models/Organization');
const { ADDON_KEYS } = require('../../constants/addonKeys');
const { AI_PROVIDERS, AI_KEY_MODES } = require('../../constants/aiProviders');
const { FREE_STARTER_TOKENS } = require('../../constants/aiTokenConstants');
const { ensureSubscriptionForAddon } = require('../addonBootstrapService');

/**
 * @param {{ organizationId: string, initiatedByUserId?: string|null }} params
 */
async function provisionFreshTenantAstra({ organizationId, initiatedByUserId = null } = {}) {
  if (!organizationId) {
    return { granted: false, reason: 'missing_organization' };
  }

  const org = await Organization.findById(organizationId)
    .select('isTenant aiSettings.credits.starterGrantAt')
    .lean();

  if (!org) {
    return { granted: false, reason: 'organization_not_found' };
  }
  if (!org.isTenant) {
    return { granted: false, reason: 'not_tenant' };
  }
  if (org.aiSettings?.credits?.starterGrantAt) {
    return { granted: false, reason: 'already_granted' };
  }

  const addonResult = await ensureSubscriptionForAddon({
    organizationId,
    addonKey: ADDON_KEYS.AI,
    initiatedByUserId,
  });
  if (addonResult?.error) {
    console.warn('[astraDefaultEntitlement] AI addon install failed', {
      organizationId: String(organizationId),
      error: addonResult.error,
      code: addonResult.code,
    });
  }

  const now = new Date();
  const updated = await Organization.findOneAndUpdate(
    {
      _id: organizationId,
      isTenant: true,
      $or: [
        { 'aiSettings.credits.starterGrantAt': { $exists: false } },
        { 'aiSettings.credits.starterGrantAt': null },
      ],
    },
    {
      $set: {
        'aiSettings.enabled': true,
        'aiSettings.llmProvider': AI_PROVIDERS.ARIVU,
        'aiSettings.keyMode': AI_KEY_MODES.PLATFORM,
        'aiSettings.credits.balance': FREE_STARTER_TOKENS,
        'aiSettings.credits.grantedTotal': FREE_STARTER_TOKENS,
        'aiSettings.credits.ledgerUnit': 'tokens',
        'aiSettings.credits.starterGrantAt': now,
        'aiSettings.credits.starterGrantTokens': FREE_STARTER_TOKENS,
      },
    },
    { new: true }
  ).select('_id aiSettings.credits');

  if (!updated) {
    return { granted: false, reason: 'already_granted_or_race' };
  }

  return {
    granted: true,
    tokens: FREE_STARTER_TOKENS,
    addon: addonResult,
  };
}

module.exports = {
  provisionFreshTenantAstra,
};
