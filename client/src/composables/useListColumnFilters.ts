import { computed, type ComputedRef, type Ref } from 'vue';
import { isFilterBuilderEnabled } from '@/platform/filters/filterBuilderFeatureFlag';
import { isColumnHeaderFiltersEnabled } from '@/platform/filters/columnHeaderFiltersFeatureFlag';
import {
  buildFilterConfigByKey,
  listFilterConfigsFromMap,
  type ColumnFilterSource,
} from '@/platform/filters/columnFilterResolver';

export interface UseListColumnFiltersOptions {
  columns: Ref<ColumnFilterSource[]> | ComputedRef<ColumnFilterSource[]>;
  filterFields?: Ref<ColumnFilterSource[]> | ComputedRef<ColumnFilterSource[]>;
  viewMode: Ref<string | null | undefined> | ComputedRef<string | null | undefined>;
  isDesktop: Ref<boolean> | ComputedRef<boolean>;
}

function isListViewMode(viewMode: string | null | undefined): boolean {
  const mode = String(viewMode || 'list').toLowerCase();
  return mode === 'list' || mode === 'table' || mode === '';
}

export function useListColumnFilters(options: UseListColumnFiltersOptions) {
  const featureEnabled = isColumnHeaderFiltersEnabled();

  const builderFieldSources = computed(() => {
    const fields = options.filterFields?.value;
    if (Array.isArray(fields) && fields.length > 0) return fields;
    return options.columns.value;
  });

  const filterConfigByKey = computed(() =>
    buildFilterConfigByKey(options.columns.value)
  );

  const builderFilterConfigByKey = computed(() =>
    buildFilterConfigByKey(builderFieldSources.value)
  );

  const columnFilterConfigList = computed(() =>
    listFilterConfigsFromMap(filterConfigByKey.value)
  );

  const builderFilterConfigList = computed(() =>
    listFilterConfigsFromMap(builderFilterConfigByKey.value)
  );

  const showInlineColumnFilters = computed(
    () =>
      featureEnabled &&
      isListViewMode(options.viewMode.value) &&
      options.isDesktop.value &&
      options.columns.value.length > 0
  );

  const effectiveFilterConfig = computed(() => columnFilterConfigList.value);

  const popoverFilterConfig = computed(() => []);

  const filterBuilderEnabled = isFilterBuilderEnabled();

  const showFilterBuilder = computed(
    () => filterBuilderEnabled && builderFieldSources.value.length > 0
  );

  const showDesktopFiltersPopover = computed(
    () => !filterBuilderEnabled && showInlineColumnFilters.value
  );

  const showLegacyToolbarFilters = computed(
    () =>
      !filterBuilderEnabled &&
      !showInlineColumnFilters.value &&
      options.columns.value.length > 0
  );

  return {
    featureEnabled,
    effectiveFilterConfig,
    filterConfigByKey,
    builderFilterConfigByKey,
    columnFilterConfigList,
    builderFilterConfigList,
    showInlineColumnFilters,
    popoverFilterConfig,
    showDesktopFiltersPopover,
    showLegacyToolbarFilters,
    filterBuilderEnabled,
    showFilterBuilder,
  };
}
