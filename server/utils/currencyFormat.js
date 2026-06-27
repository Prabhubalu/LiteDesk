'use strict';

const DEFAULT_LOCALE = 'en-US';

/**
 * @param {unknown} mode
 * @returns {'code' | 'symbol'}
 */
function normalizeCurrencyDisplayMode(mode) {
  return String(mode || 'code').toLowerCase() === 'symbol' ? 'symbol' : 'code';
}

/**
 * @param {string} currencyCode
 * @param {string} [locale]
 */
function getCurrencySymbolFromCode(currencyCode = 'USD', locale = DEFAULT_LOCALE) {
  try {
    const parts = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      currencyDisplay: 'symbol',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).formatToParts(0);
    const symbolPart = parts.find((part) => part.type === 'currency');
    return symbolPart?.value || currencyCode;
  } catch {
    return currencyCode;
  }
}

/**
 * @param {unknown} value
 * @param {string} currencyCode
 * @param {'code' | 'symbol'} [displayMode]
 * @param {string} [locale]
 */
function formatCurrencyAmount(value, currencyCode, displayMode = 'code', locale = DEFAULT_LOCALE) {
  const num = Number(value);
  if (!Number.isFinite(num)) return String(value ?? '');

  const code = String(currencyCode || '').trim();
  const mode = normalizeCurrencyDisplayMode(displayMode);

  if (mode === 'symbol' && code) {
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: code,
        currencyDisplay: 'symbol',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(num);
    } catch {
      const symbol = getCurrencySymbolFromCode(code, locale);
      const formatted = num.toLocaleString(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
      return `${symbol}${formatted}`;
    }
  }

  const formatted = num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return code ? `${formatted} ${code}`.trim() : formatted;
}

/**
 * @param {Record<string, unknown>} [scope]
 * @returns {'code' | 'symbol'}
 */
function resolveCurrencyDisplayMode(scope) {
  return normalizeCurrencyDisplayMode(
    scope?.parameters?.currencyDisplay
    || scope?.currencyDisplay
    || 'code'
  );
}

module.exports = {
  normalizeCurrencyDisplayMode,
  getCurrencySymbolFromCode,
  formatCurrencyAmount,
  resolveCurrencyDisplayMode
};
