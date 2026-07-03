import type { FilterConfig } from '@/platform/filters/filterResolver';
import type { FilterOperatorId } from '@/platform/filters/filterOperators';
import type { FilterGroupNode } from '@/platform/filters/filterQueryAst';
import {
  compileFilterQueryAst,
  type ServerFilterQuery,
} from '@/platform/filters/filterQueryAstCompiler';
import { inferFallbackFilterConfig } from '@/platform/filters/columnFilterResolver';

const STATUS_FIELD_KEYS = new Set(['status', 'stage', 'priority']);
const DATE_FIELD_KEYS = new Set([
  'duedate',
  'expectedclosedate',
  'validuntil',
  'createdat',
  'updatedat',
]);
const NUMBER_FIELD_KEYS = new Set(['amount']);
const USER_FIELD_KEYS = new Set(['assignedto', 'ownerid', 'createdby']);

function normalizeFieldKey(key: string): string {
  return String(key || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function humanizeFieldKey(key: string): string {
  return String(key || '')
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function inferFilterType(fieldKey: string): FilterConfig['filterType'] {
  const normalized = normalizeFieldKey(fieldKey);
  if (USER_FIELD_KEYS.has(normalized)) return 'user';
  if (DATE_FIELD_KEYS.has(normalized)) return 'date';
  if (NUMBER_FIELD_KEYS.has(normalized)) return 'number';
  if (STATUS_FIELD_KEYS.has(normalized)) return 'select';
  return 'text';
}

export function buildAnalyticsFilterConfigFromFieldKeys(fieldKeys: string[]): FilterConfig[] {
  return fieldKeys.map((fieldKey, index) => ({
    key: fieldKey,
    label: humanizeFieldKey(fieldKey),
    filterType: inferFilterType(fieldKey),
    fieldPath: fieldKey,
    options: [],
    priority: index + 1,
  }));
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
