import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PHONE_COUNTRY,
  resolveDefaultPhoneCountry,
} from '@/utils/phoneInput';
import {
  applyRegionalBundleToForm,
  detectRegionalMismatch,
  derivePhoneCountryFromTimezone,
  inferRegionalBundleFromTimezone,
  isGenericDefaultLocale,
} from '@/utils/regionalSettings';

describe('regionalSettings', () => {
  it('derives country from IANA timezone', () => {
    expect(derivePhoneCountryFromTimezone('Asia/Kolkata')).toBe('IN');
    expect(derivePhoneCountryFromTimezone('Asia/Calcutta')).toBe('IN');
    expect(derivePhoneCountryFromTimezone('America/New_York')).toBe('US');
    expect(derivePhoneCountryFromTimezone('UTC')).toBeNull();
  });

  it('infers India bundle from Kolkata timezone', () => {
    const bundle = inferRegionalBundleFromTimezone('Asia/Kolkata');
    expect(bundle?.countryIso2).toBe('IN');
    expect(bundle?.locale).toBe('en-IN');
    expect(bundle?.currency).toBe('INR');
  });

  it('detects mismatch when locale/currency disagree with timezone market', () => {
    const result = detectRegionalMismatch({
      timeZone: 'Asia/Kolkata',
      currency: 'INR',
      locale: 'en-US',
      defaultPhoneCountry: '',
      effectivePhoneCountry: 'US',
    });
    expect(result.hasMismatch).toBe(true);
    expect(result.bundle?.countryIso2).toBe('IN');
    expect(result.fields).toContain('locale');
  });

  it('applies bundle without changing timezone field', () => {
    const next = applyRegionalBundleToForm(
      { timeZone: 'Asia/Kolkata', locale: 'en-US', currency: 'USD', defaultPhoneCountry: 'US' },
      inferRegionalBundleFromTimezone('Asia/Kolkata')
    );
    expect(next.timeZone).toBe('Asia/Kolkata');
    expect(next.locale).toBe('en-IN');
    expect(next.currency).toBe('INR');
    expect(next.defaultPhoneCountry).toBe('');
  });
});

describe('phoneInput with regional fallbacks', () => {
  it('prefers timezone/currency over generic en-US locale', () => {
    expect(isGenericDefaultLocale('en-US')).toBe(true);

    expect(
      resolveDefaultPhoneCountry({
        orgLocale: 'en-US',
        orgTimeZone: 'Asia/Kolkata',
        orgCurrency: 'INR',
      })
    ).toBe('IN');

    expect(
      resolveDefaultPhoneCountry({
        orgLocale: 'en-IN',
        orgTimeZone: 'America/New_York',
        orgCurrency: 'USD',
      })
    ).toBe('IN');
  });

  it('falls back to US when no signals', () => {
    expect(resolveDefaultPhoneCountry({ orgLocale: 'en-US' })).toBe(DEFAULT_PHONE_COUNTRY);
  });
});
