export function formatKeyToLabel(key: string | null | undefined): string;
export function formatRelatedToForDisplay(value: unknown): string | null;
export function getFieldDisplayLabel(
  field: { key?: string; label?: string; moduleKey?: string } | null,
  moduleKey?: string | null
): string;
export const getPlainTextFromHtml: (html: string) => string;
export function stripHtmlForDetailDisplay(
  value: unknown,
  field?: { key?: string; dataType?: string } | null
): string;
export const getKeyFields: (moduleDefinition: { fields?: unknown[] }) => unknown[];
export function formatDateForDisplay(
  value: string | Date | number,
  dataType?: 'Date' | 'Date-Time' | 'DateTime' | 'date'
): string | null;
export function formatActivityChangeValue(
  value: unknown,
  emptyLabel?: string,
  dataType?: 'Date' | 'Date-Time' | 'DateTime' | 'date'
): string;
export function isIsoDateString(value: unknown): boolean;
export function isObjectIdLike(value: unknown): boolean;
export function formatRawValueForDisplay(
  value: unknown,
  column?: { key?: string; dataType?: string; options?: unknown[] } | null
): string;
export const getFieldValue: (fieldDef: { key: string; dataType?: string; [k: string]: unknown }, record: Record<string, unknown>) => string | null | undefined;
export const getKeyFieldValues: (moduleDefinition: { fields?: unknown[] }, record: Record<string, unknown>) => Array<{ fieldDef: unknown; value: string | null | undefined; label: string }>;
