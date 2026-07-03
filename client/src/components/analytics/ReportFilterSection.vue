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
import { computed, ref, watch } from 'vue';
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

function emitState() {
  emit('update:state', {
    query: filterQuery.value,
    filters: { ...filterValues.value },
    operators: { ...filterOperators.value },
  });
}

function resetState(next?: ReportFilterState | null) {
  filterQuery.value = next?.query ? structuredClone(next.query) : createDefaultRootGroup();
  filterValues.value = { ...(next?.filters || {}) };
  filterOperators.value = { ...(next?.operators || {}) };
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
  { immediate: true },
);
</script>
