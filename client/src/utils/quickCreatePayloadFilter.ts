type QuickCreateFieldDef = { key?: string; required?: boolean };

function normalizeQuickCreateKey(key: unknown): string {
  return String(key ?? '').toLowerCase().trim();
}

/** quickCreate config keys plus any module fields marked required. */
export function getQuickCreateAllowedFieldKeys(
  quickCreateList: unknown,
  fields: QuickCreateFieldDef[] | null | undefined
): Set<string> {
  const allowed = new Set<string>();
  if (Array.isArray(quickCreateList)) {
    for (const key of quickCreateList) {
      const normalized = normalizeQuickCreateKey(key);
      if (normalized) allowed.add(normalized);
    }
  }
  if (Array.isArray(fields)) {
    for (const field of fields) {
      if (field?.required && field?.key) {
        allowed.add(normalizeQuickCreateKey(field.key));
      }
    }
  }
  return allowed;
}

export function shouldFilterPayloadByQuickCreate(
  effectiveQuickCreateMode: boolean,
  fullMode: boolean,
  quickCreateList: unknown
): boolean {
  return (
    effectiveQuickCreateMode === true &&
    fullMode === false &&
    Array.isArray(quickCreateList) &&
    quickCreateList.length > 0
  );
}

