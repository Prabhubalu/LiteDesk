import { isPeopleSalesRoleFieldKey } from '@/utils/peopleParticipationUi';

/**
 * Central registry for People field value I/O, query paths, and virtual module merge.
 * Single source of truth: participations[appKey].role (e.g. participations.SALES.role).
 * SALES role field: `sales_type` (virtual → participations.SALES.role).
 */

export type PeopleFieldRegistryItem = {
  key: string;
  label: string;
  appKey?: string;
  isVirtual?: boolean;
  getValue: (person: Record<string, unknown>) => unknown;
  setValue?: (person: Record<string, unknown>, value: unknown) => void;
  getQueryPath: () => string;
  /** Seed options for module definition when field is injected */
  defaultPicklistOptions?: string[];
};

type ParticipationsShape = Record<string, Record<string, unknown>>;

const salesTypeField: PeopleFieldRegistryItem = {
  key: 'sales_type',
  label: 'Sales Type',
  appKey: 'SALES',
  isVirtual: true,
  defaultPicklistOptions: ['Lead', 'Contact'],
  getValue: (p) => {
    const participations = p.participations as ParticipationsShape | undefined;
    const fromPart = participations?.SALES?.role ?? null;
    if (fromPart != null && fromPart !== '') return fromPart;
    if (p.sales_type != null && p.sales_type !== '') return p.sales_type;
    // Quick create / attach surfaces use participationType before participations exist
    if (p.participationType != null && p.participationType !== '') return p.participationType;
    return null;
  },
  setValue: (p, v) => {
    const prev = (p.participations as ParticipationsShape) || {};
    p.participations = {
      ...prev,
      SALES: { ...prev.SALES, role: v },
    };
  },
  getQueryPath: () => 'participations.SALES.role',
};

const registry: Record<string, PeopleFieldRegistryItem> = {
  first_name: {
    key: 'first_name',
    label: 'First Name',
    getValue: (p) => p.first_name,
    setValue: (p, v) => {
      p.first_name = v;
    },
    getQueryPath: () => 'first_name',
  },

  sales_type: salesTypeField,

  helpdesk_role: {
    key: 'helpdesk_role',
    label: 'Helpdesk Type',
    appKey: 'HELPDESK',
    isVirtual: true,
    defaultPicklistOptions: ['Customer', 'Agent'],
    getValue: (p) => {
      const participations = p.participations as ParticipationsShape | undefined;
      const fromPart = participations?.HELPDESK?.role ?? null;
      if (fromPart != null && fromPart !== '') return fromPart;
      if (p.helpdesk_role != null && p.helpdesk_role !== '') return p.helpdesk_role;
      if (p.participationType != null && p.participationType !== '') return p.participationType;
      return null;
    },
    setValue: (p, v) => {
      const prev = (p.participations as ParticipationsShape) || {};
      p.participations = {
        ...prev,
        HELPDESK: { ...prev.HELPDESK, role: v },
      };
    },
    getQueryPath: () => 'participations.HELPDESK.role',
  },
};

export const PEOPLE_FIELD_REGISTRY = registry;

export function normalizePeopleRegistryLookupKey(fieldKey: string): string {
  return String(fieldKey || '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '');
}

/**
 * Resolve registry item by stored key (exact or normalized camel/snake).
 */
export function getPeopleRegistryItem(fieldKey: string): PeopleFieldRegistryItem | undefined {
  if (!fieldKey) return undefined;
  const n = normalizePeopleRegistryLookupKey(fieldKey);
  const direct = PEOPLE_FIELD_REGISTRY[fieldKey];
  if (direct) return direct;
  for (const item of Object.values(PEOPLE_FIELD_REGISTRY)) {
    if (normalizePeopleRegistryLookupKey(item.key) === n) return item;
  }
  return undefined;
}

export function getPeopleFieldQueryPath(fieldKey: string): string {
  return getPeopleRegistryItem(fieldKey)?.getQueryPath() ?? fieldKey;
}

/** All registry entries (introspection, module tooling) */
export function getPeopleFields(): PeopleFieldRegistryItem[] {
  return Object.values(PEOPLE_FIELD_REGISTRY);
}

function normalizeModuleFieldKey(k: string | undefined): string {
  return String(k || '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '');
}

function moduleFieldShapeFromRegistry(registryKey: string): Record<string, unknown> {
  const item = PEOPLE_FIELD_REGISTRY[registryKey];
  if (!item?.isVirtual) {
    throw new Error(`peopleFieldRegistry: expected virtual field at ${registryKey}`);
  }
  return {
    key: item.key,
    label: item.label,
    dataType: 'Picklist',
    keyField: false,
    required: false,
    options: item.defaultPicklistOptions ?? [],
    defaultValue: null,
    visibility: { list: true, detail: true },
    order: 999,
    owner: 'platform',
    context: 'app',
    isVirtual: true,
    appKey: item.appKey,
    filterable: true,
    filterType: 'multi-select',
    filterPriority: 2,
  };
}

/**
 * Append virtual People fields from the registry when missing (SALES role: prefer sales_type).
 */
export function mergePeopleVirtualFieldDefinitions<T extends { key?: string }>(fields: T[]): T[] {
  if (!Array.isArray(fields)) return fields;
  const norms = new Set(fields.map((f) => normalizeModuleFieldKey(f?.key)));
  const extras: Record<string, unknown>[] = [];

  const hasSalesRole = fields.some((f) => isPeopleSalesRoleFieldKey(f?.key));
  if (!hasSalesRole) {
    extras.push(moduleFieldShapeFromRegistry('sales_type'));
  }

  const hasHelpdesk = norms.has('helpdesk_role') || norms.has('helpdeskrole');
  if (!hasHelpdesk) {
    extras.push(moduleFieldShapeFromRegistry('helpdesk_role'));
  }

  return extras.length ? [...fields, ...(extras as T[])] : fields;
}
