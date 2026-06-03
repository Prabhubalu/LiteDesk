/**
 * Platform-owned commercial modules (quote-to-cash).
 * Visible when any participating business app is enabled for the tenant.
 */

const COMMERCIAL_PLATFORM_MODULE_KEYS = Object.freeze([
  'quotes',
  'sales_orders',
  'invoices',
  'payments'
]);

const COMMERCIAL_PARTICIPATION_APP_KEYS = Object.freeze(['SALES']);

const COMMERCIAL_PLATFORM_MODULE_KEY_SET = new Set(COMMERCIAL_PLATFORM_MODULE_KEYS);

function normalizeModuleKey(moduleKey) {
  return String(moduleKey || '').toLowerCase();
}

function isCommercialPlatformModuleKey(moduleKey) {
  return COMMERCIAL_PLATFORM_MODULE_KEY_SET.has(normalizeModuleKey(moduleKey));
}

function commercialParticipationActive(enabledAppKeys = []) {
  const enabled = new Set(
    (enabledAppKeys || []).map((k) => String(k || '').toUpperCase()).filter(Boolean)
  );
  return COMMERCIAL_PARTICIPATION_APP_KEYS.some((appKey) => enabled.has(appKey));
}

module.exports = {
  COMMERCIAL_PLATFORM_MODULE_KEYS,
  COMMERCIAL_PARTICIPATION_APP_KEYS,
  COMMERCIAL_PLATFORM_MODULE_KEY_SET,
  isCommercialPlatformModuleKey,
  commercialParticipationActive
};
