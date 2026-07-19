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
import { syncRootGroupFromActiveFilters } from '@/platform/filters/filterQueryAstCompiler';
import { isFilterRuleActive } from '@/platform/filters/filterQueryCompiler';
import {
  buildAnalyticsFilterConfigByKey,
  buildAnalyticsFilterConfigFromFields,
  buildAnalyticsFilterConfigFromFieldKeys,
  type AnalyticsFilterFieldSource,
} from '@/utils/analyticsFilterConfig';

export interface ReportFilterState {
  query: FilterGroupNode;
  filters: Record<string, unknown>;
  operators: Record<string, FilterOperatorId>;
}

const props = defineProps<{
  moduleKey: string;
  /** Preferred: full catalog fields (label/type/options). */
  fields?: AnalyticsFilterFieldSource[];
  /** @deprecated Prefer `fields` — key-only fallback. */
  fieldKeys?: string[];
  initialState?: ReportFilterState | null;
}>();

const emit = defineEmits<{
  (e: 'update:state', value: ReportFilterState): void;
}>();

const authStore = useAuthStore();
const filterQuery = ref<FilterGroupNode>(createDefaultRootGroup());
const filterValues = ref<Record<string, unknown>>({});
const filterOperators = ref<Record<string, FilterOperatorId>>({});

const filterConfig = computed(() => {
  if (props.fields?.length) {
    return buildAnalyticsFilterConfigFromFields(props.fields);
  }
  return buildAnalyticsFilterConfigFromFieldKeys(props.fieldKeys || []);
});

const { handleFilterOpened: loadFilterFieldOptions, enrichFilterMap } = useFilterFieldOptions(
  computed(() => props.moduleKey),
  computed(() => String(authStore.user?._id || '')),
);

const filterByKey = computed(() =>
  enrichFilterMap(buildAnalyticsFilterConfigByKey(filterConfig.value), props.moduleKey),
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

/** Ensure query rules exist for every active flat filter (summary can outlive empty AST). */
function reconcileQueryWithFilters() {
  const activeKeys = Object.keys(filterValues.value).filter((key) =>
    isFilterRuleActive(filterValues.value[key], filterOperators.value[key] ?? 'is'),
  );
  if (activeKeys.length === 0) return;

  const queryKeys = new Set<string>();
  const walk = (nodes: FilterGroupNode['children']) => {
    for (const node of nodes) {
      if (node.kind === 'rule' && node.fieldKey) queryKeys.add(node.fieldKey);
      if (node.kind === 'rule' && node.nested) walk(node.nested.children);
      if (node.kind === 'group') walk(node.children);
    }
  };
  walk(filterQuery.value.children);

  const missing = activeKeys.some((key) => !queryKeys.has(key));
  if (!missing) return;

  const configForSync = [...filterConfig.value];
  for (const key of activeKeys) {
    if (configForSync.some((filter) => filter.key === key)) continue;
    configForSync.push({
      key,
      label: key,
      filterType: 'text',
      fieldPath: key,
      options: [],
      priority: 999,
    });
  }

  filterQuery.value = syncRootGroupFromActiveFilters(
    filterQuery.value,
    configForSync,
    filterValues.value,
    filterOperators.value,
  );
}

function resetState(next?: ReportFilterState | null) {
  filterQuery.value = next?.query ? clonePlain(next.query) : createDefaultRootGroup();
  filterValues.value = clonePlain(next?.filters || {});
  filterOperators.value = clonePlain(next?.operators || {}) as Record<string, FilterOperatorId>;
  reconcileQueryWithFilters();
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

// Seed once per mount. Parent remounts via :key / step v-if with latest filterState.
if (props.initialState) {
  resetState(props.initialState);
}

// When catalog fields arrive after seed, repair AST so applied filters paint in the picker.
watch(
  filterConfig,
  () => {
    const before = JSON.stringify(filterQuery.value);
    reconcileQueryWithFilters();
    if (JSON.stringify(filterQuery.value) !== before) {
      emitState();
    }
  },
  { flush: 'post' },
);
</script>
