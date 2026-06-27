/**
 * Organization limits use -1 as an unlimited sentinel (see Organization.updateLimitsForTier).
 * API responses should expose null for unlimited caps.
 */
function normalizeSubscriptionLimit(raw) {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) {
    return null;
  }
  return raw;
}

module.exports = {
  normalizeSubscriptionLimit,
};
