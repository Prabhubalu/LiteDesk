/**
 * Platform addon keys (installable tenant capabilities).
 */

const ADDON_KEYS = {
  LIVE_CHAT: 'live_chat',
};

const VALID_ADDON_KEYS = Object.values(ADDON_KEYS);

function normalizeAddonKey(value) {
  return String(value || '').trim().toLowerCase();
}

function isValidAddonKey(value) {
  return VALID_ADDON_KEYS.includes(normalizeAddonKey(value));
}

module.exports = {
  ADDON_KEYS,
  VALID_ADDON_KEYS,
  normalizeAddonKey,
  isValidAddonKey,
};
