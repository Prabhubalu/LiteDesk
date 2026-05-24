export function resolveFieldLabel(
  moduleKey: string,
  field: { key?: string; label?: string },
  t: (key: string) => string,
  te: (key: string) => boolean
): string;
