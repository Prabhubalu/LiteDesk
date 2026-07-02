'use strict';

/**
 * Default purchasable email credit packs (addon: email_credits).
 */

const DEFAULT_EMAIL_CREDIT_PACKS = [
  {
    packKey: 'pack_5k',
    name: '5,000 credits',
    credits: 5_000,
    priceCents: 2_500,
    currency: 'USD'
  },
  {
    packKey: 'pack_25k',
    name: '25,000 credits',
    credits: 25_000,
    priceCents: 9_900,
    currency: 'USD'
  },
  {
    packKey: 'pack_100k',
    name: '100,000 credits',
    credits: 100_000,
    priceCents: 34_900,
    currency: 'USD'
  }
];

/**
 * @param {unknown} packs
 * @returns {typeof DEFAULT_EMAIL_CREDIT_PACKS}
 */
function normalizeCreditPacks(packs) {
  if (!Array.isArray(packs) || packs.length === 0) {
    return DEFAULT_EMAIL_CREDIT_PACKS.map((row) => ({ ...row }));
  }

  return packs
    .map((row) => ({
      packKey: String(row?.packKey || '').trim(),
      name: String(row?.name || '').trim(),
      credits: Math.max(0, Number(row?.credits) || 0),
      priceCents: Math.max(0, Number(row?.priceCents) || 0),
      currency: String(row?.currency || 'USD').trim().toUpperCase()
    }))
    .filter((row) => row.packKey && row.credits > 0);
}

/**
 * @param {typeof DEFAULT_EMAIL_CREDIT_PACKS} packs
 * @param {string} packKey
 */
function findCreditPack(packs, packKey) {
  const normalized = String(packKey || '').trim();
  return (packs || []).find((row) => row.packKey === normalized) || null;
}

module.exports = {
  DEFAULT_EMAIL_CREDIT_PACKS,
  normalizeCreditPacks,
  findCreditPack
};
