'use strict';

const OrganizationSubscription = require('../models/OrganizationSubscription');
const Organization = require('../models/Organization');
const TenantAddonConfiguration = require('../models/TenantAddonConfiguration');
const { normalizeAddonKey } = require('../constants/addonKeys');
const { ADDON_KEYS } = require('../constants/addonKeys');

async function suspendLiveChatWidget(organizationId) {
  await Organization.updateOne(
    { _id: organizationId },
    { $set: { 'embed.chat.enabled': false } },
  );

  await TenantAddonConfiguration.updateOne(
    { organizationId, addonKey: ADDON_KEYS.LIVE_CHAT },
    { $set: { enabled: false, disabledAt: new Date() } },
  );
}

/**
 * Mark expired addon trials as SUSPENDED and disable Live Chat widget when applicable.
 */
async function expireAddonTrials({ limit = 200 } = {}) {
  const now = new Date();
  const subscriptions = await OrganizationSubscription.find({
    addons: {
      $elemMatch: {
        status: 'TRIAL',
        trialEndsAt: { $ne: null, $lte: now },
      },
    },
  })
    .limit(Math.max(Number(limit) || 200, 1))
    .lean();

  let expired = 0;
  const details = [];

  for (const subscription of subscriptions) {
    const organizationId = subscription.organizationId;
    let changed = false;

    for (const entry of subscription.addons || []) {
      const status = String(entry.status || '').toUpperCase();
      if (status !== 'TRIAL') continue;
      if (!entry.trialEndsAt || new Date(entry.trialEndsAt) > now) continue;

      entry.status = 'SUSPENDED';
      changed = true;
      expired += 1;

      const addonKey = normalizeAddonKey(entry.addonKey);
      details.push({ organizationId: String(organizationId), addonKey, trialEndsAt: entry.trialEndsAt });

      if (addonKey === ADDON_KEYS.LIVE_CHAT) {
        await suspendLiveChatWidget(organizationId);
      }
    }

    if (changed) {
      await OrganizationSubscription.updateOne(
        { _id: subscription._id },
        { $set: { addons: subscription.addons } },
      );
    }
  }

  return { expired, details };
}

module.exports = {
  expireAddonTrials,
  suspendLiveChatWidget,
};
