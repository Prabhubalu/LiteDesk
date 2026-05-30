/**
 * Helpers for People module field definitions (Settings + /modules/people/quick-create).
 */

import {
  applyDefaultColorsToPicklistOptions,
  buildDefaultColoredPicklistOptions,
  getDefaultParticipationPicklistColor,
} from '@/utils/peopleParticipationPicklistColors';

export type PeopleModuleField = {
  key?: string;
  label?: string;
  dataType?: string;
  options?: unknown[];
};

export const DEFAULT_LEAD_STATUS_OPTIONS = [
  'New',
  'Contacted',
  'Qualified',
  'Disqualified',
  'Nurturing',
  'Re-Engage',
] as const;

export const DEFAULT_CONTACT_STATUS_OPTIONS = ['Active', 'Inactive', 'DoNotContact'] as const;

export function findPeopleModuleField(
  fields: PeopleModuleField[] | null | undefined,
  fieldKey: string
): PeopleModuleField | undefined {
  const target = String(fieldKey || '').toLowerCase();
  return fields?.find((f) => String(f?.key || '').toLowerCase() === target);
}

export type PeoplePicklistOption = {
  value: string;
  label: string;
  color?: string;
  enabled?: boolean;
};

function normalizePicklistOption(opt: unknown): PeoplePicklistOption | null {
  if (opt == null) return null;
  if (typeof opt === 'string') {
    const value = opt.trim();
    if (!value) return null;
    return { value, label: value, enabled: true };
  }
  if (typeof opt === 'object') {
    const row = opt as { enabled?: boolean; value?: unknown; label?: unknown; color?: string };
    if (row.enabled === false) return null;
    const value = String(row.value ?? row.label ?? '').trim();
    if (!value) return null;
    return {
      value,
      label: String(row.label ?? value),
      color: row.color,
      enabled: true,
    };
  }
  return null;
}

/** Enabled picklist values from a module field definition. */
export function picklistValuesFromModuleField(field: PeopleModuleField | null | undefined): string[] {
  return picklistOptionsFromModuleField(field).map((opt) => opt.value);
}

export function picklistOptionsFromModuleField(
  field: PeopleModuleField | null | undefined
): PeoplePicklistOption[] {
  if (!field?.options || !Array.isArray(field.options)) return [];
  return field.options
    .map((opt) => normalizePicklistOption(opt))
    .filter((opt): opt is PeoplePicklistOption => Boolean(opt));
}

export function getPeoplePicklistValues(
  fields: PeopleModuleField[] | null | undefined,
  fieldKey: string,
  fallback: readonly string[] = []
): string[] {
  const field = findPeopleModuleField(fields, fieldKey);
  const fromModule = picklistValuesFromModuleField(field);
  if (fromModule.length > 0) return fromModule;
  return [...fallback];
}

export function getPeoplePicklistOptions(
  fields: PeopleModuleField[] | null | undefined,
  fieldKey: string,
  fallback: readonly string[] = []
): PeoplePicklistOption[] {
  const field = findPeopleModuleField(fields, fieldKey);
  const fromModule = picklistOptionsFromModuleField(field);
  if (fromModule.length > 0) {
    return fromModule.map((opt) => ({
      ...opt,
      color: opt.color || getDefaultParticipationPicklistColor(fieldKey, opt.value),
    }));
  }
  return buildDefaultColoredPicklistOptions(fieldKey, [...fallback]);
}

export function getPeoplePicklistColor(
  fields: PeopleModuleField[] | null | undefined,
  fieldKey: string,
  value: unknown
): string | null {
  if (value == null || value === '') return null;
  const options = getPeoplePicklistOptions(fields, fieldKey, defaultPicklistFallback(fieldKey));
  const match = options.find((opt) => String(opt.value) === String(value));
  return match?.color || getDefaultParticipationPicklistColor(fieldKey, value);
}

export function getPeopleModuleFieldOptionsWithDefaults(
  field: PeopleModuleField | null | undefined
): unknown[] {
  const key = String(field?.key || '').toLowerCase();
  if (!key) return [];
  if (Array.isArray(field?.options) && field.options.length > 0) {
    return applyDefaultColorsToPicklistOptions(key, field.options);
  }
  return buildDefaultColoredPicklistOptions(key, [...defaultPicklistFallback(key)]);
}

export function isPeoplePicklistModuleField(
  fields: PeopleModuleField[] | null | undefined,
  fieldKey: string
): boolean {
  const field = findPeopleModuleField(fields, fieldKey);
  if (!field) return false;
  const dt = String(field.dataType || '').toLowerCase();
  return dt === 'picklist' || dt === 'multi-picklist';
}

export function defaultPicklistFallback(fieldKey: string): readonly string[] {
  const key = String(fieldKey || '').toLowerCase();
  if (key === 'lead_status') return DEFAULT_LEAD_STATUS_OPTIONS;
  if (key === 'contact_status') return DEFAULT_CONTACT_STATUS_OPTIONS;
  return [];
}
