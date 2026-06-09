/**
 * Default assigned-to / owner fields to the current user on record create.
 */
const MODULE_CREATE_OWNER_FIELDS: Readonly<Record<string, readonly string[]>> = {
  people: ['assignedTo'],
  organizations: ['assignedTo'],
  tasks: ['assignedTo'],
  deals: ['ownerId'],
  cases: ['caseOwnerId'],
  events: ['eventOwnerId'],
  quotes: ['ownerId'],
  forms: ['assignedTo'],
  targets: ['ownerId']
};

export function resolveCurrentUserId(
  user: { _id?: unknown; id?: unknown } | null | undefined
): string | null {
  if (!user) return null;
  const raw = user._id ?? user.id;
  if (raw == null || raw === '') return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const nested = (raw as { _id?: unknown; id?: unknown })._id ?? (raw as { id?: unknown }).id;
    return nested != null && nested !== '' ? String(nested) : null;
  }
  return String(raw);
}

export function getCreateOwnerFieldKeys(moduleKey: string): readonly string[] {
  return MODULE_CREATE_OWNER_FIELDS[moduleKey] ?? [];
}

export function isOwnerFieldValueEmpty(value: unknown): boolean {
  return value === null || value === undefined || value === '';
}

function applyOwnerDefaults(
  data: Record<string, unknown>,
  moduleKey: string,
  userId: string | null,
  options?: { onlyExistingKeys?: boolean }
): Record<string, unknown> {
  if (!userId) return data;
  const ownerKeys = getCreateOwnerFieldKeys(moduleKey);
  if (!ownerKeys.length) return data;

  const next = { ...data };
  for (const key of ownerKeys) {
    if (options?.onlyExistingKeys && !(key in next)) continue;
    if (isOwnerFieldValueEmpty(next[key])) {
      next[key] = userId;
    }
  }
  return next;
}

/** Prefill create forms when owner fields are present in the form model. */
export function applyCreateOwnerDefaultsToForm(
  formData: Record<string, unknown>,
  moduleKey: string,
  userId: string | null
): Record<string, unknown> {
  return applyOwnerDefaults(formData, moduleKey, userId, { onlyExistingKeys: true });
}

/** Ensure create payloads include the current user when owner is missing. */
export function applyCreateOwnerDefaultsToPayload(
  payload: Record<string, unknown>,
  moduleKey: string,
  userId: string | null
): Record<string, unknown> {
  return applyOwnerDefaults(payload, moduleKey, userId);
}
