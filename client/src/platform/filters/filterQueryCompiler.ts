import type { FilterConfig } from '@/platform/filters/filterResolver';
import type { FilterOperatorId } from '@/platform/filters/filterOperators';
import { operatorRequiresValue } from '@/platform/filters/filterOperators';
import { isFilterValueActive, resolveFilterDisplayLabel } from '@/platform/filters/filterValueUtils';

const OPERATOR_LABEL_KEYS: Record<FilterOperatorId, string> = {
  is: 'common.filterOperatorIs',
  is_not: 'common.filterOperatorIsNot',
  is_empty: 'common.filterOperatorIsEmpty',
  is_not_empty: 'common.filterOperatorIsNotEmpty',
  contains: 'common.filterOperatorContains',
  not_contains: 'common.filterOperatorNotContains',
  is_any_of: 'common.filterOperatorIsAnyOf',
};

export function resolveOperatorLabelKey(operator: FilterOperatorId): string {
  return OPERATOR_LABEL_KEYS[operator] ?? OPERATOR_LABEL_KEYS.is;
}

export function resolveActiveFilterChipLabel(
  filter: FilterConfig,
  value: unknown,
  operator: FilterOperatorId,
  t: (key: string) => string
): string {
  const fieldLabel = filter.label || filter.key;
  const operatorLabel = t(resolveOperatorLabelKey(operator));

  if (!operatorRequiresValue(operator)) {
    return `${fieldLabel} ${operatorLabel}`;
  }

  const valueLabel = resolveFilterDisplayLabel(filter, value);
  if (!valueLabel) return `${fieldLabel} ${operatorLabel}`;
  return `${fieldLabel} ${operatorLabel} ${valueLabel}`;
}

/**
 * Compiles UI operator + value to flat API filter value (Phase 1 — no server AST).
 */
export function compileOperatorValueForApi(
  filter: Pick<FilterConfig, 'key' | 'filterType'>,
  value: unknown,
  operator: FilterOperatorId
): unknown {
  if (operator === 'is_empty') {
    if (filter.filterType === 'user') return 'unassigned';
    if (filter.filterType === 'entity' && filter.key === 'organization') return '';
    return null;
  }
  if (operator === 'is_not_empty') {
    if (filter.filterType === 'user') return 'assigned';
    if (filter.filterType === 'entity' && filter.key === 'organization') return 'has';
    return '__not_empty__';
  }
  if (operator === 'is_any_of') {
    if (Array.isArray(value)) return value;
    if (value == null || value === '') return [];
    return [value];
  }
  return value;
}

export function compileAllFiltersForApi(
  filters: Record<string, unknown>,
  operators: Record<string, FilterOperatorId>,
  filterByKey: Record<string, FilterConfig>
): Record<string, unknown> {
  const compiled: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(filters), ...Object.keys(operators)]);

  for (const key of keys) {
    const operator = operators[key] ?? 'is';
    if (!isFilterRuleActive(filters[key], operator)) continue;
    const filter = filterByKey[key];
    if (!filter) continue;
    compiled[key] = compileOperatorValueForApi(filter, filters[key], operator);
  }

  return compiled;
}

export function isFilterRuleActive(
  value: unknown,
  operator: FilterOperatorId
): boolean {
  if (!operatorRequiresValue(operator)) return true;
  return isFilterValueActive(value);
}
