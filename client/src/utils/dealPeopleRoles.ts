/**
 * Deal ↔ People relationship roles.
 * Role belongs to the deal relationship, not the Person record.
 * isPrimary is independent of role (Primary is not a role).
 */

export const DEAL_PEOPLE_ROLES = [
  'decision_maker',
  'champion',
  'influencer',
  'technical_contact',
  'partner_contact',
  'procurement',
  'legal',
  'other',
] as const;

export type DealPersonRole = (typeof DEAL_PEOPLE_ROLES)[number];

export const DEAL_PERSON_ROLE_DECISION_MAKER: DealPersonRole = 'decision_maker';
export const DEAL_PERSON_ROLE_INFLUENCER: DealPersonRole = 'influencer';

/** Legacy role values → current system roles. */
const LEGACY_ROLE_MAP: Readonly<Record<string, DealPersonRole>> = Object.freeze({
  primary_contact: 'decision_maker',
  decision_maker: 'decision_maker',
  champion: 'champion',
  influencer: 'influencer',
  technical_contact: 'technical_contact',
  partner_contact: 'partner_contact',
  procurement: 'procurement',
  legal: 'legal',
  other: 'other',
});

export function isDealPersonRole(value: unknown): value is DealPersonRole {
  const v = String(value ?? '')
    .trim()
    .toLowerCase();
  return (DEAL_PEOPLE_ROLES as readonly string[]).includes(v);
}

/**
 * Normalize a stored/legacy role to a current Deal Person Role.
 * Unknown values → fallback (default `other`).
 */
export function normalizeDealPersonRole(
  value: unknown,
  fallback: DealPersonRole = 'other'
): DealPersonRole {
  const v = String(value ?? '')
    .trim()
    .toLowerCase();
  if (!v) return fallback;
  if (LEGACY_ROLE_MAP[v]) return LEGACY_ROLE_MAP[v];
  return isDealPersonRole(v) ? v : fallback;
}

/**
 * Default role when adding a person to a deal.
 * First / no primary → Decision Maker; subsequent → Influencer.
 */
export function defaultDealPersonRole(hasPrimaryPerson: boolean): DealPersonRole {
  return hasPrimaryPerson ? DEAL_PERSON_ROLE_INFLUENCER : DEAL_PERSON_ROLE_DECISION_MAKER;
}

/**
 * Enforce: at most one primary among active people; Primary never changes role.
 * Returns a new array when changes are needed.
 */
export function enforceSinglePrimaryPerson<T extends { isPrimary?: boolean; isActive?: boolean }>(
  rows: T[],
  preferredPersonId?: string,
  normalizeId: (value: unknown) => string = (v) => String(v ?? '')
): T[] {
  const next = rows.map((row) => ({ ...row }));
  const preferred = preferredPersonId ? String(preferredPersonId) : '';
  const primaryIndexes: number[] = [];
  for (let i = 0; i < next.length; i += 1) {
    const row = next[i];
    if (row?.isActive === false || !row?.isPrimary) continue;
    primaryIndexes.push(i);
  }
  if (primaryIndexes.length <= 1) return next;

  let keep = primaryIndexes[0];
  if (preferred) {
    const preferredIndex = primaryIndexes.find((idx) => {
      const row = next[idx] as T & { personId?: unknown };
      return normalizeId(row?.personId) === preferred;
    });
    if (preferredIndex !== undefined) keep = preferredIndex;
  }
  for (const idx of primaryIndexes) {
    next[idx] = { ...next[idx], isPrimary: idx === keep };
  }
  return next;
}
