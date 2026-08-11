const { canAccessLiveChatNotifications } = require('./liveChatNotificationAccess');
const { isAiSuiteEntitledForOrg, isAddonEntitledForOrg } = require('./addonAccessUtils');
const { ADDON_KEYS } = require('../constants/addonKeys');

/**
 * Addon entitlements exposed on login/profile for client-side gating (SSE, nav, etc.).
 * Keys use addon registry names (e.g. live_chat, ai, stockroom, cpq).
 */
async function buildClientSessionEntitlements(user, organizationId) {
  const liveChat = await canAccessLiveChatNotifications(user, organizationId);
  const ai = await isAiSuiteEntitledForOrg(organizationId);
  const stockroom = await isAddonEntitledForOrg(organizationId, ADDON_KEYS.STOCKROOM);
  const cpq = await isAddonEntitledForOrg(organizationId, ADDON_KEYS.CPQ);
  return {
    live_chat: liveChat,
    ai,
    stockroom,
    cpq,
  };
}

module.exports = {
  buildClientSessionEntitlements,
};
