import type { Component } from 'vue';
import {
  CalendarIcon,
  CheckCircleIcon,
  DocumentTextIcon,
  FlagIcon,
  LinkIcon,
  TagIcon,
  UserIcon,
} from '@heroicons/vue/24/outline';
import type { FilterConfig } from '@/platform/filters/filterResolver';

const FILTER_TYPE_ICONS: Record<string, Component> = {
  text: DocumentTextIcon,
  number: DocumentTextIcon,
  select: FlagIcon,
  'multi-select': TagIcon,
  boolean: CheckCircleIcon,
  user: UserIcon,
  entity: LinkIcon,
  date: CalendarIcon,
};

const DATA_TYPE_ICONS: Record<string, Component> = {
  Text: DocumentTextIcon,
  Number: DocumentTextIcon,
  Date: CalendarIcon,
  DateTime: CalendarIcon,
  Picklist: TagIcon,
  'Multi-Picklist': TagIcon,
  User: UserIcon,
  Lookup: LinkIcon,
  Checkbox: CheckCircleIcon,
  Status: FlagIcon,
  Priority: FlagIcon,
};

export function getFilterFieldIcon(
  filter: Pick<FilterConfig, 'filterType'> & { dataType?: string }
): Component {
  const byFilterType = filter.filterType ? FILTER_TYPE_ICONS[filter.filterType] : undefined;
  if (byFilterType) return byFilterType;

  const byDataType = filter.dataType ? DATA_TYPE_ICONS[filter.dataType] : undefined;
  if (byDataType) return byDataType;

  return DocumentTextIcon;
}
