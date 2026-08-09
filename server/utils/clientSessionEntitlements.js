const { canAccessLiveChatNotifications } = require('./liveChatNotificationAccess');
const { isAiSuiteEntitledForOrg, isAddonEntitledForOrg } = require('./addonAccessUtils');
const { ADDON_KEYS } = require('../constants/addonKeys');

/**
 * Addon entitlements exposed on login/profile for client-side gating (SSE, nav, etc.).
 * Keys use addon registry names (e.g. live_chat, ai, telephony).
 */
async function buildClientSessionEntitlements(user, organizationId) {
  const liveChat = await canAccessLiveChatNotifications(user, organizationId);
  const ai = await isAiSuiteEntitledForOrg(organizationId);
  const telephony = await isAddonEntitledForOrg(organizationId, ADDON_KEYS.TELEPHONY);
  return {
    live_chat: liveChat,
    ai,
    telephony,
  };
}

module.exports = {
  buildClientSessionEntitlements,
};
