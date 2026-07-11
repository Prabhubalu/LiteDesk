import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DEFAULT_CURRENCY_CODE,
  formatCompactCurrencyValue,
  normalizeCurrencyCode,
  resolveOrgCurrencyCode,
  resolveCurrencyCodeForField,
} from '@/utils/currencyOptions';
import { setLocaleFormatContext } from '@/utils/localeFormat';

describe('currencyOptions org defaults', () => {
  beforeEach(() => {
    setLocaleFormatContext({ currency: 'INR' });
  });

  afterEach(() => {
    setLocaleFormatContext({ currency: DEFAULT_CURRENCY_CODE });
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
    setLocaleFormatContext({ currency: undefined });
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
});
