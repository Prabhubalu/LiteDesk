export type OrgCurrencyMeta = {
  code: string;
  name: string;
  symbol: string;
};

export const TIMEZONE_GROUPS: ReadonlyArray<{
  region: string;
  items: ReadonlyArray<{
    value: string;
    text: string;
    sublabel?: string;
    offset: string;
  }>;
}>;

export const ORG_CURRENCIES: OrgCurrencyMeta[];

export function normalizeIanaTimezone(timeZone: unknown): string;
export function getAllTimezones(): Array<{
  value: string;
  text: string;
  sublabel?: string;
  offset: string;
}>;
export function filterTimezoneGroups(searchQuery?: unknown): typeof TIMEZONE_GROUPS;
export function buildCurrencyOptions(
  currencies?: OrgCurrencyMeta[]
): Array<{ value: string; label: string }>;
