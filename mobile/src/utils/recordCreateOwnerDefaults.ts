/**
 * Default assigned-to fields to the current user on record create.
 * Mirrors client/src/utils/recordCreateOwnerDefaults.ts
 */
const MODULE_CREATE_OWNER_FIELDS: Readonly<Record<string, readonly string[]>> = {
  people: ['assignedTo'],
  organizations: ['assignedTo'],
  tasks: ['assignedTo'],
  deals: ['assignedTo'],
  cases: ['assignedTo'],
  events: ['assignedTo'],
  quotes: ['assignedTo'],
  sales_orders: ['assignedTo'],
  purchase_orders: ['buyerId'],
  purchase_returns: ['ownerId'],
  delivery_returns: ['ownerId'],
  delivery_notes: ['ownerId'],
  invoices: ['assignedTo'],
  documents: ['assignedTo'],
  forms: ['assignedTo'],
  targets: ['assignedTo'],
  templates: ['assignedTo']
}

export function resolveCurrentUserId(
  user: { _id?: unknown; id?: unknown } | null | undefined
): string | null {
  if (!user) return null
  const raw = user._id ?? user.id
  if (raw == null || raw === '') return null
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const nested = (raw as { _id?: unknown; id?: unknown })._id ?? (raw as { id?: unknown }).id
    return nested != null && nested !== '' ? String(nested) : null
  }
  return String(raw)
}

export function getCreateOwnerFieldKeys(moduleKey: string): readonly string[] {
  return MODULE_CREATE_OWNER_FIELDS[moduleKey.toLowerCase().trim()] ?? []
}

function isOwnerFieldValueEmpty(value: unknown): boolean {
  return value === null || value === undefined || value === ''
}

function applyOwnerDefaults(
  data: Record<string, unknown>,
  moduleKey: string,
  userId: string | null,
  options?: { onlyExistingKeys?: boolean }
): Record<string, unknown> {
  if (!userId) return data
  const ownerKeys = getCreateOwnerFieldKeys(moduleKey)
  if (!ownerKeys.length) return data

  const next = { ...data }
  for (const key of ownerKeys) {
    if (options?.onlyExistingKeys && !(key in next)) continue
    if (isOwnerFieldValueEmpty(next[key])) {
      next[key] = userId
    }
  }
  return next
}

export function applyCreateOwnerDefaultsToForm(
  formData: Record<string, unknown>,
  moduleKey: string,
  userId: string | null
): Record<string, unknown> {
  return applyOwnerDefaults(formData, moduleKey, userId, { onlyExistingKeys: true })
}

export function applyCreateOwnerDefaultsToPayload(
  payload: Record<string, unknown>,
  moduleKey: string,
  userId: string | null
): Record<string, unknown> {
  return applyOwnerDefaults(payload, moduleKey, userId)
}
