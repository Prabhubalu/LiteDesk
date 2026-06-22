const { canAccessLiveChatNotifications } = require('./liveChatNotificationAccess');

/**
 * Addon entitlements exposed on login/profile for client-side gating (SSE, nav, etc.).
 * Keys use addon registry names (e.g. live_chat).
 */
async function buildClientSessionEntitlements(user, organizationId) {
  const liveChat = await canAccessLiveChatNotifications(user, organizationId);
  return {
    live_chat: liveChat,
  };
}

module.exports = {
  buildClientSessionEntitlements,
};
