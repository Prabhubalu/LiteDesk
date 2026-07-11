export function picklistOptionLabel(option: unknown): string;
export function picklistOptionColor(option: unknown): string | null;
export function picklistOptionChipStyle(option: unknown): Record<string, string> | null;
export function picklistOptionKey(option: unknown): string;
export function filterPicklistOptions(options: unknown[], query: unknown): unknown[];
export function findPicklistOptionByValue(options: unknown[], value: unknown): unknown | undefined;

export function normalizeFilterSelectOptions(
  rawOptions?: unknown[]
): Array<{ value: string; label: string }>;
