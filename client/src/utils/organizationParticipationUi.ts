/**
 * Organization list/record participation display helpers (People-parallel).
 */
import { getAppLabel } from '@/utils/getRoleDisplay';
import { ORGANIZATION_PARTICIPATION_APP_KEYS } from '@/platform/organizations/organizationParticipation';

export type OrganizationParticipationEntry = {
  appKey: string;
  appLabel: string;
  role: string;
};

export const ORGANIZATION_PARTICIPATION_LIST_VISIBLE_MAX = 2;

/** Prefer participations[APP].role; fall back to denormalized types[] (no app label). */
export function getOrganizationParticipationEntries(
  org: Record<string, unknown> | null | undefined
): OrganizationParticipationEntry[] {
  if (!org) return [];

  const fromParticipations: OrganizationParticipationEntry[] = [];
  const participations = org.participations as
    | Record<string, { role?: string } | null | undefined>
    | undefined;

  if (participations && typeof participations === 'object') {
    for (const appKey of ORGANIZATION_PARTICIPATION_APP_KEYS) {
      const role = String(participations[appKey]?.role ?? '').trim();
      if (!role) continue;
      fromParticipations.push({
        appKey,
        appLabel: getAppLabel(appKey),
        role,
      });
    }
    if (fromParticipations.length > 0) return fromParticipations;
  }

  const types = Array.isArray(org.types) ? org.types : [];
  return types
    .map((t) => String(t ?? '').trim())
    .filter(Boolean)
    .map((role) => ({ appKey: '', appLabel: '', role }));
}

export function resolveOrganizationListParticipationColumnLabel(
  columnKey: string,
  resolveDefaultLabel: () => string,
  t: (key: string, params?: Record<string, unknown>) => string,
  te: (key: string) => boolean
): string {
  if (String(columnKey ?? '').trim().toLowerCase() !== 'types') {
    return resolveDefaultLabel();
  }
  if (te('organizations.listColumnParticipation')) {
    return t('organizations.listColumnParticipation');
  }
  return resolveDefaultLabel();
}
