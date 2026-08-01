import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  DEFAULT_CURRENCY_CODE,
  convertCurrencyAmount,
  formatCompactCurrencyValue,
  formatCurrencyValue,
  getEnabledCurrencyCodes,
  normalizeCurrencyCode,
  resolveOrgCurrencyCode,
  resolveCurrencyCodeForField,
} from '@/utils/currencyOptions';
import { DEFAULT_DISPLAY_PREFERENCES, setLocaleFormatContext } from '@/utils/localeFormat';

describe('currencyOptions org defaults', () => {
  beforeEach(() => {
    setLocaleFormatContext({
      currency: 'INR',
      baseCurrency: 'INR',
      orgCurrencies: [],
      displayPreferences: { ...DEFAULT_DISPLAY_PREFERENCES },
    });
  });

  afterEach(() => {
    setLocaleFormatContext({
      currency: DEFAULT_CURRENCY_CODE,
      baseCurrency: DEFAULT_CURRENCY_CODE,
      orgCurrencies: [],
      displayPreferences: { ...DEFAULT_DISPLAY_PREFERENCES },
    });
  });

  it('normalizeCurrencyCode uppercases and trims', () => {
    expect(normalizeCurrencyCode(' inr ')).toBe('INR');
    expect(normalizeCurrencyCode('')).toBeNull();
    expect(normalizeCurrencyCode(null)).toBeNull();
  });

  it('resolveOrgCurrencyCode prefers org settings', () => {
    expect(resolveOrgCurrencyCode({ settings: { currency: 'eur' } })).toBe('EUR');
    expect(resolveOrgCurrencyCode({ currency: 'GBP' })).toBe('GBP');
    expect(resolveOrgCurrencyCode('sgd')).toBe('SGD');
  });

  it('resolveOrgCurrencyCode falls back to locale context then USD', () => {
    expect(resolveOrgCurrencyCode(null)).toBe('INR');
    setLocaleFormatContext({ currency: undefined, baseCurrency: undefined });
    expect(resolveOrgCurrencyCode({})).toBe(DEFAULT_CURRENCY_CODE);
  });

  it('resolveCurrencyCodeForField prefers record currency over field symbol', () => {
    expect(
      resolveCurrencyCodeForField({
        record: { currency: 'INR' },
        fieldDef: { key: 'amount', numberSettings: { currencySymbol: '$' } },
      })
    ).toBe('INR');
  });

  it('resolveCurrencyCodeForField ignores bare currencySymbol and uses org default', () => {
    expect(
      resolveCurrencyCodeForField({
        record: {},
        fieldDef: { key: 'amount', numberSettings: { currencySymbol: '$' } },
        orgCurrency: { settings: { currency: 'INR' } },
      })
    ).toBe('INR');
  });

  it('resolveCurrencyCodeForField respects explicit field currencyCode', () => {
    expect(
      resolveCurrencyCodeForField({
        record: {},
        fieldDef: { key: 'amount', numberSettings: { currencyCode: 'EUR' } },
        orgCurrency: { settings: { currency: 'INR' } },
      })
    ).toBe('EUR');
  });

  it('formatCompactCurrencyValue uses org currency symbol', () => {
    expect(formatCompactCurrencyValue(0, { orgCurrency: { settings: { currency: 'INR' } } })).toMatch(/₹/);
    expect(formatCompactCurrencyValue(1500, { orgCurrency: { settings: { currency: 'INR' } } })).toBe('₹1.5K');
  });

  it('formatCurrencyValue honors displayPreferences separators and decimals', () => {
    setLocaleFormatContext({
      currency: 'USD',
      displayPreferences: {
        digitGroupingPattern: 'international',
        decimalSeparator: ',',
        digitGroupingSeparator: '.',
        currencyDecimalPlaces: 2,
        truncateTrailingZeros: false,
        aggregatedNumberFormat: 'none',
        showAmountsInPreferredCurrency: false,
      },
    });
    expect(formatCurrencyValue(1234.5, { currencyCode: 'USD' })).toBe('$1.234,50');
  });

  it('formatCurrencyValue uses preferred currency when enabled', () => {
    setLocaleFormatContext({
      currency: 'USD',
      baseCurrency: 'USD',
      orgCurrencies: [{ code: 'EUR', enabled: true, conversionRate: 1 }],
      displayPreferences: {
        preferredCurrency: 'EUR',
        showAmountsInPreferredCurrency: true,
        currencyDecimalPlaces: 0,
        truncateTrailingZeros: false,
        aggregatedNumberFormat: 'none',
      },
    });
    expect(formatCurrencyValue(10)).toMatch(/€|EUR/);
  });

  it('formatCurrencyValue converts using org conversion rates', () => {
    setLocaleFormatContext({
      currency: 'USD',
      baseCurrency: 'USD',
      orgCurrencies: [{ code: 'INR', enabled: true, conversionRate: 80 }],
      displayPreferences: {
        preferredCurrency: 'INR',
        showAmountsInPreferredCurrency: true,
        digitGroupingPattern: 'international',
        decimalSeparator: '.',
        digitGroupingSeparator: ',',
        currencyDecimalPlaces: 0,
        truncateTrailingZeros: false,
        aggregatedNumberFormat: 'none',
      },
    });
    // 10 USD * 80 = 800 INR
    expect(formatCurrencyValue(10, { currencyCode: 'USD' })).toMatch(/800/);
    expect(formatCurrencyValue(10, { currencyCode: 'USD' })).toMatch(/₹|INR/);
  });

  it('formatCurrencyValue converts when preferred differs from base even if show toggle is off', () => {
    setLocaleFormatContext({
      currency: 'USD',
      baseCurrency: 'USD',
      orgCurrencies: [{ code: 'INR', enabled: true, conversionRate: 80 }],
      displayPreferences: {
        preferredCurrency: 'INR',
        showAmountsInPreferredCurrency: false,
        digitGroupingPattern: 'international',
        decimalSeparator: '.',
        digitGroupingSeparator: ',',
        currencyDecimalPlaces: 0,
        truncateTrailingZeros: false,
        aggregatedNumberFormat: 'none',
      },
    });
    expect(formatCurrencyValue(10, { currencyCode: 'USD' })).toMatch(/800/);
    expect(formatCurrencyValue(10, { currencyCode: 'USD' })).toMatch(/₹|INR/);
  });

  it('convertCurrencyAmount converts via base', () => {
    const org = {
      settings: {
        currency: 'USD',
        currencies: [
          { code: 'EUR', enabled: true, conversionRate: 0.5 },
          { code: 'INR', enabled: true, conversionRate: 80 },
        ],
      },
    };
    expect(convertCurrencyAmount(10, 'USD', 'INR', org)).toBe(800);
    expect(convertCurrencyAmount(10, 'EUR', 'INR', org)).toBe(1600);
    expect(convertCurrencyAmount(80, 'INR', 'USD', org)).toBe(1);
  });

  it('getEnabledCurrencyCodes includes base and enabled only', () => {
    const org = {
      settings: {
        currency: 'USD',
        currencies: [
          { code: 'INR', enabled: true, conversionRate: 80 },
          { code: 'EUR', enabled: false, conversionRate: 0.9 },
        ],
      },
    };
    expect(getEnabledCurrencyCodes(org).sort()).toEqual(['INR', 'USD']);
  });

  it('formatCurrencyValue applies aggregated millions', () => {
    setLocaleFormatContext({
      currency: 'USD',
      displayPreferences: {
        aggregatedNumberFormat: 'millions',
        currencyDecimalPlaces: 1,
        truncateTrailingZeros: false,
        showAmountsInPreferredCurrency: false,
      },
    });
    expect(formatCurrencyValue(2500000, { currencyCode: 'USD' })).toMatch(/2\.5M|2,5M/);
  });
});
