/**
 * Apps whose participations are shown together on People list + record (order matters for display).
 */
import { getRoleDisplay } from '@/utils/getRoleDisplay';

export const PEOPLE_PARTICIPATION_APP_KEYS = ['SALES', 'HELPDESK'] as const;

export type PeopleParticipationAppKey = (typeof PEOPLE_PARTICIPATION_APP_KEYS)[number];

export type PeopleParticipationEntry = {
  appKey: string;
  appLabel: string;
  role: string;
};

/** All non-null participation rows for sidebar/list/record (ALL context). */
export function getPeopleParticipationEntries(
  person: Record<string, unknown> | null | undefined
): PeopleParticipationEntry[] {
  if (!person) return [];
  return PEOPLE_PARTICIPATION_APP_KEYS.map((appKey) => getRoleDisplay(person, appKey))
    .filter(Boolean)
    .map((d) => ({ appKey: d!.app, appLabel: d!.appLabel, role: d!.role }));
}

/** Entries visible for a UI context: ALL = all apps; SALES | HELPDESK = that app only. */
export function filterParticipationEntriesByContext(
  entries: PeopleParticipationEntry[],
  context: string
): PeopleParticipationEntry[] {
  const upper = (context || 'ALL').toUpperCase();
  if (upper === 'ALL') return entries;
  if (PEOPLE_PARTICIPATION_APP_KEYS.includes(upper as PeopleParticipationAppKey)) {
    return entries.filter((e) => e.appKey === upper);
  }
  return entries;
}

export function isPeopleListAppContext(context: string): boolean {
  const upper = (context || 'ALL').toUpperCase();
  return PEOPLE_PARTICIPATION_APP_KEYS.includes(upper as PeopleParticipationAppKey);
}

export const PEOPLE_PARTICIPATION_LIST_VISIBLE_MAX = 1;

function normalizePeopleListParticipationColumnKey(columnKey: string): string {
  const k = String(columnKey ?? '').trim();
  return k === 'type' ? 'sales_type' : k;
}

/** All People: sales_type column reads as cross-app participation, not SALES-only type. */
export function resolvePeopleListParticipationColumnLabel(
  columnKey: string,
  peopleContext: string,
  resolveDefaultLabel: () => string,
  t: (key: string, params?: Record<string, unknown>) => string,
  te: (key: string) => boolean
): string {
  if (normalizePeopleListParticipationColumnKey(columnKey) !== 'sales_type') {
    return resolveDefaultLabel();
  }
  if ((peopleContext || 'ALL').toUpperCase() === 'ALL' && te('people.listColumnParticipation')) {
    return t('people.listColumnParticipation');
  }
  return resolveDefaultLabel();
}

/**
 * Normalized keys (lowercase, hyphens stripped) for the SALES participation role field
 * in module definitions / filters. Matches ModulesAndFields.normalizeFieldKey.
 */
export const PEOPLE_SALES_ROLE_FIELD_KEYS_NORMALIZED = ['sales_type', 'salestype'] as const;

/** Module definition lookup order (canonical SALES classifier) */
export const PEOPLE_SALES_ROLE_MODULE_DEFINITION_KEYS = ['sales_type'] as const;

/**
 * True if field key is the SALES Lead/Contact classifier (sales_type).
 */
export function isPeopleSalesRoleFieldKey(fieldKey: string | null | undefined): boolean {
  const k = String(fieldKey ?? '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '');
  return (PEOPLE_SALES_ROLE_FIELD_KEYS_NORMALIZED as readonly string[]).includes(k);
}

/** Flattened app `fields` (or similar): SALES role from sales_type */
export function getPeopleSalesRoleValueFromFields(
  fields: Record<string, unknown> | null | undefined
): string | undefined {
  if (!fields || typeof fields !== 'object') return undefined;
  const v = fields.sales_type;
  if (v == null || v === '') return undefined;
  return typeof v === 'string' ? v : String(v);
}

export function isPeopleSalesLeadFromFields(
  fields: Record<string, unknown> | null | undefined
): boolean {
  const v = getPeopleSalesRoleValueFromFields(fields);
  if (!v) return false;
  return v.toLowerCase() === 'lead';
}
