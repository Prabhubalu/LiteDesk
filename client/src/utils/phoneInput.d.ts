export const DEFAULT_PHONE_COUNTRY: string;
export const RECORD_COUNTRY_FIELD_KEYS: readonly string[];

export interface PhoneCountry {
  iso2: string;
  name: string;
  dialCode: string;
  minLength: number;
  maxLength: number;
}

export const PHONE_COUNTRIES: readonly PhoneCountry[];

export function isSupportedPhoneCountry(iso2: unknown): boolean;
export function normalizePhoneCountryIso2(value: unknown): string | null;
export function derivePhoneCountryFromLocale(localeTag: unknown): string | null;
export function extractRecordCountry(source: unknown): string | null;

export function resolveDefaultPhoneCountry(opts: {
  recordCountry?: string | null;
  orgDefaultPhoneCountry?: string | null;
  orgLocale?: string | null;
  orgTimeZone?: string | null;
  orgCurrency?: string | null;
}): string;

export function getPhoneCountry(iso2?: string): PhoneCountry | undefined;
export function sanitizePhoneDigits(value: unknown, maxLen?: number): string;
export function parsePhoneValue(
  value: unknown,
  fallbackCountryIso2?: string
): { country: string; nationalNumber: string };
export function formatPhoneValue(country: string, nationalNumber: string): string;
export function sanitizeInternationalPhone(value: unknown, fallbackCountryIso2?: string): string;
export function isValidOptionalInternationalPhone(value: unknown): boolean;
export function getPhoneValidationMessage(country: string | PhoneCountry | null | undefined): string;
export function validatePhoneValue(
  value: unknown,
  fallbackCountryIso2?: string
): { valid: boolean; message?: string };
export function preventNonDigitPhoneKeys(event: KeyboardEvent): void;
