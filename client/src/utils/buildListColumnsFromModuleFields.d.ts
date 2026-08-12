export type ModuleFilterField = {
  key: string;
  label: string;
  dataType: string;
  filterType?: string;
  options?: unknown;
  order?: number;
};

export function isFieldEligibleForModuleFilter(
  moduleKey: string,
  field: { key?: string; isSystem?: boolean; [key: string]: unknown },
  inventoryEnabled?: boolean
): boolean;

export function buildFilterFieldsFromModuleFields(
  fields: Array<Record<string, unknown>>,
  moduleKey: string,
  inventoryEnabled?: boolean
): ModuleFilterField[];

export function buildListColumnsFromModuleFields(
  fields: Array<Record<string, unknown>>,
  moduleKey: string,
  inventoryEnabled?: boolean
): Array<Record<string, unknown>>;
