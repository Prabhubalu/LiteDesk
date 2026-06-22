const { ADDON_KEYS } = require('./addonKeys');

/**
 * Sidebar navigation entries for entitled addons (shell section, below Inbox).
 */
const ADDON_NAVIGATION_REGISTRY = {
  [ADDON_KEYS.LIVE_CHAT]: {
    surfaceId: 'live-chat',
    route: '/live-chat/sessions',
    label: 'Live Chat',
    icon: 'chat-bubble-left-right',
    permission: 'liveChat.view',
    order: 10,
  },
};

module.exports = {
  ADDON_NAVIGATION_REGISTRY,
};
