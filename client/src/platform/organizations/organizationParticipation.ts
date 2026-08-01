/**
 * Organization app participation — client registry.
 * Keep in sync with server/constants/organizationParticipation.js
 */

export const ORGANIZATION_PARTICIPATION_APP_KEYS = [
  'SALES',
  'HELPDESK',
  'INVENTORY',
  'MARKETING',
  'PORTAL',
] as const;

export type OrganizationParticipationAppKey =
  (typeof ORGANIZATION_PARTICIPATION_APP_KEYS)[number];

export const ORGANIZATION_PARTICIPATION_BY_APP: Record<
  OrganizationParticipationAppKey,
  { allowedTypes: readonly string[]; defaultType: string }
> = {
  SALES: { allowedTypes: ['Lead', 'Customer'], defaultType: 'Customer' },
  HELPDESK: { allowedTypes: ['Customer'], defaultType: 'Customer' },
  INVENTORY: { allowedTypes: ['Vendor'], defaultType: 'Vendor' },
  MARKETING: {
    allowedTypes: ['Marketing Lead', 'Customer'],
    defaultType: 'Customer',
  },
  PORTAL: { allowedTypes: ['Partner'], defaultType: 'Partner' },
};

/** Field Config virtual keys → participation app (keep in sync with server). */
export const ORGANIZATION_PARTICIPATION_VIRTUAL_FIELD_TO_APP: Record<
  string,
  OrganizationParticipationAppKey
> = {
  sales_type: 'SALES',
  helpdesk_role: 'HELPDESK',
  inventory_role: 'INVENTORY',
  marketing_role: 'MARKETING',
  portal_role: 'PORTAL',
};

export const ORGANIZATION_PARTICIPATION_ROLE_ORDER = [
  'Lead',
  'Customer',
  'Marketing Lead',
  'Vendor',
  'Partner',
] as const;

export type OrganizationEnabledAppLike =
  | string
  | {
      appKey?: string;
      key?: string;
      status?: string;
      enabled?: boolean;
    };

function normalizeRoleKey(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

export function normalizeOrganizationEnabledAppKeys(
  enabledApps: ReadonlyArray<OrganizationEnabledAppLike> | null | undefined
): Set<string> {
  const set = new Set<string>();
  if (!Array.isArray(enabledApps)) return set;
  for (const raw of enabledApps) {
    const key =
      typeof raw === 'string'
        ? raw
        : raw && typeof raw === 'object'
          ? raw.appKey || raw.key
          : '';
    const upper = String(key || '')
      .trim()
      .toUpperCase();
    if (!upper) continue;
    const status =
      raw && typeof raw === 'object' && raw.status != null
        ? String(raw.status).toUpperCase()
        : 'ACTIVE';
    const enabledFlag =
      raw && typeof raw === 'object' && typeof raw.enabled === 'boolean'
        ? raw.enabled
        : true;
    if (status !== 'ACTIVE' && status !== 'ENABLED') continue;
    if (!enabledFlag) continue;
    set.add(upper);
  }
  return set;
}

/**
 * Roles available from enabled participation apps.
 * When enablement is empty/unknown, baseline = Sales (Lead + Customer).
 */
export function resolveAvailableOrganizationRoles(
  enabledApps: ReadonlyArray<OrganizationEnabledAppLike> | null | undefined
): string[] {
  const enabled = normalizeOrganizationEnabledAppKeys(enabledApps);
  const seen = new Set<string>();
  const out: string[] = [];

  const apps =
    enabled.size === 0
      ? (['SALES'] as OrganizationParticipationAppKey[])
      : ORGANIZATION_PARTICIPATION_APP_KEYS.filter((k) => enabled.has(k));

  for (const appKey of apps) {
    const cfg = ORGANIZATION_PARTICIPATION_BY_APP[appKey];
    if (!cfg) continue;
    for (const role of cfg.allowedTypes) {
      const key = normalizeRoleKey(role);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(role);
    }
  }

  if (out.length === 0) return ['Customer'];

  return ORGANIZATION_PARTICIPATION_ROLE_ORDER.filter((r) =>
    out.some((x) => normalizeRoleKey(x) === normalizeRoleKey(r))
  );
}

export function filterOrganizationTypeDefsByEnabledApps<
  T extends { value?: string; label?: string; enabled?: boolean },
>(
  typeDefs: ReadonlyArray<T> | null | undefined,
  enabledApps: ReadonlyArray<OrganizationEnabledAppLike> | null | undefined
): T[] {
  const allowed = new Set(
    resolveAvailableOrganizationRoles(enabledApps).map(normalizeRoleKey)
  );
  return (Array.isArray(typeDefs) ? typeDefs : []).filter((d) => {
    const value = String(d?.value ?? d?.label ?? '').trim();
    if (!value) return false;
    return allowed.has(normalizeRoleKey(value));
  });
}

export type OrganizationParticipationEntry = {
  appKey: string;
  role: string;
};

export function getOrganizationParticipationEntries(
  org: Record<string, unknown> | null | undefined
): OrganizationParticipationEntry[] {
  if (!org) return [];
  const participations = org.participations;
  if (!participations || typeof participations !== 'object') return [];
  const out: OrganizationParticipationEntry[] = [];
  for (const appKey of ORGANIZATION_PARTICIPATION_APP_KEYS) {
    const entry = (participations as Record<string, { role?: unknown }>)[appKey];
    const role = String(entry?.role ?? '').trim();
    if (!role) continue;
    out.push({ appKey, role });
  }
  return out;
}
