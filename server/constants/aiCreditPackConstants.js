/**
 * Default purchasable AI token packs (addon: ai_credits).
 * Pack size and ledger are both in tokens.
 */

const DEFAULT_AI_TOKEN_PACKS = [
  {
    packKey: 'ai_tokens_1m',
    name: '1,000,000 tokens',
    tokens: 1_000_000,
    priceCents: 1000,
    currency: 'USD',
  },
  {
    packKey: 'ai_tokens_5m',
    name: '5,000,000 tokens',
    tokens: 5_000_000,
    priceCents: 4500,
    currency: 'USD',
  },
  {
    packKey: 'ai_tokens_25m',
    name: '25,000,000 tokens',
    tokens: 25_000_000,
    priceCents: 20000,
    currency: 'USD',
  },
];

/** @deprecated Use DEFAULT_AI_TOKEN_PACKS */
const DEFAULT_AI_CREDIT_PACKS = DEFAULT_AI_TOKEN_PACKS;

/**
 * Normalize AI packs to token units.
 * Accepts legacy rows that stored internal credits (×1000) when `tokens` is missing and `credits` is small.
 * @param {unknown} packs
 */
function normalizeAiTokenPacks(packs) {
  if (!Array.isArray(packs) || packs.length === 0) {
    return DEFAULT_AI_TOKEN_PACKS.map((row) => ({ ...row }));
  }

  return packs
    .map((row) => {
      const explicitTokens = Math.max(0, Math.floor(Number(row?.tokens) || 0));
      const legacyCredits = Math.max(0, Math.floor(Number(row?.credits) || 0));
      let tokens = explicitTokens;
      if (tokens <= 0 && legacyCredits > 0) {
        // Legacy pack sizes were credits (1 credit = 1k tokens). Values ≥ 1e5 are already token-scale.
        tokens = legacyCredits >= 100_000 ? legacyCredits : legacyCredits * 1000;
      }
      return {
        packKey: String(row?.packKey || '').trim(),
        name: String(row?.name || '').trim(),
        tokens,
        priceCents: Math.max(0, Math.floor(Number(row?.priceCents) || 0)),
        currency: String(row?.currency || 'USD').trim().toUpperCase() || 'USD',
      };
    })
    .filter((row) => row.packKey && row.tokens > 0);
}

/** @deprecated Use normalizeAiTokenPacks */
function normalizeAiCreditPacks(packs) {
  return normalizeAiTokenPacks(packs);
}

function findAiTokenPack(packs, packKey) {
  const normalized = String(packKey || '').trim();
  return (packs || []).find((row) => row.packKey === normalized) || null;
}

/** @deprecated Use findAiTokenPack */
function findAiCreditPack(packs, packKey) {
  return findAiTokenPack(packs, packKey);
}

module.exports = {
  DEFAULT_AI_TOKEN_PACKS,
  DEFAULT_AI_CREDIT_PACKS,
  normalizeAiTokenPacks,
  normalizeAiCreditPacks,
  findAiTokenPack,
  findAiCreditPack,
};
