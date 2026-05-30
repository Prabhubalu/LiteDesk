/**
 * Typings for `fieldContextFilter.js` (vue-tsc / Vercel type-check).
 */
export type FieldContextField = {
  context?: string | null;
  appKey?: string | null;
};

export function appKeyToFieldContextToken(appKey: unknown): string;

export function getCurrentContext(path: string): string;

export function resolveFieldContext(
  path: string,
  query?: Record<string, unknown>
): string;

export function resolveFieldContextToken(field: FieldContextField | null | undefined): string;

export function filterFieldsByContext<T extends FieldContextField>(
  fields: T[] | null | undefined,
  currentContext: string | null | undefined
): T[];

export function isFieldVisibleInContext(
  field: FieldContextField | null | undefined,
  currentContext: string | null | undefined
): boolean;
