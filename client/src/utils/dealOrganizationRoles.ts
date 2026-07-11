/**
 * Deal ↔ Organization relationship roles.
 * Role belongs to the deal relationship, not the Organization record.
 * Organization Type is used only as a default when linking.
 */

export const DEAL_ORGANIZATION_ROLES = [
  'customer',
  'partner',
  'reseller',
  'distributor',
  'vendor',
  'other',
] as const;

export type DealOrganizationRole = (typeof DEAL_ORGANIZATION_ROLES)[number];

export const DEAL_ORGANIZATION_ROLE_CUSTOMER: DealOrganizationRole = 'customer';

/** Organization Type (case-insensitive) → Deal Relationship Role. */
const ORG_TYPE_TO_DEAL_ROLE: Readonly<Record<string, DealOrganizationRole>> = Object.freeze({
  customer: 'customer',
  partner: 'partner',
  reseller: 'reseller',
  distributor: 'distributor',
  vendor: 'vendor',
  dealer: 'distributor',
});

const ROLE_PRIORITY: readonly DealOrganizationRole[] = [
  'customer',
  'partner',
  'reseller',
  'distributor',
  'vendor',
  'other',
];

export function isDealOrganizationRole(value: unknown): value is DealOrganizationRole {
  const v = String(value ?? '')
    .trim()
    .toLowerCase();
  return (DEAL_ORGANIZATION_ROLES as readonly string[]).includes(v);
}

export function normalizeDealOrganizationRole(
  value: unknown,
  fallback: DealOrganizationRole = 'other'
): DealOrganizationRole {
  const v = String(value ?? '')
    .trim()
    .toLowerCase();
  return isDealOrganizationRole(v) ? v : fallback;
}

/**
 * Map organization type(s) to a Deal Relationship Role default.
 * Prefer Customer when present among types; otherwise first mapped type by ROLE_PRIORITY.
 */
export function defaultDealOrganizationRoleFromOrgTypes(
  types: unknown
): DealOrganizationRole {
  const list = Array.isArray(types)
    ? types
    : types != null && String(types).trim()
      ? [types]
      : [];

  const mapped: DealOrganizationRole[] = [];
  for (const raw of list) {
    const key = String(raw ?? '')
      .trim()
      .toLowerCase();
    if (!key) continue;
    const role = ORG_TYPE_TO_DEAL_ROLE[key];
    if (role && !mapped.includes(role)) mapped.push(role);
  }

  if (mapped.includes('customer')) return 'customer';
  for (const preferred of ROLE_PRIORITY) {
    if (mapped.includes(preferred)) return preferred;
  }
  return 'other';
}
