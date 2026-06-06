<template>
  <div class="flex flex-col">
    <div class="flex items-center gap-2 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
        {{ t('common.listFilters') }}
      </h3>
      <HoverTooltip :content="t('common.filterBuilderInfo')" placement="above">
        <InformationCircleIcon class="h-4 w-4 text-gray-400" />
      </HoverTooltip>
    </div>

    <div class="max-h-[60vh] space-y-3 overflow-y-auto overflow-x-visible p-4">
      <FilterGroupBlock
        :group="query"
        :filters="filters"
        :filter-config="filterConfig"
        :filter-by-key="filterByKey"
        :filter-operators="filterOperators"
        :used-field-keys="usedFieldKeys"
        @apply="$emit('apply', $event)"
        @clear-field="$emit('clear-field', $event)"
        @filter-opened="(key) => $emit('filter-opened', key)"
        @update-group="onUpdateGroup"
      />
    </div>

    <div class="flex items-center justify-between border-t border-gray-200 px-4 py-3 dark:border-gray-700">
      <button
        type="button"
        class="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        @click="onAddRule"
      >
        <PlusIcon class="h-4 w-4" />
        {{ t('common.filterBuilderAddFilter') }}
      </button>
      <button
        v-if="hasActiveFilters"
        type="button"
        class="text-sm font-medium text-red-600 transition-colors hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
        @click="$emit('clear-all')"
      >
        {{ t('common.filterBuilderClearAll') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { InformationCircleIcon, PlusIcon } from '@heroicons/vue/24/outline';
import HoverTooltip from '@/components/common/HoverTooltip.vue';
import FilterGroupBlock from '@/components/filters/FilterGroupBlock.vue';
import { appendRuleToGroup } from '@/platform/filters/filterQueryAst';
import type { FilterConfig } from '@/platform/filters/filterResolver';
import type { FilterOperatorId } from '@/platform/filters/filterOperators';
import { isFilterRuleActive } from '@/platform/filters/filterQueryCompiler';
import type { FilterGroupNode } from '@/platform/filters/filterQueryAst';
import { collectRuleFieldKeys } from '@/platform/filters/filterQueryAst';
import { syncRootGroupFromActiveFilters } from '@/platform/filters/filterQueryAstCompiler';

const props = defineProps<{
  filterConfig: FilterConfig[];
  filters: Record<string, unknown>;
  filterByKey: Record<string, FilterConfig>;
  filterOperators: Record<string, FilterOperatorId>;
  query: FilterGroupNode;
}>();

const emit = defineEmits<{
  (e: 'apply', payload: { key: string; value: unknown; operator: FilterOperatorId }): void;
  (e: 'clear-field', key: string): void;
  (e: 'clear-all'): void;
  (e: 'filter-opened', key: string): void;
  (e: 'update-query', query: FilterGroupNode): void;
}>();

const { t } = useI18n();

const usedFieldKeys = computed(() => new Set(collectRuleFieldKeys(props.query)));

const hasActiveFilters = computed(() => {
  const keys = new Set([...Object.keys(props.filters), ...Object.keys(props.filterOperators)]);
  for (const key of keys) {
    const operator = props.filterOperators[key] ?? 'is';
    if (isFilterRuleActive(props.filters[key], operator)) return true;
  }
  return false;
});

function onUpdateGroup(group: FilterGroupNode) {
  emit('update-query', group);
}

function onAddRule() {
  emit('update-query', appendRuleToGroup(props.query));
}

function syncRowsFromFilters() {
  emit('update-query', syncRootGroupFromActiveFilters(
    props.query,
    props.filterConfig,
    props.filters,
    props.filterOperators
  ));
}

defineExpose({ syncRowsFromFilters });
</script>
