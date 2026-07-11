/** Primary market bundle per supported country (ISO 3166-1 alpha-2). */
export const MARKET_BUNDLES = {
  US: { countryIso2: 'US', marketLabel: 'United States', locale: 'en-US', currency: 'USD', language: 'en' },
  CA: { countryIso2: 'CA', marketLabel: 'Canada', locale: 'en-CA', currency: 'CAD', language: 'en' },
  GB: { countryIso2: 'GB', marketLabel: 'United Kingdom', locale: 'en-GB', currency: 'GBP', language: 'en' },
  IN: { countryIso2: 'IN', marketLabel: 'India', locale: 'en-IN', currency: 'INR', language: 'en' },
  AU: { countryIso2: 'AU', marketLabel: 'Australia', locale: 'en-AU', currency: 'AUD', language: 'en' },
  NZ: { countryIso2: 'NZ', marketLabel: 'New Zealand', locale: 'en-NZ', currency: 'NZD', language: 'en' },
  SG: { countryIso2: 'SG', marketLabel: 'Singapore', locale: 'en-SG', currency: 'SGD', language: 'en' },
  AE: { countryIso2: 'AE', marketLabel: 'United Arab Emirates', locale: 'en-AE', currency: 'AED', language: 'en' },
  DE: { countryIso2: 'DE', marketLabel: 'Germany', locale: 'de-DE', currency: 'EUR', language: 'de' },
  FR: { countryIso2: 'FR', marketLabel: 'France', locale: 'fr-FR', currency: 'EUR', language: 'fr' },
  IT: { countryIso2: 'IT', marketLabel: 'Italy', locale: 'it-IT', currency: 'EUR', language: 'it' },
  ES: { countryIso2: 'ES', marketLabel: 'Spain', locale: 'es-ES', currency: 'EUR', language: 'es' },
  NL: { countryIso2: 'NL', marketLabel: 'Netherlands', locale: 'nl-NL', currency: 'EUR', language: 'nl' },
  SE: { countryIso2: 'SE', marketLabel: 'Sweden', locale: 'sv-SE', currency: 'SEK', language: 'en' },
  CH: { countryIso2: 'CH', marketLabel: 'Switzerland', locale: 'de-CH', currency: 'CHF', language: 'de' },
  JP: { countryIso2: 'JP', marketLabel: 'Japan', locale: 'ja-JP', currency: 'JPY', language: 'ja' },
  KR: { countryIso2: 'KR', marketLabel: 'South Korea', locale: 'ko-KR', currency: 'KRW', language: 'ko' },
  CN: { countryIso2: 'CN', marketLabel: 'China', locale: 'zh-CN', currency: 'CNY', language: 'zh' },
  BR: { countryIso2: 'BR', marketLabel: 'Brazil', locale: 'pt-BR', currency: 'BRL', language: 'pt' },
  MX: { countryIso2: 'MX', marketLabel: 'Mexico', locale: 'es-MX', currency: 'MXN', language: 'es' },
  ZA: { countryIso2: 'ZA', marketLabel: 'South Africa', locale: 'en-ZA', currency: 'ZAR', language: 'en' },
  NG: { countryIso2: 'NG', marketLabel: 'Nigeria', locale: 'en-NG', currency: 'NGN', language: 'en' },
  KE: { countryIso2: 'KE', marketLabel: 'Kenya', locale: 'en-KE', currency: 'KES', language: 'en' },
  SA: { countryIso2: 'SA', marketLabel: 'Saudi Arabia', locale: 'ar-SA', currency: 'SAR', language: 'ar' },
  PK: { countryIso2: 'PK', marketLabel: 'Pakistan', locale: 'en-PK', currency: 'PKR', language: 'en' },
  BD: { countryIso2: 'BD', marketLabel: 'Bangladesh', locale: 'en-BD', currency: 'BDT', language: 'en' },
};

const SUPPORTED_COUNTRIES = new Set(Object.keys(MARKET_BUNDLES));

/** Longest-prefix IANA timezone → country (ordered most specific first). */
const TIMEZONE_COUNTRY_RULES = [
  { pattern: /^Asia\/(Kolkata|Calcutta|Colombo)/, country: 'IN' },
  { pattern: /^Asia\/Karachi/, country: 'PK' },
  { pattern: /^Asia\/Dhaka/, country: 'BD' },
  { pattern: /^Asia\/Dubai/, country: 'AE' },
  { pattern: /^Asia\/Riyadh/, country: 'SA' },
  { pattern: /^Asia\/Singapore/, country: 'SG' },
  { pattern: /^Asia\/Tokyo/, country: 'JP' },
  { pattern: /^Asia\/Seoul/, country: 'KR' },
  { pattern: /^Asia\/(Shanghai|Hong_Kong|Chongqing)/, country: 'CN' },
  { pattern: /^Asia\/Kuala_Lumpur/, country: 'SG' },
  { pattern: /^Australia\//, country: 'AU' },
  { pattern: /^Pacific\/Auckland/, country: 'NZ' },
  { pattern: /^Europe\/London/, country: 'GB' },
  { pattern: /^Europe\/Dublin/, country: 'GB' },
  { pattern: /^Europe\/Berlin/, country: 'DE' },
  { pattern: /^Europe\/Paris/, country: 'FR' },
  { pattern: /^Europe\/Rome/, country: 'IT' },
  { pattern: /^Europe\/Madrid/, country: 'ES' },
  { pattern: /^Europe\/Amsterdam/, country: 'NL' },
  { pattern: /^Europe\/Stockholm/, country: 'SE' },
  { pattern: /^Europe\/Zurich/, country: 'CH' },
  { pattern: /^America\/Toronto/, country: 'CA' },
  { pattern: /^America\/Vancouver/, country: 'CA' },
  { pattern: /^America\/(Winnipeg|Edmonton|Halifax)/, country: 'CA' },
  { pattern: /^America\/Sao_Paulo/, country: 'BR' },
  { pattern: /^America\/(Buenos_Aires|Argentina\/)/, country: 'BR' },
  { pattern: /^America\/Mexico_City/, country: 'MX' },
  { pattern: /^America\//, country: 'US' },
  { pattern: /^Africa\/Johannesburg/, country: 'ZA' },
  { pattern: /^Africa\/Lagos/, country: 'NG' },
  { pattern: /^Africa\/Nairobi/, country: 'KE' },
];

/** Unambiguous ISO 4217 → primary country for phone inference. EUR omitted (multi-country). */
const CURRENCY_COUNTRY = {
  USD: 'US',
  INR: 'IN',
  GBP: 'GB',
  CAD: 'CA',
  AUD: 'AU',
  NZD: 'NZ',
  SGD: 'SG',
  AED: 'AE',
  SAR: 'SA',
  JPY: 'JP',
  KRW: 'KR',
  CNY: 'CN',
  BRL: 'BR',
  MXN: 'MX',
  ZAR: 'ZA',
  NGN: 'NG',
  KES: 'KE',
  PKR: 'PK',
  BDT: 'BD',
  CHF: 'CH',
  SEK: 'SE',
};

export function isGenericDefaultLocale(localeTag) {
  if (!localeTag || typeof localeTag !== 'string') return true;
  const trimmed = localeTag.trim();
  return trimmed === '' || trimmed === 'en' || trimmed === 'en-US';
}

function normalizeCountryIso2(value) {
  if (value == null || value === '') return null;
  const upper = String(value).trim().toUpperCase();
  return SUPPORTED_COUNTRIES.has(upper) ? upper : null;
}

export function getMarketBundle(countryIso2) {
  const iso2 = normalizeCountryIso2(countryIso2);
  if (!iso2) return null;
  return MARKET_BUNDLES[iso2] ?? null;
}

export function derivePhoneCountryFromTimezone(timeZone) {
  if (!timeZone || typeof timeZone !== 'string') return null;
  const tz = timeZone.trim();
  if (!tz || tz === 'UTC') return null;

  for (const rule of TIMEZONE_COUNTRY_RULES) {
    if (rule.pattern.test(tz)) {
      return SUPPORTED_COUNTRIES.has(rule.country) ? rule.country : null;
    }
  }

  return null;
}

export function derivePhoneCountryFromCurrency(currencyCode) {
  if (!currencyCode || typeof currencyCode !== 'string') return null;
  const code = currencyCode.trim().toUpperCase();
  const country = CURRENCY_COUNTRY[code];
  if (!country || !SUPPORTED_COUNTRIES.has(country)) return null;
  return country;
}

/**
 * Infer a coherent regional bundle from IANA timezone (primary onboarding / align signal).
 */
export function inferRegionalBundleFromTimezone(timeZone, { language } = {}) {
  const countryIso2 = derivePhoneCountryFromTimezone(timeZone);
  if (!countryIso2) return null;

  const base = getMarketBundle(countryIso2);
  if (!base) return null;

  return {
    ...base,
    timeZone: timeZone?.trim() || 'UTC',
    language: language || base.language,
    marketLabel: base.marketLabel,
  };
}

function localeRegion(localeTag) {
  if (!localeTag || typeof localeTag !== 'string') return null;
  const parts = localeTag.trim().split('-').filter(Boolean);
  if (parts.length < 2) return null;
  return normalizeCountryIso2(parts[parts.length - 1]);
}

/**
 * Detect when timezone, locale, currency, or phone country disagree.
 */
export function detectRegionalMismatch({
  timeZone,
  currency,
  locale,
  defaultPhoneCountry,
  effectivePhoneCountry,
} = {}) {
  const bundle = inferRegionalBundleFromTimezone(timeZone);
  if (!bundle) {
    return { hasMismatch: false, bundle: null, fields: [] };
  }

  const expectedCountry = bundle.countryIso2;
  const fields = [];

  const actualLocaleRegion = localeRegion(locale);
  if (isGenericDefaultLocale(locale) || (actualLocaleRegion && actualLocaleRegion !== expectedCountry)) {
    fields.push('locale');
  }

  if (currency && String(currency).toUpperCase() !== bundle.currency) {
    fields.push('currency');
  }

  const phoneCountry = normalizeCountryIso2(defaultPhoneCountry)
    || normalizeCountryIso2(effectivePhoneCountry);
  if (phoneCountry && phoneCountry !== expectedCountry) {
    fields.push('defaultPhoneCountry');
  } else if (!defaultPhoneCountry && effectivePhoneCountry && effectivePhoneCountry !== expectedCountry) {
    fields.push('phoneAuto');
  }

  return {
    hasMismatch: fields.length > 0,
    bundle,
    fields,
  };
}

/**
 * Apply bundle to form values — keeps user timezone; aligns locale, currency, language, phone auto.
 */
export function applyRegionalBundleToForm(form, bundle) {
  if (!bundle || !form) return form;
  return {
    ...form,
    locale: bundle.locale,
    currency: bundle.currency,
    language: bundle.language,
    defaultPhoneCountry: '',
  };
}
