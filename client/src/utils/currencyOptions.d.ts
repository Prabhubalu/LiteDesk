export const DEFAULT_CURRENCY_CODE: string;

export interface CurrencyOption {
  code: string;
  name: string;
}

export const CURRENCY_OPTIONS: readonly CurrencyOption[];

export function normalizeCurrencyCode(value: unknown): string | null;
export function resolveOrgCurrencyCode(orgOrSettingsOrCode?: unknown): string;
export function resolveCurrencyCodeForField(opts?: {
  fieldCurrency?: unknown;
  recordCurrency?: unknown;
  orgCurrency?: unknown;
}): string;
export function getCurrencySymbolFromCode(currencyCode?: string): string;
export function formatCurrencyValue(
  value: unknown,
  opts?: {
    currencyCode?: string | null;
    orgCurrency?: unknown;
    locale?: string;
  }
): string;
export function formatCompactCurrencyValue(
  value: unknown,
  opts?: {
    currencyCode?: string | null;
    orgCurrency?: unknown;
  }
): string;
