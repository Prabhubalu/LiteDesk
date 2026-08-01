'use strict';

const { normalizeCurrencyCode, resolveOrgCurrencyCode } = require('./orgCurrency');

/** ISO codes matching client ORG_CURRENCIES allowlist. */
const ALLOWED_CURRENCY_CODES = Object.freeze([
  'USD',
  'EUR',
  'GBP',
  'JPY',
  'CNY',
  'INR',
  'AUD',
  'CAD',
  'CHF',
  'SGD',
  'HKD',
  'AED',
  'SAR',
  'BRL',
  'MXN',
  'ZAR',
]);

const ALLOWED_SET = new Set(ALLOWED_CURRENCY_CODES);

/**
 * @param {string|null|undefined} code
 * @returns {boolean}
 */
function isAllowedCurrencyCode(code) {
  const normalized = normalizeCurrencyCode(code);
  return Boolean(normalized && ALLOWED_SET.has(normalized));
}

/**
 * Normalize stored currency rows for API responses.
 * Base currency is always enabled with rate 1 and omitted from the stored/returned
 * non-base list unless includeBase is true (for display helpers).
 *
 * @param {unknown} raw
 * @param {string} baseCurrency
 * @returns {{ code: string, enabled: boolean, conversionRate: number }[]}
 */
function normalizeCurrenciesForResponse(raw, baseCurrency) {
  const base = resolveOrgCurrencyCode({ settings: { currency: baseCurrency } });
  const list = Array.isArray(raw) ? raw : [];
  const byCode = new Map();

  for (const row of list) {
    if (!row || typeof row !== 'object') continue;
    const code = normalizeCurrencyCode(row.code);
    if (!code || !ALLOWED_SET.has(code) || code === base) continue;
    if (byCode.has(code)) continue;

    const enabled = Boolean(row.enabled);
    let conversionRate = Number(row.conversionRate);
    if (!Number.isFinite(conversionRate) || conversionRate <= 0) {
      conversionRate = 1;
    }

    byCode.set(code, {
      code,
      enabled,
      conversionRate,
    });
  }

  return Array.from(byCode.values()).sort((a, b) => a.code.localeCompare(b.code));
}

/**
 * Validate and normalize a currencies payload for persistence.
 * Strips the base currency row; rejects invalid codes/rates.
 *
 * @param {unknown} raw
 * @param {string} baseCurrency
 * @returns {{ ok: true, currencies: { code: string, enabled: boolean, conversionRate: number }[] } | { ok: false, message: string }}
 */
function validateAndNormalizeCurrenciesInput(raw, baseCurrency) {
  if (raw === undefined) {
    return { ok: true, currencies: undefined };
  }
  if (!Array.isArray(raw)) {
    return { ok: false, message: 'currencies must be an array' };
  }

  const base = resolveOrgCurrencyCode({ settings: { currency: baseCurrency } });
  const seen = new Set();
  const currencies = [];

  for (const row of raw) {
    if (!row || typeof row !== 'object') {
      return { ok: false, message: 'Each currency entry must be an object' };
    }

    const code = normalizeCurrencyCode(row.code);
    if (!code || !ALLOWED_SET.has(code)) {
      return {
        ok: false,
        message: `Invalid currency code${code ? `: ${code}` : ''}. Must be a supported ISO code.`,
      };
    }

    if (seen.has(code)) {
      return { ok: false, message: `Duplicate currency code: ${code}` };
    }
    seen.add(code);

    // Base is always enabled at rate 1 — ignore any client row for base.
    if (code === base) {
      continue;
    }

    const enabled = Boolean(row.enabled);
    let conversionRate = Number(row.conversionRate);
    if (!Number.isFinite(conversionRate) || conversionRate <= 0) {
      if (enabled) {
        return {
          ok: false,
          message: `conversionRate for ${code} must be a number greater than 0`,
        };
      }
      conversionRate = 1;
    }

    currencies.push({
      code,
      enabled,
      conversionRate,
    });
  }

  currencies.sort((a, b) => a.code.localeCompare(b.code));
  return { ok: true, currencies };
}

/**
 * Base currency is always enabled; other codes must be present with enabled=true.
 * @param {{ settings?: { currency?: string, currencies?: unknown } }|null|undefined} org
 * @param {string|null|undefined} code
 * @returns {boolean}
 */
function isCurrencyEnabledForOrg(org, code) {
  const normalized = normalizeCurrencyCode(code);
  if (!normalized || !ALLOWED_SET.has(normalized)) return false;
  const base = resolveOrgCurrencyCode(org);
  if (normalized === base) return true;
  const rows = normalizeCurrenciesForResponse(org?.settings?.currencies, base);
  return rows.some((row) => row.code === normalized && row.enabled);
}

/**
 * Conversion rate: units of `code` per 1 unit of base. Base → 1.
 * Returns null when code is unknown/disabled (except base).
 * @param {{ settings?: { currency?: string, currencies?: unknown } }|null|undefined} org
 * @param {string|null|undefined} code
 * @returns {number|null}
 */
function getConversionRateVsBase(org, code) {
  const normalized = normalizeCurrencyCode(code);
  if (!normalized) return null;
  const base = resolveOrgCurrencyCode(org);
  if (normalized === base) return 1;
  const rows = normalizeCurrenciesForResponse(org?.settings?.currencies, base);
  const row = rows.find((r) => r.code === normalized && r.enabled);
  if (!row) return null;
  const rate = Number(row.conversionRate);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

/**
 * Convert amount from one currency to another using org rates vs base.
 * @param {number} amount
 * @param {string|null|undefined} fromCode
 * @param {string|null|undefined} toCode
 * @param {{ settings?: { currency?: string, currencies?: unknown } }|null|undefined} org
 * @returns {number|null} null when conversion is not possible
 */
function convertAmountBetweenCurrencies(amount, fromCode, toCode, org) {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) return null;
  const from = normalizeCurrencyCode(fromCode) || resolveOrgCurrencyCode(org);
  const to = normalizeCurrencyCode(toCode) || resolveOrgCurrencyCode(org);
  if (from === to) return numeric;
  const fromRate = getConversionRateVsBase(org, from);
  const toRate = getConversionRateVsBase(org, to);
  if (fromRate == null || toRate == null) return null;
  return (numeric / fromRate) * toRate;
}

/**
 * Enabled currency codes for an org (always includes base).
 * @param {{ settings?: { currency?: string, currencies?: unknown } }|null|undefined} org
 * @returns {string[]}
 */
function getEnabledCurrencyCodes(org) {
  const base = resolveOrgCurrencyCode(org);
  const codes = new Set([base]);
  for (const row of normalizeCurrenciesForResponse(org?.settings?.currencies, base)) {
    if (row.enabled) codes.add(row.code);
  }
  return Array.from(codes).sort((a, b) => a.localeCompare(b));
}

module.exports = {
  ALLOWED_CURRENCY_CODES,
  isAllowedCurrencyCode,
  normalizeCurrenciesForResponse,
  validateAndNormalizeCurrenciesInput,
  isCurrencyEnabledForOrg,
  getConversionRateVsBase,
  convertAmountBetweenCurrencies,
  getEnabledCurrencyCodes,
};
