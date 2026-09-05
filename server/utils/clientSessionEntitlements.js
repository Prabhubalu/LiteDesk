const { canAccessLiveChatNotifications } = require('./liveChatNotificationAccess');
const { isAiSuiteEntitledForOrg, isAddonEntitledForOrg } = require('./addonAccessUtils');
const { ADDON_KEYS } = require('../constants/addonKeys');

/**
 * Addon entitlements exposed on login/profile for client-side gating (SSE, nav, etc.).
 * Keys use addon registry names (e.g. live_chat, ai, stockroom, cpq, telephony).
 */
async function buildClientSessionEntitlements(user, organizationId) {
  const liveChat = await canAccessLiveChatNotifications(user, organizationId);
  const ai = await isAiSuiteEntitledForOrg(organizationId);
  const stockroom = await isAddonEntitledForOrg(organizationId, ADDON_KEYS.STOCKROOM);
  const cpq = await isAddonEntitledForOrg(organizationId, ADDON_KEYS.CPQ);
  const telephony = await isAddonEntitledForOrg(organizationId, ADDON_KEYS.TELEPHONY);
  const isExternal = String(user?.userType || 'INTERNAL').toUpperCase() === 'EXTERNAL';
  const internalChat = !isExternal
    && await isAddonEntitledForOrg(organizationId, ADDON_KEYS.INTERNAL_CHAT);
  return {
    live_chat: liveChat,
    ai,
    stockroom,
    cpq,
    telephony,
    internal_chat: internalChat,
  };
}

module.exports = {
  buildClientSessionEntitlements,
};
