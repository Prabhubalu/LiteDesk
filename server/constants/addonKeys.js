/**
 * Platform addon keys (installable tenant capabilities).
 */

const ADDON_KEYS = {
  LIVE_CHAT: 'live_chat',
  EMAIL_CREDITS: 'email_credits',
  ARTICLES: 'articles',
  BLOG: 'blog',
  ANNOUNCEMENTS: 'announcements',
  /** Single AI product — unlocks Assist, Commercial, Service, Knowledge */
  AI: 'ai',
  /** Usage meter for platform-key mode only (not a capability package) */
  AI_CREDITS: 'ai_credits',
  /** TallyPrime connector (Windows Agent + sync runtime) */
  TALLY: 'tally',
  /** Multi-stockroom / warehouse locations (requires Inventory app) */
  STOCKROOM: 'stockroom',
  /** Configure-price-quote: item groups, variants, pricing (requires Inventory app) */
  CPQ: 'cpq',
  // Legacy capability keys (pre-unified AI). Still valid for entitlement alias checks.
  AI_ASSIST: 'ai_assist',
  AI_COMMERCIAL: 'ai_commercial',
  AI_SERVICE: 'ai_service',
  AI_KNOWLEDGE: 'ai_knowledge',
};

/** Capability keys that grant full AI suite access (canonical + legacy aliases). */
const AI_SUITE_ADDON_KEYS = [
  ADDON_KEYS.AI,
  ADDON_KEYS.AI_ASSIST,
  ADDON_KEYS.AI_COMMERCIAL,
  ADDON_KEYS.AI_SERVICE,
  ADDON_KEYS.AI_KNOWLEDGE,
];

const VALID_ADDON_KEYS = Object.values(ADDON_KEYS);

function normalizeAddonKey(value) {
  return String(value || '').trim().toLowerCase();
}

function isValidAddonKey(value) {
  return VALID_ADDON_KEYS.includes(normalizeAddonKey(value));
}

function isAiSuiteAddonKey(value) {
  return AI_SUITE_ADDON_KEYS.includes(normalizeAddonKey(value));
}

module.exports = {
  ADDON_KEYS,
  AI_SUITE_ADDON_KEYS,
  VALID_ADDON_KEYS,
  normalizeAddonKey,
  isValidAddonKey,
  isAiSuiteAddonKey,
};
