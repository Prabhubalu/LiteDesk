import {
  getPeopleRegistryItem,
  getPeopleFieldQueryPath,
  PEOPLE_FIELD_REGISTRY,
} from '@/platform/fields/peopleFieldRegistry';
import { isPeopleSalesRoleFieldKey } from '@/utils/peopleParticipationUi';

export type PeopleFieldLike = {
  key: string;
  isVirtual?: boolean;
  appKey?: string;
};

function shouldResolveViaPeopleRegistry(
  fieldKey: string,
  formData: Record<string, unknown>,
  opts?: { moduleKey?: string }
): boolean {
  if (opts?.moduleKey?.toLowerCase() === 'people') return true;
  if (fieldKey === 'sales_type' || fieldKey === 'helpdesk_role') return true;
  if (
    isPeopleSalesRoleFieldKey(fieldKey) &&
    formData &&
    formData.participations != null &&
    typeof formData.participations === 'object'
  ) {
    return true;
  }
  return false;
}

/** Mongo/API path for People filters (field key → dot path). */
export function getQueryPath(fieldKey: string): string {
  return getPeopleFieldQueryPath(fieldKey);
}

/** @deprecated Use getQueryPath */
export function mapPeopleFilterKeyToApiParam(fieldKey: string): string {
  return getPeopleFieldQueryPath(fieldKey);
}

/**
 * Read a People value by field key (registry when defined, else top-level).
 * Prefer getFormFieldValue in forms so module context disambiguates legacy `type`.
 */
export function getFieldValue(
  person: Record<string, unknown> | null | undefined,
  fieldKey: string
): unknown {
  if (!person || !fieldKey) return undefined;
  const field = getPeopleRegistryItem(fieldKey);
  if (!field) return person[fieldKey];
  return field.getValue(person);
}

export function getFormFieldValue(
  formData: Record<string, unknown> | null | undefined,
  fieldKey: string,
  _fieldFromModule?: PeopleFieldLike | null,
  opts?: { moduleKey?: string }
): unknown {
  if (!formData || !fieldKey) return undefined;
  if (shouldResolveViaPeopleRegistry(fieldKey, formData, opts)) {
    const reg = getPeopleRegistryItem(fieldKey);
    if (reg) return reg.getValue(formData);
  }
  return formData[fieldKey];
}

export function setFieldValue(
  person: Record<string, unknown>,
  fieldKey: string,
  value: unknown
): void {
  const field = getPeopleRegistryItem(fieldKey);
  if (field?.setValue) {
    field.setValue(person, value);
    return;
  }
  person[fieldKey] = value;
}

export function syncPeopleVirtualFieldKeys(formData: Record<string, unknown>): void {
  const salesReg = getPeopleRegistryItem('sales_type');
  if (salesReg?.getValue) {
    const sales = salesReg.getValue(formData);
    if (sales !== undefined && sales !== null) {
      formData.sales_type = sales;
    }
  }
  const hdReg = getPeopleRegistryItem('helpdesk_role');
  if (hdReg?.getValue) {
    const hd = hdReg.getValue(formData);
    if (hd !== undefined && hd !== null) {
      formData.helpdesk_role = hd;
    }
  }
}

/** Map quick-create participationType to classifier fields for dependency evaluation. */
export function syncParticipationClassifierFields(
  formData: Record<string, unknown>,
  appKey?: string | null
): void {
  const pt = formData.participationType;
  if (pt == null || pt === '') return;
  const upper = String(appKey || '').trim().toUpperCase();
  if (upper === 'SALES' || !upper) {
    formData.sales_type = pt;
  }
  if (upper === 'HELPDESK' || !upper) {
    formData.helpdesk_role = pt;
  }
  syncPeopleVirtualFieldKeys(formData);
}

export function applyVirtualFieldDefault(
  formData: Record<string, unknown>,
  field: Pick<PeopleFieldLike, 'key' | 'isVirtual'>,
  defaultValue: unknown,
  opts?: { moduleKey?: string }
): void {
  const reg = getPeopleRegistryItem(field.key);
  if (!reg?.setValue || !reg.isVirtual) return;
  if (defaultValue === null || defaultValue === undefined || defaultValue === '') return;
  const current = getFormFieldValue(formData, field.key, field, opts);
  if (current !== null && current !== undefined && current !== '') return;
  setFieldValue(formData, field.key, defaultValue);
}

export { getPeopleRegistryItem, getPeopleFieldQueryPath, PEOPLE_FIELD_REGISTRY };
