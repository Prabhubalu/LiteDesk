<template>
  <div class="overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-700">
    <FilterBuilderPanel
      :filter-config="filterConfig"
      :filters="filterValues"
      :filter-by-key="filterByKey"
      :filter-operators="filterOperators"
      :query="filterQuery"
      @apply="onApply"
      @clear-field="onClearField"
      @clear-all="onClearAll"
      @update-query="onUpdateQuery"
      @filter-opened="onFilterOpened"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, toRaw, watch } from 'vue';
import FilterBuilderPanel from '@/components/filters/FilterBuilderPanel.vue';
import { useFilterFieldOptions } from '@/composables/useFilterFieldOptions';
import { useAuthStore } from '@/stores/authRegistry';
import { createDefaultRootGroup } from '@/platform/filters/filterQueryAst';
import type { FilterOperatorId } from '@/platform/filters/filterOperators';
import type { FilterGroupNode } from '@/platform/filters/filterQueryAst';
import {
  buildAnalyticsFilterConfigByKey,
  buildAnalyticsFilterConfigFromFieldKeys,
} from '@/utils/analyticsFilterConfig';

export interface ReportFilterState {
  query: FilterGroupNode;
  filters: Record<string, unknown>;
  operators: Record<string, FilterOperatorId>;
}

const props = defineProps<{
  moduleKey: string;
  fieldKeys: string[];
  initialState?: ReportFilterState | null;
}>();

const emit = defineEmits<{
  (e: 'update:state', value: ReportFilterState): void;
}>();

const authStore = useAuthStore();
const filterQuery = ref<FilterGroupNode>(createDefaultRootGroup());
const filterValues = ref<Record<string, unknown>>({});
const filterOperators = ref<Record<string, FilterOperatorId>>({});

const filterConfig = computed(() => buildAnalyticsFilterConfigFromFieldKeys(props.fieldKeys));
const filterByKey = computed(() => buildAnalyticsFilterConfigByKey(filterConfig.value));

const { handleFilterOpened: loadFilterFieldOptions } = useFilterFieldOptions(
  computed(() => props.moduleKey),
  computed(() => String(authStore.user?._id || '')),
);

/** structuredClone fails on Vue Proxies — unwrap + JSON fallback for Dates/ObjectIds. */
function clonePlain<T>(value: T): T {
  if (value == null) return value;
  const raw = toRaw(value) as T;
  try {
    return structuredClone(raw);
  } catch {
    return JSON.parse(JSON.stringify(raw, (_key, v) => {
      if (v instanceof Date) return v.toISOString();
      if (v != null && typeof v === 'object' && typeof (v as { toISOString?: () => string }).toISOString === 'function') {
        try {
          return (v as { toISOString: () => string }).toISOString();
        } catch {
          return v;
        }
      }
      return v;
    })) as T;
  }
}

function emitState() {
  emit('update:state', {
    query: filterQuery.value,
    filters: { ...filterValues.value },
    operators: { ...filterOperators.value },
  });
}

function resetState(next?: ReportFilterState | null) {
  filterQuery.value = next?.query ? clonePlain(next.query) : createDefaultRootGroup();
  filterValues.value = clonePlain(next?.filters || {});
  filterOperators.value = clonePlain(next?.operators || {}) as Record<string, FilterOperatorId>;
  emitState();
}

function onApply(payload: { key: string; value: unknown; operator: FilterOperatorId }) {
  filterValues.value = { ...filterValues.value, [payload.key]: payload.value };
  filterOperators.value = { ...filterOperators.value, [payload.key]: payload.operator };
  emitState();
}

function onClearField(key: string) {
  const nextFilters = { ...filterValues.value };
  const nextOperators = { ...filterOperators.value };
  delete nextFilters[key];
  delete nextOperators[key];
  filterValues.value = nextFilters;
  filterOperators.value = nextOperators;
  emitState();
}

function onClearAll() {
  filterValues.value = {};
  filterOperators.value = {};
  filterQuery.value = createDefaultRootGroup();
  emitState();
}

function onUpdateQuery(nextQuery: FilterGroupNode) {
  filterQuery.value = nextQuery;
  emitState();
}

function onFilterOpened(key: string) {
  void loadFilterFieldOptions(key, filterByKey.value[key], props.moduleKey);
}

watch(
  () => props.initialState,
  (next) => {
    if (next) {
      resetState(next);
    }
  },
  { immediate: true, deep: true },
);
</script>
