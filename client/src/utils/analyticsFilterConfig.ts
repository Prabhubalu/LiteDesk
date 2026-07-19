import type { FilterConfig } from '@/platform/filters/filterResolver';
import type { FilterOperatorId } from '@/platform/filters/filterOperators';
import type { FilterGroupNode } from '@/platform/filters/filterQueryAst';
import {
  compileFilterQueryAst,
  type ServerFilterQuery,
} from '@/platform/filters/filterQueryAstCompiler';
import { inferFallbackFilterConfig } from '@/platform/filters/columnFilterResolver';
import { normalizeFilterSelectOptions } from '@/utils/picklistOptionUtils';

const STATUS_FIELD_KEYS = new Set(['status', 'stage', 'priority']);
const DATE_FIELD_KEYS = new Set([
  'duedate',
  'expectedclosedate',
  'validuntil',
  'createdat',
  'updatedat',
  'completeddate',
  'reminderdate',
]);
const NUMBER_FIELD_KEYS = new Set(['amount', 'actualhours', 'estimatedhours']);
const USER_FIELD_KEYS = new Set([
  'assignedto',
  'assignedby',
  'ownerid',
  'createdby',
  'modifiedby',
  'updatedby',
  'submittedby',
]);

export type AnalyticsFilterFieldSource = {
  key: string;
  label?: string;
  type?: string;
  filterable?: boolean;
  options?: FilterConfig['options'];
};

function normalizeFieldKey(key: string): string {
  const bare = String(key || '').includes('.')
    ? String(key).slice(String(key).lastIndexOf('.') + 1)
    : String(key || '');
  return bare.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function humanizeFieldKey(key: string): string {
  return String(key || '')
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function inferFilterTypeFromKey(fieldKey: string): FilterConfig['filterType'] {
  const normalized = normalizeFieldKey(fieldKey);
  if (USER_FIELD_KEYS.has(normalized)) return 'user';
  if (DATE_FIELD_KEYS.has(normalized) || normalized.endsWith('date') || normalized.endsWith('datetime')) {
    return 'date';
  }
  if (NUMBER_FIELD_KEYS.has(normalized)) return 'number';
  if (STATUS_FIELD_KEYS.has(normalized)) return 'select';
  return 'text';
}

function mapFieldTypeToFilterType(field: AnalyticsFilterFieldSource): FilterConfig['filterType'] {
  const type = String(field.type || '').toLowerCase();
  const normalized = normalizeFieldKey(field.key);

  if (type === 'user' || USER_FIELD_KEYS.has(normalized)) return 'user';
  if (type === 'date') return 'date';
  if (type === 'number' || type === 'currency') return 'number';
  if (
    type === 'picklist' ||
    type === 'select' ||
    type === 'multi-select' ||
    type === 'multiselect' ||
    STATUS_FIELD_KEYS.has(normalized)
  ) {
    return type === 'multi-select' || type === 'multiselect' ? 'multi-select' : 'select';
  }
  if (type === 'boolean') return 'boolean';
  if (type === 'entity' || type === 'lookup') return 'entity';
  return inferFilterTypeFromKey(field.key);
}

export function buildAnalyticsFilterConfigFromFieldKeys(fieldKeys: string[]): FilterConfig[] {
  return buildAnalyticsFilterConfigFromFields(fieldKeys.map((key) => ({ key })));
}

export function buildAnalyticsFilterConfigFromFields(
  fields: AnalyticsFilterFieldSource[],
): FilterConfig[] {
  // Report filters must include every catalog field for the module.
  // Do not honor list-view `filterable: false` — that flag is for column filters only.
  return fields
    .filter((field) => Boolean(field?.key))
    .map((field, index) => {
      const key = field.key;
      const options = normalizeFilterSelectOptions(field.options || []);
      return {
        key,
        label: field.label || humanizeFieldKey(key),
        filterType: mapFieldTypeToFilterType(field),
        fieldPath: key,
        options,
        priority: index + 1,
      };
    });
}

export function buildAnalyticsFilterConfigByKey(filterConfig: FilterConfig[]): Record<string, FilterConfig> {
  return Object.fromEntries(filterConfig.map((item) => [item.key, item]));
}

export function buildAnalyticsFilterTree(
  query: FilterGroupNode,
  filters: Record<string, unknown>,
  operators: Record<string, FilterOperatorId>,
  filterByKey: Record<string, FilterConfig>,
): ServerFilterQuery | null {
  const { filterQuery, flat } = compileFilterQueryAst(query, filters, operators, filterByKey);

  if (filterQuery?.children?.length) {
    return filterQuery;
  }

  const children = Object.entries(flat).map(([fieldKey, value]) => ({
    fieldKey,
    operator: operators[fieldKey] ?? ('is' as FilterOperatorId),
    value,
  }));

  if (children.length === 0) {
    return null;
  }

  return { logic: 'AND', children };
}

export function enrichAnalyticsFilterByKey(
  filterByKey: Record<string, FilterConfig>,
  fieldKey: string,
): FilterConfig {
  return filterByKey[fieldKey] || inferFallbackFilterConfig(fieldKey) || {
    key: fieldKey,
    label: humanizeFieldKey(fieldKey),
    filterType: 'text',
    fieldPath: fieldKey,
    options: [],
    priority: 999,
  };
}
