/** Multi-column list sort helpers (ModuleList / TableView / ListView). */

export type ListSortOrder = 'asc' | 'desc'

export type ListSortSpec = {
  field: string
  order: ListSortOrder
}

export const MAX_LIST_SORTS = 3

export function normalizeSortOrder(value: unknown): ListSortOrder {
  return value === 'asc' ? 'asc' : 'desc'
}

export function normalizeSortSpecs(
  input: unknown,
  options: { max?: number; fallback?: ListSortSpec | null } = {}
): ListSortSpec[] {
  const max = options.max ?? MAX_LIST_SORTS
  const fallback = options.fallback ?? null
  const seen = new Set<string>()
  const out: ListSortSpec[] = []

  const push = (field: unknown, order: unknown) => {
    if (typeof field !== 'string') return
    const key = field.trim()
    if (!key || seen.has(key) || out.length >= max) return
    seen.add(key)
    out.push({ field: key, order: normalizeSortOrder(order) })
  }

  if (Array.isArray(input)) {
    for (const entry of input) {
      if (!entry || typeof entry !== 'object') continue
      const row = entry as { field?: unknown; key?: unknown; order?: unknown }
      push(row.field ?? row.key, row.order)
    }
  } else if (input && typeof input === 'object') {
    const obj = input as {
      sorts?: unknown
      field?: unknown
      order?: unknown
      sortField?: unknown
      sortOrder?: unknown
    }
    if (Array.isArray(obj.sorts)) {
      return normalizeSortSpecs(obj.sorts, { max, fallback })
    }
    push(obj.field ?? obj.sortField, obj.order ?? obj.sortOrder)
  }

  if (out.length === 0 && fallback?.field) {
    return [{ field: fallback.field, order: normalizeSortOrder(fallback.order) }]
  }
  return out
}

/** Primary sort for legacy single-field consumers. */
export function primarySort(
  sorts: ListSortSpec[],
  fallback: ListSortSpec = { field: 'createdAt', order: 'desc' }
): ListSortSpec {
  return sorts[0] ?? fallback
}

export function sortRankForField(sorts: ListSortSpec[], field: string): number | null {
  const idx = sorts.findIndex((s) => s.field === field)
  return idx >= 0 ? idx + 1 : null
}

export function orderForField(sorts: ListSortSpec[], field: string): ListSortOrder | null {
  const found = sorts.find((s) => s.field === field)
  return found ? found.order : null
}

/**
 * Click = replace stack with this column (toggle dir if sole primary).
 * Shift+click = add / toggle direction in the multi-sort stack.
 */
export function applyColumnSortClick(
  current: ListSortSpec[],
  field: string,
  options: { additive?: boolean; max?: number } = {}
): ListSortSpec[] {
  const key = String(field || '').trim()
  if (!key) return normalizeSortSpecs(current)

  const max = options.max ?? MAX_LIST_SORTS
  const sorts = normalizeSortSpecs(current, { max })
  const idx = sorts.findIndex((s) => s.field === key)

  if (options.additive) {
    if (idx === -1) {
      if (sorts.length >= max) return sorts
      return [...sorts, { field: key, order: 'asc' }]
    }
    const existing = sorts[idx]
    if (!existing) return sorts
    const next = sorts.slice()
    next[idx] = {
      field: key,
      order: existing.order === 'asc' ? 'desc' : 'asc'
    }
    return next
  }

  const primary = sorts[0]
  if (sorts.length === 1 && primary?.field === key) {
    return [{ field: key, order: primary.order === 'asc' ? 'desc' : 'asc' }]
  }
  return [{ field: key, order: 'asc' }]
}

export function applyExplicitColumnSort(
  _current: ListSortSpec[],
  field: string,
  order: ListSortOrder
): ListSortSpec[] {
  const key = String(field || '').trim()
  if (!key) return []
  return [{ field: key, order: normalizeSortOrder(order) }]
}

export function removeColumnSort(current: ListSortSpec[], field: string): ListSortSpec[] {
  const key = String(field || '').trim()
  return normalizeSortSpecs(current).filter((s) => s.field !== key)
}

/** Query params: sortBy=a,b&sortOrder=asc,desc (single values stay backward-compatible). */
export function serializeSortsForApi(
  sorts: ListSortSpec[],
  fallback: ListSortSpec = { field: 'createdAt', order: 'desc' }
): { sortBy: string; sortOrder: string } {
  const normalized = normalizeSortSpecs(sorts, { fallback })
  if (normalized.length === 0) {
    return { sortBy: fallback.field, sortOrder: fallback.order }
  }
  const only = normalized[0]
  if (normalized.length === 1 && only) {
    return { sortBy: only.field, sortOrder: only.order }
  }
  return {
    sortBy: normalized.map((s) => s.field).join(','),
    sortOrder: normalized.map((s) => s.order).join(',')
  }
}

export function persistSortPayload(sorts: ListSortSpec[]): {
  field: string
  order: ListSortOrder
  sorts: ListSortSpec[]
} | null {
  const normalized = normalizeSortSpecs(sorts)
  const primary = normalized[0]
  if (!primary) return null
  return {
    field: primary.field,
    order: primary.order,
    sorts: normalized
  }
}

export function parsePersistedSort(raw: unknown): ListSortSpec[] {
  return normalizeSortSpecs(raw)
}
