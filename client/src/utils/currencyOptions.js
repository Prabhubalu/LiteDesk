import { getLocaleFormatContext } from '@/utils/localeFormat';

export const DEFAULT_CURRENCY_CODE = 'USD';

export const CURRENCY_OPTIONS = Object.freeze([
  { code: 'USD', name: 'US Dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'JPY', name: 'Japanese Yen' },
  { code: 'AUD', name: 'Australian Dollar' },
  { code: 'CAD', name: 'Canadian Dollar' },
  { code: 'CHF', name: 'Swiss Franc' },
  { code: 'CNY', name: 'Chinese Yuan' },
  { code: 'INR', name: 'Indian Rupee' },
  { code: 'SGD', name: 'Singapore Dollar' },
]);

/**
 * Normalize a currency code; empty/invalid → null.
 * @param {unknown} value
 * @returns {string|null}
 */
export function normalizeCurrencyCode(value) {
  if (value == null || value === '') return null;
  const code = String(value).trim().toUpperCase();
  return code || null;
}

/**
 * Tenant org default currency (settings.currency), else platform default.
 * Accepts org object, settings object, or raw code string.
 * @param {unknown} [orgOrSettingsOrCode]
 * @returns {string}
 */
export function resolveOrgCurrencyCode(orgOrSettingsOrCode) {
  if (typeof orgOrSettingsOrCode === 'string') {
    return normalizeCurrencyCode(orgOrSettingsOrCode) || DEFAULT_CURRENCY_CODE;
  }
  if (orgOrSettingsOrCode && typeof orgOrSettingsOrCode === 'object') {
    const fromSettings = orgOrSettingsOrCode.settings?.currency ?? orgOrSettingsOrCode.currency;
    const normalized = normalizeCurrencyCode(fromSettings);
    if (normalized) return normalized;
  }
  const fromLocaleCtx = normalizeCurrencyCode(getLocaleFormatContext()?.currency);
  if (fromLocaleCtx) return fromLocaleCtx;
  return DEFAULT_CURRENCY_CODE;
}

/**
 * Resolve display/edit currency for a Currency amount field.
 * Priority: record companion → explicit field currencyCode → org default → platform default.
 * Bare currencySymbol (e.g. legacy `$`) does not override org default.
 * @param {{
 *   record?: Record<string, unknown>|null,
 *   fieldDef?: { key?: string, numberSettings?: Record<string, unknown> }|null,
 *   currencyCode?: unknown,
 *   orgCurrency?: unknown,
 * }} [opts]
 * @returns {string}
 */
export function resolveCurrencyCodeForField(opts = {}) {
  const { record = null, fieldDef = null, currencyCode = null, orgCurrency = null } = opts;
  const baseKey = String(fieldDef?.key || '').trim();
  const companionCandidates = [
    currencyCode,
    record?.currencyCode,
    record?.currency,
    record?.paymentCurrency,
    baseKey ? record?.[`${baseKey}CurrencyCode`] : null,
    baseKey ? record?.[`${baseKey}Currency`] : null,
  ];
  for (const candidate of companionCandidates) {
    const normalized = normalizeCurrencyCode(candidate);
    if (normalized) return normalized;
  }
  const explicitFieldCode = normalizeCurrencyCode(
    fieldDef?.numberSettings?.currencyCode || fieldDef?.numberSettings?.currency
  );
  if (explicitFieldCode) return explicitFieldCode;
  return resolveOrgCurrencyCode(orgCurrency);
}

export function getCurrencySymbolFromCode(currencyCode = DEFAULT_CURRENCY_CODE) {
  try {
    const parts = new Intl.NumberFormat('en', {
      style: 'currency',
      currency: currencyCode,
      currencyDisplay: 'symbol',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).formatToParts(0);
    const symbolPart = parts.find((part) => part.type === 'currency');
    return symbolPart?.value || '$';
  } catch (error) {
    return '$';
  }
}

export function formatCurrencyValue(value, {
  currencyCode = null,
  minimumFractionDigits = 2,
  maximumFractionDigits = 2,
  locale = 'en-US',
} = {}) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return null;

  const resolvedCode = normalizeCurrencyCode(currencyCode) || resolveOrgCurrencyCode();

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: resolvedCode,
      minimumFractionDigits,
      maximumFractionDigits,
    }).format(numericValue);
  } catch (error) {
    const fallbackSymbol = getCurrencySymbolFromCode(resolvedCode);
    return `${fallbackSymbol}${numericValue.toFixed(maximumFractionDigits)}`;
  }
}

/**
 * Compact dashboard-style currency (e.g. ₹1.2M / $1.2K) using org default when code omitted.
 * @param {unknown} value
 * @param {{ currencyCode?: unknown, orgCurrency?: unknown }} [opts]
 * @returns {string}
 */
export function formatCompactCurrencyValue(value, { currencyCode = null, orgCurrency = null } = {}) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return '—';
  const code = normalizeCurrencyCode(currencyCode) || resolveOrgCurrencyCode(orgCurrency);
  const symbol = getCurrencySymbolFromCode(code);
  const abs = Math.abs(amount);
  if (abs >= 1000000) return `${symbol}${(amount / 1000000).toFixed(1)}M`;
  if (abs >= 1000) return `${symbol}${(amount / 1000).toFixed(1)}K`;
  return `${symbol}${amount.toLocaleString()}`;
}
