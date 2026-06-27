import {
  createEmptyGridBindings,
  normalizeTableGridBindings,
  type TableGridBindings
} from '@/utils/builderTableGridModel';

const LEGACY_TABLE_BINDING_KEYS = ['columns', 'showFooter', 'footerRow'] as const;

export function isLegacyTableBindings(bindings: Record<string, unknown> | null | undefined): boolean {
  if (!bindings || typeof bindings !== 'object') return false;
  if (Array.isArray(bindings.grid) && bindings.grid.length) return false;
  return Array.isArray(bindings.columns) && bindings.columns.length > 0;
}

export function toPersistedTableBindings(
  raw: Record<string, unknown> | null | undefined,
  next: Partial<TableGridBindings> = {}
): TableGridBindings {
  const normalized = normalizeTableGridBindings({ ...(raw || {}), ...next });
  return {
    grid: normalized.grid,
    columnWidths: normalized.columnWidths,
    columnWidthPercents: normalized.columnWidthPercents,
    tableWidthPercent: normalized.tableWidthPercent,
    widthUnit: normalized.widthUnit,
    collection: normalized.collection,
    repeatRowIndex: normalized.repeatRowIndex
  };
}

export function stripLegacyTableBindingKeys(bindings: Record<string, unknown>): Record<string, unknown> {
  const next = { ...bindings };
  for (const key of LEGACY_TABLE_BINDING_KEYS) {
    delete next[key];
  }
  return next;
}

export function buildTableBindingsPatch(
  raw: Record<string, unknown> | null | undefined,
  next: Partial<TableGridBindings> = {}
): Record<string, unknown> {
  const persisted = toPersistedTableBindings(raw, next);
  return stripLegacyTableBindingKeys({
    ...(raw || {}),
    ...persisted
  });
}

export function createFreshTableBindings(rows: number, cols: number): TableGridBindings {
  return createEmptyGridBindings(rows, cols);
}
