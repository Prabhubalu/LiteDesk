import {
  formatNumberWithDisplayPrefs,
  getLocaleFormatContext,
  resolveDisplayPreferences,
} from '@/utils/localeFormat';

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

/** Full catalog metadata (aligned with orgRegionalOptions.ORG_CURRENCIES). */
const CURRENCY_CATALOG = Object.freeze([
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
  { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
  { code: 'MXN', name: 'Mexican Peso', symbol: 'Mex$' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
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
  const ctx = getLocaleFormatContext();
  const fromCtxBase = normalizeCurrencyCode(ctx?.baseCurrency);
  if (fromCtxBase) return fromCtxBase;
  const fromLocaleCtx = normalizeCurrencyCode(ctx?.currency);
  if (fromLocaleCtx) return fromLocaleCtx;
  return DEFAULT_CURRENCY_CODE;
}

/**
 * @param {unknown} [orgOrSettings]
 * @returns {{ code: string, enabled: boolean, conversionRate: number }[]}
 */
export function resolveOrgCurrencyRows(orgOrSettings = null) {
  if (orgOrSettings && typeof orgOrSettings === 'object') {
    const raw = orgOrSettings.settings?.currencies ?? orgOrSettings.currencies;
    if (Array.isArray(raw)) {
      return raw
        .filter((row) => row && typeof row === 'object')
        .map((row) => ({
          code: normalizeCurrencyCode(row.code),
          enabled: Boolean(row.enabled),
          conversionRate: Number(row.conversionRate),
        }))
        .filter((row) => row.code && Number.isFinite(row.conversionRate) && row.conversionRate > 0);
    }
  }
  const fromCtx = getLocaleFormatContext()?.orgCurrencies;
  if (Array.isArray(fromCtx)) {
    return fromCtx
      .map((row) => ({
        code: normalizeCurrencyCode(row?.code),
        enabled: Boolean(row?.enabled),
        conversionRate: Number(row?.conversionRate),
      }))
      .filter((row) => row.code && Number.isFinite(row.conversionRate) && row.conversionRate > 0);
  }
  return [];
}

/**
 * Enabled currency codes for pickers (always includes org base).
 * @param {unknown} [orgOrSettings]
 * @returns {string[]}
 */
export function getEnabledCurrencyCodes(orgOrSettings = null) {
  const base = resolveOrgCurrencyCode(orgOrSettings);
  const codes = new Set([base]);
  for (const row of resolveOrgCurrencyRows(orgOrSettings)) {
    if (row.enabled && row.code) codes.add(row.code);
  }
  return Array.from(codes);
}

/**
 * Catalog entries for enabled currencies (+ base), for form pickers.
 * @param {unknown} [orgOrSettings]
 * @returns {{ code: string, name: string, symbol?: string }[]}
 */
export function getEnabledCurrencyOptions(orgOrSettings = null) {
  const enabled = new Set(getEnabledCurrencyCodes(orgOrSettings));
  const fromCatalog = CURRENCY_CATALOG.filter((c) => enabled.has(c.code));
  // Preserve any enabled code missing from catalog (shouldn't happen, but safe).
  for (const code of enabled) {
    if (!fromCatalog.some((c) => c.code === code)) {
      fromCatalog.push({ code, name: code, symbol: code });
    }
  }
  return fromCatalog;
}

/**
 * Rate: units of `code` per 1 unit of base. Base → 1. Disabled/unknown → null.
 * @param {string|null|undefined} code
 * @param {unknown} [orgOrSettings]
 * @returns {number|null}
 */
export function getConversionRateVsBase(code, orgOrSettings = null) {
  const normalized = normalizeCurrencyCode(code);
  if (!normalized) return null;
  const base = resolveOrgCurrencyCode(orgOrSettings);
  if (normalized === base) return 1;
  const row = resolveOrgCurrencyRows(orgOrSettings).find(
    (r) => r.code === normalized && r.enabled
  );
  if (!row) return null;
  const rate = Number(row.conversionRate);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

/**
 * Convert amount between currencies using org rates vs base.
 * @param {number} amount
 * @param {string|null|undefined} fromCode
 * @param {string|null|undefined} toCode
 * @param {unknown} [orgOrSettings]
 * @returns {number|null}
 */
export function convertCurrencyAmount(amount, fromCode, toCode, orgOrSettings = null) {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) return null;
  const from = normalizeCurrencyCode(fromCode) || resolveOrgCurrencyCode(orgOrSettings);
  const to = normalizeCurrencyCode(toCode) || resolveOrgCurrencyCode(orgOrSettings);
  if (from === to) return numeric;
  const fromRate = getConversionRateVsBase(from, orgOrSettings);
  const toRate = getConversionRateVsBase(to, orgOrSettings);
  if (fromRate == null || toRate == null) return null;
  return (numeric / fromRate) * toRate;
}

/**
 * When preferred display is on, convert source → preferred (if rates exist).
 * @param {number} amount
 * @param {string} sourceCode
 * @param {unknown} [orgOrSettings]
 * @returns {{ amount: number, displayCode: string }}
 */
export function applyPreferredCurrencyDisplay(amount, sourceCode, orgOrSettings = null) {
  const source = normalizeCurrencyCode(sourceCode) || resolveOrgCurrencyCode(orgOrSettings);
  const prefs = resolveDisplayPreferences();
  const preferred = normalizeCurrencyCode(prefs.preferredCurrency);
  const orgBase = resolveOrgCurrencyCode(orgOrSettings);
  // Prefer explicit toggle; also treat a non-base preferred currency as an opt-in
  // so Profile "Preferred currency" takes effect without a second hidden switch.
  const showPreferred = Boolean(
    prefs.showAmountsInPreferredCurrency
    || (preferred && preferred !== orgBase)
  );
  if (!showPreferred || !preferred) {
    return { amount, displayCode: source };
  }
  if (preferred === source) {
    return { amount, displayCode: preferred };
  }
  const converted = convertCurrencyAmount(amount, source, preferred, orgOrSettings);
  if (converted == null) {
    // No rate available — keep source currency rather than wrong symbol/value.
    return { amount, displayCode: source };
  }
  return { amount: converted, displayCode: preferred };
}

/**
 * Display currency: explicit code → preferred (when enabled) → org default.
 * Note: for amount formatting with conversion, use formatCurrencyValue (applies FX).
 * @param {unknown} [currencyCode]
 * @param {unknown} [orgCurrency]
 * @returns {string}
 */
export function resolveDisplayCurrencyCode(currencyCode = null, orgCurrency = null) {
  const explicit = normalizeCurrencyCode(currencyCode);
  if (explicit) return explicit;
  const prefs = resolveDisplayPreferences();
  const preferred = normalizeCurrencyCode(prefs.preferredCurrency);
  const orgBase = resolveOrgCurrencyCode(orgCurrency);
  if (
    preferred
    && (prefs.showAmountsInPreferredCurrency || preferred !== orgBase)
  ) {
    return preferred;
  }
  return orgBase;
}

/**
 * Resolve display/edit currency for a Currency amount field.
 * Priority: record companion → explicit field currencyCode → preferred (if enabled) → org default → platform default.
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
  return resolveDisplayCurrencyCode(null, orgCurrency);
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

/**
 * Format a currency amount using the user's Currency & number preferences.
 * When showAmountsInPreferredCurrency is on, converts via org conversion rates.
 * Explicit fraction-digit options from field defs still win when provided.
 * @param {unknown} value
 * @param {{
 *   currencyCode?: string|null,
 *   orgCurrency?: unknown,
 *   minimumFractionDigits?: number,
 *   maximumFractionDigits?: number,
 *   locale?: string,
 * }} [opts]
 * @returns {string|null}
 */
export function formatCurrencyValue(value, {
  currencyCode = null,
  orgCurrency = null,
  minimumFractionDigits,
  maximumFractionDigits,
} = {}) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return null;

  const sourceCode = normalizeCurrencyCode(currencyCode) || resolveOrgCurrencyCode(orgCurrency);
  const { amount, displayCode } = applyPreferredCurrencyDisplay(
    numericValue,
    sourceCode,
    orgCurrency
  );

  const formatOpts = {
    style: 'currency',
    currency: displayCode,
  };
  if (minimumFractionDigits !== undefined) {
    formatOpts.minimumFractionDigits = minimumFractionDigits;
  }
  if (maximumFractionDigits !== undefined) {
    formatOpts.maximumFractionDigits = maximumFractionDigits;
  }

  try {
    return formatNumberWithDisplayPrefs(amount, formatOpts);
  } catch (error) {
    const prefs = resolveDisplayPreferences();
    const places = maximumFractionDigits ?? prefs.currencyDecimalPlaces ?? 2;
    const fallbackSymbol = getCurrencySymbolFromCode(displayCode);
    return `${fallbackSymbol}${amount.toFixed(places)}`;
  }
}

/**
 * Compact dashboard-style currency (e.g. ₹1.2M / $1.2K).
 * Honors aggregatedNumberFormat when set; otherwise auto K/M.
 * @param {unknown} value
 * @param {{ currencyCode?: unknown, orgCurrency?: unknown }} [opts]
 * @returns {string}
 */
export function formatCompactCurrencyValue(value, { currencyCode = null, orgCurrency = null } = {}) {
  const rawAmount = Number(value || 0);
  if (!Number.isFinite(rawAmount)) return '—';
  const prefs = resolveDisplayPreferences();
  const sourceCode = normalizeCurrencyCode(currencyCode) || resolveOrgCurrencyCode(orgCurrency);
  const { amount, displayCode } = applyPreferredCurrencyDisplay(
    rawAmount,
    sourceCode,
    orgCurrency
  );

  if (prefs.aggregatedNumberFormat !== 'none') {
    return formatNumberWithDisplayPrefs(amount, {
      style: 'currency',
      currency: displayCode,
    }) || '—';
  }

  const symbol = getCurrencySymbolFromCode(displayCode);
  const abs = Math.abs(amount);
  const compactOpts = { minimumFractionDigits: 1, maximumFractionDigits: 1 };
  if (abs >= 1000000) {
    return `${symbol}${formatNumberWithDisplayPrefs(amount / 1000000, compactOpts)}M`;
  }
  if (abs >= 1000) {
    return `${symbol}${formatNumberWithDisplayPrefs(amount / 1000, compactOpts)}K`;
  }
  return `${symbol}${formatNumberWithDisplayPrefs(amount, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}
