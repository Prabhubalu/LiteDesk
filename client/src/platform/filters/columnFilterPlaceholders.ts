import type { FilterConfig } from '@/platform/filters/filterResolver';

export type ColumnFilterPlaceholderKind = 'search' | 'filter';

export function getColumnFilterPlaceholderKind(
  filterType: FilterConfig['filterType']
): ColumnFilterPlaceholderKind {
  return filterType === 'text' ? 'search' : 'filter';
}
