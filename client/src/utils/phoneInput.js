import { LANGUAGE_TO_DEFAULT_LOCALE } from '@/i18n/constants';
import {
  derivePhoneCountryFromCurrency,
  derivePhoneCountryFromTimezone,
  isGenericDefaultLocale,
} from '@/utils/regionalSettings';

export const DEFAULT_PHONE_COUNTRY = 'US';

/** Field keys (case-insensitive) checked for record-level phone country context. */
export const RECORD_COUNTRY_FIELD_KEYS = [
  'country',
  'billingcountry',
  'mailingcountry',
  'addresscountry',
];

export const PHONE_COUNTRIES = [
  { iso2: 'US', name: 'United States', dialCode: '1', minLength: 10, maxLength: 10 },
  { iso2: 'CA', name: 'Canada', dialCode: '1', minLength: 10, maxLength: 10 },
  { iso2: 'GB', name: 'United Kingdom', dialCode: '44', minLength: 10, maxLength: 10 },
  { iso2: 'IN', name: 'India', dialCode: '91', minLength: 10, maxLength: 10 },
  { iso2: 'AU', name: 'Australia', dialCode: '61', minLength: 9, maxLength: 9 },
  { iso2: 'NZ', name: 'New Zealand', dialCode: '64', minLength: 8, maxLength: 10 },
  { iso2: 'SG', name: 'Singapore', dialCode: '65', minLength: 8, maxLength: 8 },
  { iso2: 'AE', name: 'United Arab Emirates', dialCode: '971', minLength: 9, maxLength: 9 },
  { iso2: 'DE', name: 'Germany', dialCode: '49', minLength: 5, maxLength: 11 },
  { iso2: 'FR', name: 'France', dialCode: '33', minLength: 9, maxLength: 9 },
  { iso2: 'IT', name: 'Italy', dialCode: '39', minLength: 6, maxLength: 10 },
  { iso2: 'ES', name: 'Spain', dialCode: '34', minLength: 9, maxLength: 9 },
  { iso2: 'NL', name: 'Netherlands', dialCode: '31', minLength: 9, maxLength: 9 },
  { iso2: 'SE', name: 'Sweden', dialCode: '46', minLength: 7, maxLength: 10 },
  { iso2: 'CH', name: 'Switzerland', dialCode: '41', minLength: 9, maxLength: 9 },
  { iso2: 'JP', name: 'Japan', dialCode: '81', minLength: 10, maxLength: 10 },
  { iso2: 'KR', name: 'South Korea', dialCode: '82', minLength: 9, maxLength: 10 },
  { iso2: 'CN', name: 'China', dialCode: '86', minLength: 11, maxLength: 11 },
  { iso2: 'BR', name: 'Brazil', dialCode: '55', minLength: 10, maxLength: 11 },
  { iso2: 'MX', name: 'Mexico', dialCode: '52', minLength: 10, maxLength: 10 },
  { iso2: 'ZA', name: 'South Africa', dialCode: '27', minLength: 9, maxLength: 9 },
  { iso2: 'NG', name: 'Nigeria', dialCode: '234', minLength: 10, maxLength: 10 },
  { iso2: 'KE', name: 'Kenya', dialCode: '254', minLength: 9, maxLength: 9 },
  { iso2: 'SA', name: 'Saudi Arabia', dialCode: '966', minLength: 9, maxLength: 9 },
  { iso2: 'PK', name: 'Pakistan', dialCode: '92', minLength: 10, maxLength: 10 },
  { iso2: 'BD', name: 'Bangladesh', dialCode: '880', minLength: 10, maxLength: 10 },
];

export function isSupportedPhoneCountry(iso2) {
  if (!iso2 || typeof iso2 !== 'string') return false;
  const normalized = iso2.trim().toUpperCase();
  return PHONE_COUNTRIES.some((country) => country.iso2 === normalized);
}

export function normalizePhoneCountryIso2(value) {
  if (value == null || value === '') return null;
  const token = String(value).trim();
  if (!token) return null;

  const upper = token.toUpperCase();
  if (upper.length === 2 && isSupportedPhoneCountry(upper)) {
    return upper;
  }

  const lower = token.toLowerCase();
  const byName = PHONE_COUNTRIES.find(
    (country) => country.name.toLowerCase() === lower || country.iso2.toLowerCase() === lower
  );
  return byName?.iso2 ?? null;
}

/**
 * Derive a supported phone country from a BCP 47 locale tag (e.g. en-IN → IN).
 */
export function derivePhoneCountryFromLocale(localeTag) {
  if (!localeTag || typeof localeTag !== 'string') return null;
  const trimmed = localeTag.trim();
  if (!trimmed) return null;

  const parts = trimmed.split('-').filter(Boolean);
  if (parts.length >= 2) {
    const fromRegion = normalizePhoneCountryIso2(parts[parts.length - 1]);
    if (fromRegion) return fromRegion;
  }

  const language = parts[0]?.toLowerCase();
  if (language && language in LANGUAGE_TO_DEFAULT_LOCALE) {
    return derivePhoneCountryFromLocale(LANGUAGE_TO_DEFAULT_LOCALE[language]);
  }

  return null;
}

/**
 * Extract country ISO2 from a record or form object (supports ISO2 and full country names).
 */
export function extractRecordCountry(source) {
  if (!source || typeof source !== 'object') return null;

  for (const key of Object.keys(source)) {
    if (!RECORD_COUNTRY_FIELD_KEYS.includes(key.toLowerCase())) continue;
    const normalized = normalizePhoneCountryIso2(source[key]);
    if (normalized) return normalized;
  }

  return null;
}

/**
 * Priority: record → org explicit → specific locale → timezone → currency → generic locale → US.
 */
export function resolveDefaultPhoneCountry({
  recordCountry = null,
  orgDefaultPhoneCountry = null,
  orgLocale = null,
  orgTimeZone = null,
  orgCurrency = null,
} = {}) {
  const fromRecord = normalizePhoneCountryIso2(recordCountry);
  if (fromRecord) return fromRecord;

  const fromOrg = normalizePhoneCountryIso2(orgDefaultPhoneCountry);
  if (fromOrg) return fromOrg;

  const fromLocale = derivePhoneCountryFromLocale(orgLocale);
  if (fromLocale && !isGenericDefaultLocale(orgLocale)) {
    return fromLocale;
  }

  const fromTimezone = derivePhoneCountryFromTimezone(orgTimeZone);
  if (fromTimezone) return fromTimezone;

  const fromCurrency = derivePhoneCountryFromCurrency(orgCurrency);
  if (fromCurrency) return fromCurrency;

  if (fromLocale) return fromLocale;

  return DEFAULT_PHONE_COUNTRY;
}

export function getPhoneCountry(iso2 = DEFAULT_PHONE_COUNTRY) {
  return PHONE_COUNTRIES.find((country) => country.iso2 === iso2) || PHONE_COUNTRIES[0];
}

/**
 * Phone number body: digits only. E.164 allows up to 15 total digits including country code.
 */
export function sanitizePhoneDigits(value, maxLen = 15) {
  if (value == null || value === '') return '';
  return String(value).replace(/\D/g, '').slice(0, maxLen);
}

export function parsePhoneValue(value, fallbackCountryIso2 = DEFAULT_PHONE_COUNTRY) {
  const fallbackCountry = getPhoneCountry(fallbackCountryIso2);
  const raw = value == null ? '' : String(value).trim();
  const digits = sanitizePhoneDigits(raw);

  if (!raw.startsWith('+') || !digits) {
    return {
      country: fallbackCountry,
      nationalNumber: digits.slice(0, Math.max(0, 15 - fallbackCountry.dialCode.length)),
    };
  }

  const country = [...PHONE_COUNTRIES]
    .sort((a, b) => b.dialCode.length - a.dialCode.length)
    .find((candidate) => digits.startsWith(candidate.dialCode)) || fallbackCountry;

  return {
    country,
    nationalNumber: digits.slice(country.dialCode.length, 15),
  };
}

export function formatPhoneValue(country, nationalNumber) {
  const selectedCountry = country || getPhoneCountry();
  const localDigits = sanitizePhoneDigits(nationalNumber, Math.max(0, 15 - selectedCountry.dialCode.length));
  if (!localDigits) return '';
  return `+${selectedCountry.dialCode}${localDigits}`;
}

export function sanitizeInternationalPhone(value, fallbackCountryIso2 = DEFAULT_PHONE_COUNTRY) {
  const { country, nationalNumber } = parsePhoneValue(value, fallbackCountryIso2);
  return formatPhoneValue(country, nationalNumber);
}

export function isValidOptionalInternationalPhone(value) {
  return validatePhoneValue(value).isValid;
}

export function getPhoneValidationMessage(country) {
  const selectedCountry = country || getPhoneCountry();
  const { minLength, maxLength } = selectedCountry;
  if (minLength && maxLength && minLength === maxLength) {
    return `Enter a ${minLength}-digit phone number for ${selectedCountry.name}, or leave this field empty.`;
  }
  if (minLength && maxLength) {
    return `Enter a ${minLength}-${maxLength} digit phone number for ${selectedCountry.name}, or leave this field empty.`;
  }
  return `Enter a valid phone number for ${selectedCountry.name}, or leave this field empty.`;
}

export function validatePhoneValue(value, fallbackCountryIso2 = DEFAULT_PHONE_COUNTRY) {
  const raw = value == null ? '' : String(value).trim();
  if (!raw) return { isValid: true, error: null, country: getPhoneCountry(fallbackCountryIso2) };

  const parsed = parsePhoneValue(raw, fallbackCountryIso2);
  const totalDigits = sanitizePhoneDigits(raw).length;
  const isInternationalShape = raw.startsWith('+') && totalDigits <= 15 && /^[1-9]/.test(sanitizePhoneDigits(raw));
  const localLength = parsed.nationalNumber.length;
  const min = parsed.country.minLength || 1;
  const max = parsed.country.maxLength || Math.max(1, 15 - parsed.country.dialCode.length);
  const isValid = isInternationalShape && localLength >= min && localLength <= max;

  return {
    isValid,
    error: isValid ? null : getPhoneValidationMessage(parsed.country),
    country: parsed.country,
  };
}

/**
 * Keydown: block printable non-digits so text never appears (paste is still cleaned in @input).
 * Does not interfere with Ctrl/Cmd/Alt shortcuts or navigation keys.
 */
export function preventNonDigitPhoneKeys(event) {
  if (!event || event.defaultPrevented) return;
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const k = event.key;
  if (k.length === 1 && !/\d/.test(k)) {
    event.preventDefault();
  }
}
