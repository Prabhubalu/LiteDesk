export const DEFAULT_CURRENCY_CODE: string;

export interface CurrencyOption {
  code: string;
  name: string;
  symbol?: string;
}

export interface OrgCurrencyRateRow {
  code: string;
  enabled: boolean;
  conversionRate: number;
}

export const CURRENCY_OPTIONS: readonly CurrencyOption[];

export function normalizeCurrencyCode(value: unknown): string | null;
export function resolveOrgCurrencyCode(orgOrSettingsOrCode?: unknown): string;
export function resolveOrgCurrencyRows(orgOrSettings?: unknown): OrgCurrencyRateRow[];
export function getEnabledCurrencyCodes(orgOrSettings?: unknown): string[];
export function getEnabledCurrencyOptions(orgOrSettings?: unknown): CurrencyOption[];
export function getConversionRateVsBase(code?: unknown, orgOrSettings?: unknown): number | null;
export function convertCurrencyAmount(
  amount: number,
  fromCode?: unknown,
  toCode?: unknown,
  orgOrSettings?: unknown
): number | null;
export function applyPreferredCurrencyDisplay(
  amount: number,
  sourceCode: string,
  orgOrSettings?: unknown
): { amount: number; displayCode: string };
export function resolveDisplayCurrencyCode(
  currencyCode?: unknown,
  orgCurrency?: unknown
): string;
export function resolveCurrencyCodeForField(opts?: {
  record?: Record<string, unknown> | null;
  fieldDef?: { key?: string; numberSettings?: Record<string, unknown> } | null;
  currencyCode?: unknown;
  orgCurrency?: unknown;
}): string;
export function getCurrencySymbolFromCode(currencyCode?: string): string;
export function formatCurrencyValue(
  value: unknown,
  opts?: {
    currencyCode?: string | null;
    orgCurrency?: unknown;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
    locale?: string;
  }
): string | null;
export function formatCompactCurrencyValue(
  value: unknown,
  opts?: {
    currencyCode?: string | null;
    orgCurrency?: unknown;
  }
): string;
