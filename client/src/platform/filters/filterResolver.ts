import type { FilterType } from '@/platform/fields/peopleFieldModel';

export interface FilterConfig {
  key: string;
  label: string;
  filterType: FilterType;
  fieldPath: string;
  options?: Array<{ value: string; label: string }>;
  priority: number;
}
