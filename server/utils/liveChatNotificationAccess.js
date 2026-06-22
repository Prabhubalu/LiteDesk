const { isAddonEntitledForOrg } = require('./addonAccessUtils');
const { canViewLiveChatSessions } = require('./liveChatPermissionUtils');

/**
 * PLATFORM notification stream / API access for Live Chat agents.
 */
async function canAccessLiveChatNotifications(user, organizationId) {
  if (!user?._id || !organizationId) return false;
  if (!canViewLiveChatSessions(user)) return false;
  return isAddonEntitledForOrg(organizationId, 'live_chat');
}

module.exports = {
  canAccessLiveChatNotifications,
};
