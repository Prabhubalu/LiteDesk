import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PHONE_COUNTRY,
  derivePhoneCountryFromLocale,
  extractRecordCountry,
  normalizePhoneCountryIso2,
  resolveDefaultPhoneCountry,
} from '@/utils/phoneInput';

describe('phoneInput country resolution', () => {
  it('derives country from locale region', () => {
    expect(derivePhoneCountryFromLocale('en-IN')).toBe('IN');
    expect(derivePhoneCountryFromLocale('fr-FR')).toBe('FR');
    expect(derivePhoneCountryFromLocale('de-DE')).toBe('DE');
  });

  it('derives country from language-only locale via default locale map', () => {
    expect(derivePhoneCountryFromLocale('hi')).toBe('IN');
    expect(derivePhoneCountryFromLocale('ja')).toBe('JP');
  });

  it('normalizes country names and ISO codes', () => {
    expect(normalizePhoneCountryIso2('in')).toBe('IN');
    expect(normalizePhoneCountryIso2('India')).toBe('IN');
    expect(normalizePhoneCountryIso2('United States')).toBe('US');
    expect(normalizePhoneCountryIso2('XX')).toBeNull();
  });

  it('extracts country from record fields', () => {
    expect(extractRecordCountry({ country: 'IN' })).toBe('IN');
    expect(extractRecordCountry({ billingCountry: 'Germany' })).toBe('DE');
    expect(extractRecordCountry({ name: 'Acme' })).toBeNull();
  });

  it('resolves priority: record → org → specific locale → timezone', () => {
    expect(
      resolveDefaultPhoneCountry({
        recordCountry: 'GB',
        orgDefaultPhoneCountry: 'US',
        orgLocale: 'en-IN',
      })
    ).toBe('GB');

    expect(
      resolveDefaultPhoneCountry({
        orgDefaultPhoneCountry: 'AU',
        orgLocale: 'en-IN',
      })
    ).toBe('AU');

    expect(
      resolveDefaultPhoneCountry({
        orgLocale: 'en-IN',
      })
    ).toBe('IN');

    expect(
      resolveDefaultPhoneCountry({
        orgLocale: 'en-US',
        orgTimeZone: 'Asia/Kolkata',
        orgCurrency: 'INR',
      })
    ).toBe('IN');

    expect(resolveDefaultPhoneCountry({})).toBe(DEFAULT_PHONE_COUNTRY);
  });
});
