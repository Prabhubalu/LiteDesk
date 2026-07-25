/**
 * Parse list sort query params into a MongoDB sort object.
 * Supports multi-sort: sortBy=a,b&sortOrder=asc,desc
 * Backward compatible with single sortBy/sortOrder.
 */

const FIELD_RE = /^[a-zA-Z_][a-zA-Z0-9_.]*$/
const MAX_SORTS = 3

/**
 * @param {Record<string, unknown>} query
 * @param {{
 *   allowedFields?: Set<string>|string[]|null,
 *   defaultField?: string,
 *   defaultOrder?: 'asc'|'desc',
 *   max?: number,
 *   tieBreaker?: string|null
 * }} [options]
 * @returns {{ sortObject: Record<string, 1|-1>, sorts: Array<{ field: string, order: 'asc'|'desc' }> }}
 */
function parseListSort(query = {}, options = {}) {
  const {
    allowedFields = null,
    defaultField = 'createdAt',
    defaultOrder = 'desc',
    max = MAX_SORTS,
    tieBreaker = '_id'
  } = options

  const allowed =
    allowedFields == null
      ? null
      : allowedFields instanceof Set
        ? allowedFields
        : new Set(allowedFields)

  const rawFields = String(query.sortBy ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const rawOrders = String(query.sortOrder ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())

  /** @type {Array<{ field: string, order: 'asc'|'desc' }>} */
  const sorts = []
  const seen = new Set()

  for (let i = 0; i < rawFields.length && sorts.length < max; i += 1) {
    const field = rawFields[i]
    if (!FIELD_RE.test(field) || seen.has(field)) continue
    if (allowed && !allowed.has(field)) continue
    seen.add(field)
    const orderToken = rawOrders[i] ?? rawOrders[0] ?? defaultOrder
    const order = orderToken === 'asc' ? 'asc' : 'desc'
    sorts.push({ field, order })
  }

  if (sorts.length === 0) {
    const fallbackField =
      allowed && !allowed.has(defaultField) && allowed.size > 0
        ? [...allowed][0]
        : defaultField
    sorts.push({
      field: fallbackField,
      order: defaultOrder === 'asc' ? 'asc' : 'desc'
    })
  }

  /** @type {Record<string, 1|-1>} */
  const sortObject = {}
  for (const { field, order } of sorts) {
    sortObject[field] = order === 'asc' ? 1 : -1
  }

  if (tieBreaker && !Object.prototype.hasOwnProperty.call(sortObject, tieBreaker)) {
    const primaryDir = sorts[0]?.order === 'asc' ? 1 : -1
    sortObject[tieBreaker] = primaryDir
  }

  return { sortObject, sorts }
}

module.exports = {
  parseListSort,
  MAX_SORTS
}
