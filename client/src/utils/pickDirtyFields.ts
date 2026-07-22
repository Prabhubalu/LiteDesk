/**
 * Build a partial payload containing only fields that differ from a baseline.
 * Used by Settings forms so audit logs record real user changes only.
 */

function normalizeComparable(value: unknown): unknown {
  if (value === undefined) return null;
  if (value === '') return '';
  return value;
}

function valuesEqual(a: unknown, b: unknown): boolean {
  try {
    return JSON.stringify(normalizeComparable(a)) === JSON.stringify(normalizeComparable(b));
  } catch {
    return a === b;
  }
}

/**
 * @param current Current form values
 * @param original Baseline (last saved) values
 * @param keys Optional allowlist of top-level keys to consider
 */
export function pickDirtyFields<T extends Record<string, unknown>>(
  current: T,
  original: Partial<T> | Record<string, unknown> | null | undefined,
  keys?: (keyof T | string)[]
): Partial<T> {
  const baseline = (original || {}) as Record<string, unknown>;
  const keyList = (keys && keys.length ? keys : Object.keys(current)) as string[];
  const out: Record<string, unknown> = {};

  for (const key of keyList) {
    if (!Object.prototype.hasOwnProperty.call(current, key)) continue;
    const nextVal = current[key as keyof T];
    const prevVal = baseline[key];
    if (!valuesEqual(nextVal, prevVal)) {
      out[key] = nextVal;
    }
  }

  return out as Partial<T>;
}

/**
 * Deep dirty pick for nested plain objects (one level of nesting for section maps).
 * Returns only top-level keys whose JSON snapshot changed.
 */
export function pickDirtyTopLevel<T extends Record<string, unknown>>(
  current: T,
  original: Partial<T> | Record<string, unknown> | null | undefined
): Partial<T> {
  return pickDirtyFields(current, original);
}
