/**
 * People salutation is stored as `salutation` but edited inline with `first_name`.
 */

export const PEOPLE_SALUTATION_FIELD_KEY = 'salutation';
export const PEOPLE_FIRST_NAME_FIELD_KEY = 'first_name';

export const PEOPLE_SALUTATION_OPTIONS = Object.freeze([
  'Mr.',
  'Ms.',
  'Mrs.',
  'Dr.',
  'Prof.',
  'Mx.',
  'Other',
]);

export function isPeopleSalutationCompanionFieldKey(fieldKey: string): boolean {
  return String(fieldKey || '').trim().toLowerCase() === PEOPLE_SALUTATION_FIELD_KEY;
}

export function isPeopleFirstNameHostField(moduleKey: string, fieldKey: string): boolean {
  return String(moduleKey || '').toLowerCase() === 'people'
    && String(fieldKey || '').trim().toLowerCase() === PEOPLE_FIRST_NAME_FIELD_KEY;
}

export function shouldHidePeopleSalutationFormField(moduleKey: string, fieldKey: string): boolean {
  return String(moduleKey || '').toLowerCase() === 'people'
    && isPeopleSalutationCompanionFieldKey(fieldKey);
}

export function formatPeopleNameWithSalutation(
  salutation?: string | null,
  firstName?: string | null
): string {
  const first = String(firstName || '').trim();
  const sal = String(salutation || '').trim();
  if (!first && !sal) return '';
  if (!sal) return first;
  if (!first) return sal;
  return `${sal} ${first}`;
}

export function formatPeopleFullNameWithSalutation(
  salutation?: string | null,
  firstName?: string | null,
  lastName?: string | null
): string {
  const firstWithSal = formatPeopleNameWithSalutation(salutation, firstName);
  const last = String(lastName || '').trim();
  return [firstWithSal, last].filter(Boolean).join(' ').trim();
}

type SalutationRecord = {
  salutation?: string | null;
  customFields?: Record<string, unknown> | null;
};

export function resolvePeopleSalutation(
  record?: SalutationRecord | null
): string | null {
  const direct = String(record?.salutation || '').trim();
  if (direct) return direct;
  const fromCustom = record?.customFields?.salutation;
  if (fromCustom != null && String(fromCustom).trim()) {
    return String(fromCustom).trim();
  }
  return null;
}

/** Salutation is edited inline with first_name; keep it in quick-create payloads. */
export function augmentPeopleQuickCreateAllowedFieldKeys(
  moduleKey: string,
  allowed: ReadonlySet<string>
): Set<string> {
  const mk = String(moduleKey || '').toLowerCase();
  if (mk !== 'people' || !allowed.has(PEOPLE_FIRST_NAME_FIELD_KEY)) {
    return new Set(allowed);
  }
  const next = new Set(allowed);
  next.add(PEOPLE_SALUTATION_FIELD_KEY);
  return next;
}

type ModuleFieldOption = string | { value?: string; label?: string };

export function getPeopleSalutationOptionsFromModuleFields(
  fields: ReadonlyArray<{ key?: string; options?: ModuleFieldOption[] }> | null | undefined
): string[] {
  const field = (fields || []).find((f) => isPeopleSalutationCompanionFieldKey(f?.key || ''));
  if (Array.isArray(field?.options) && field.options.length > 0) {
    return field.options
      .map((opt) => {
        if (typeof opt === 'string') return opt.trim();
        if (opt && typeof opt === 'object') {
          return String(opt.value ?? opt.label ?? '').trim();
        }
        return '';
      })
      .filter(Boolean);
  }
  return [...PEOPLE_SALUTATION_OPTIONS];
}

export type PeopleFirstNameSavePayload = {
  firstName: string;
  salutation: string | null;
};

export function normalizePeopleFirstNameSavePayload(
  value: unknown,
  currentSalutation?: string | null
): PeopleFirstNameSavePayload {
  if (value && typeof value === 'object' && ('firstName' in value || 'salutation' in value)) {
    const obj = value as { firstName?: string; first_name?: string; salutation?: string | null };
    return {
      firstName: String(obj.firstName ?? obj.first_name ?? '').trim(),
      salutation: obj.salutation ? String(obj.salutation).trim() : null,
    };
  }
  return {
    firstName: String(value ?? '').trim(),
    salutation: currentSalutation ? String(currentSalutation).trim() : null,
  };
}
