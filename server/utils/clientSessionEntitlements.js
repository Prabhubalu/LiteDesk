const { canAccessLiveChatNotifications } = require('./liveChatNotificationAccess');
const { isAiSuiteEntitledForOrg } = require('./addonAccessUtils');

/**
 * Addon entitlements exposed on login/profile for client-side gating (SSE, nav, etc.).
 * Keys use addon registry names (e.g. live_chat, ai).
 */
async function buildClientSessionEntitlements(user, organizationId) {
  const liveChat = await canAccessLiveChatNotifications(user, organizationId);
  const ai = await isAiSuiteEntitledForOrg(organizationId);
  return {
    live_chat: liveChat,
    ai,
  };
}

module.exports = {
  buildClientSessionEntitlements,
};
