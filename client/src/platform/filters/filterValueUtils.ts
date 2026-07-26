import { parseDateFilterValue, getDateFilterLabel } from '@/utils/dateFilterOptions';
import type { FilterConfig } from '@/platform/filters/filterResolver';

export function isFilterValueActive(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>).length > 0;
  }
  return true;
}

export function resolveFilterDisplayLabel(
  filter: Pick<FilterConfig, 'key' | 'label' | 'filterType' | 'options'>,
  value: unknown
): string {
  if (!isFilterValueActive(value)) return '';

  if (filter.filterType === 'date' && typeof value === 'object') {
    return getDateFilterLabel(parseDateFilterValue(value)) || filter.label;
  }

  if (filter.filterType === 'multi-select') {
    const values = Array.isArray(value)
      ? value
      : value != null && value !== ''
        ? [value]
        : [];
    const labels = values
      .map((entry) => filter.options?.find((opt) => opt.value === entry)?.label || String(entry))
      .filter(Boolean);
    return labels.join(', ');
  }

  const option = filter.options?.find((opt) => opt.value === value);
  if (option?.label) return option.label;

  if (value === 'me') return 'Me';
  if (value === 'unassigned') return 'Unassigned';
  if (value === 'true' || value === true) return 'Yes';
  if (value === 'false' || value === false) return 'No';

  return String(value);
}
