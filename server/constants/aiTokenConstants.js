/**
 * AI metering unit: tokens (product + ledger).
 * Legacy "credits" (1 credit ≈ 1k tokens) are migrated by migrateAiCreditsBalanceToTokens.js.
 */

/** One-time free pool for a new platform tenant (isTenant), granted once. */
const FREE_STARTER_TOKENS = 1_000_000;

function normalizeTokenCount(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

module.exports = {
  FREE_STARTER_TOKENS,
  normalizeTokenCount,
};
