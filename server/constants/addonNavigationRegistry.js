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
  [ADDON_KEYS.ANNOUNCEMENTS]: {
    surfaceId: 'announcements',
    route: '/announcements',
    label: 'Announcements',
    icon: 'megaphone',
    permission: 'announcements.view',
    order: 20,
  },
  [ADDON_KEYS.TELEPHONY]: {
    surfaceId: 'telephony',
    route: '/telephony/calls',
    label: 'Telephony',
    icon: 'phone',
    permission: 'telephony.view',
    order: 15,
  },
  [ADDON_KEYS.INTERNAL_CHAT]: {
    surfaceId: 'internal-chat',
    route: '/internal-chat',
    label: 'Chat',
    icon: 'chat-bubble-oval-left-ellipsis',
    permission: 'internalChat.view',
    order: 12,
  },
};

module.exports = {
  ADDON_NAVIGATION_REGISTRY,
};
