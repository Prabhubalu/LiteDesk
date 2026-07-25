import type { FilterConfig } from '@/platform/filters/filterResolver';

export type FilterOperatorId =
  | 'is'
  | 'is_not'
  | 'is_empty'
  | 'is_not_empty'
  | 'contains'
  | 'not_contains'
  | 'is_any_of';

export interface FilterOperatorDef {
  id: FilterOperatorId;
  labelKey: string;
}

const OPERATORS: Record<FilterOperatorId, FilterOperatorDef> = {
  is: { id: 'is', labelKey: 'common.filterOperatorIs' },
  is_not: { id: 'is_not', labelKey: 'common.filterOperatorIsNot' },
  is_empty: { id: 'is_empty', labelKey: 'common.filterOperatorIsEmpty' },
  is_not_empty: { id: 'is_not_empty', labelKey: 'common.filterOperatorIsNotEmpty' },
  contains: { id: 'contains', labelKey: 'common.filterOperatorContains' },
  not_contains: { id: 'not_contains', labelKey: 'common.filterOperatorNotContains' },
  is_any_of: { id: 'is_any_of', labelKey: 'common.filterOperatorIsAnyOf' },
};

/** Operators that cannot compile to the legacy flat list API. */
const FILTER_QUERY_ONLY_OPERATORS: FilterOperatorId[] = [
  'is_not',
  'is_not_empty',
  'contains',
  'not_contains',
  'is_any_of',
];

const BY_FILTER_TYPE: Record<string, FilterOperatorId[]> = {
  text: ['contains', 'not_contains', 'is_empty', 'is_not_empty'],
  number: ['is', 'is_not', 'is_empty', 'is_not_empty'],
  select: ['is', 'is_not', 'is_any_of', 'is_empty', 'is_not_empty'],
  'multi-select': ['is_any_of', 'is', 'is_not', 'is_empty', 'is_not_empty'],
  boolean: ['is', 'is_not'],
  user: ['is', 'is_not', 'is_empty', 'is_not_empty'],
  entity: ['is', 'is_not', 'is_empty', 'is_not_empty'],
  date: ['is', 'is_not', 'is_empty', 'is_not_empty'],
};

const DEFAULT_OPERATOR: Record<string, FilterOperatorId> = {
  text: 'contains',
  number: 'is',
  select: 'is',
  'multi-select': 'is_any_of',
  boolean: 'is',
  user: 'is',
  entity: 'is',
  date: 'is',
};

export function getOperatorsForFilter(
  filter: Pick<FilterConfig, 'filterType'> | null | undefined
): FilterOperatorDef[] {
  const filterType = String(filter?.filterType || 'text');
  const ids = BY_FILTER_TYPE[filterType] ?? ['is'];
  return ids.map((id) => OPERATORS[id]);
}

export function getDefaultOperatorForFilter(
  filter: Pick<FilterConfig, 'filterType'> | null | undefined
): FilterOperatorId {
  const filterType = String(filter?.filterType || 'text');
  return DEFAULT_OPERATOR[filterType] ?? 'is';
}

export function operatorRequiresValue(operator: FilterOperatorId): boolean {
  return !['is_empty', 'is_not_empty'].includes(operator);
}

export function operatorUsesMultiValue(
  operator: FilterOperatorId,
  filterType?: string
): boolean {
  if (operator === 'is_any_of') return true;
  return filterType === 'multi-select' && operator === 'is';
}

export function operatorRequiresFilterQuery(operator: FilterOperatorId): boolean {
  return FILTER_QUERY_ONLY_OPERATORS.includes(operator);
}
