<template>
  <div
    v-if="chips.length > 0"
    class="inline-flex min-w-0 flex-wrap items-center gap-2"
    role="region"
    :aria-label="t('common.listActiveFiltersRegion')"
  >
    <span
      v-for="chip in chips"
      :key="chip.id"
      class="inline-flex max-w-full items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 py-1 pl-2.5 pr-1 text-xs font-medium text-indigo-800 dark:border-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-200"
    >
      <span class="truncate">{{ chip.label }}</span>
      <button
        type="button"
        class="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-indigo-600 transition-colors hover:bg-indigo-100 hover:text-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-900/50"
        :aria-label="t('common.listActiveFilterRemove', { label: chip.label })"
        @click="$emit('remove', chip.id)"
      >
        <XMarkIcon class="h-3.5 w-3.5" />
      </button>
    </span>
    <button
      type="button"
      class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
      @click="$emit('clear-all')"
    >
      {{ t('common.listActiveFiltersClearAll') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { XMarkIcon } from '@heroicons/vue/20/solid';
import type { FilterConfig } from '@/platform/filters/filterResolver';
import type { FilterOperatorId } from '@/platform/filters/filterOperators';
import { isFilterRuleActive, resolveActiveFilterChipLabel } from '@/platform/filters/filterQueryCompiler';

const props = defineProps<{
  filters: Record<string, unknown>;
  filterConfig: FilterConfig[];
  filterOperators?: Record<string, FilterOperatorId>;
  searchQuery?: string;
}>();

defineEmits<{
  (e: 'remove', id: string): void;
  (e: 'clear-all'): void;
}>();

const { t } = useI18n();

const chips = computed(() => {
  const items: Array<{ id: string; label: string }> = [];
  const search = String(props.searchQuery || '').trim();
  if (search) {
    items.push({
      id: '__search__',
      label: t('common.listActiveFilterSearch', { query: search }),
    });
  }

  for (const filter of props.filterConfig) {
    const value = props.filters[filter.key];
    const operator = props.filterOperators?.[filter.key] ?? 'is';
    if (!isFilterRuleActive(value, operator)) continue;
    items.push({
      id: filter.key,
      label: resolveActiveFilterChipLabel(filter, value, operator, t),
    });
  }

  return items;
});
</script>
