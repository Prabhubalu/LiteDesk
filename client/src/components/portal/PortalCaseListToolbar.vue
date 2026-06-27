<template>
  <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div class="relative min-w-0 flex-1">
      <MagnifyingGlassIcon class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
      <input
        :value="search"
        type="search"
        class="min-h-11 w-full rounded-xl py-2.5 pl-9 pr-3 text-sm text-neutral-900 dark:text-white"
        :class="PLATFORM_HOME_INSET_CONTROL_CLASS"
        :placeholder="t('cases.portalCasesSearchPlaceholder')"
        @input="$emit('update:search', $event.target.value)"
      />
    </div>

    <div class="flex flex-wrap gap-2">
      <button
        v-for="chip in filters"
        :key="chip.id"
        type="button"
        class="inline-flex min-h-9 items-center rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
        :class="filter === chip.id
          ? 'border-primary-200 bg-primary-50 text-primary-700 dark:border-primary-500/40 dark:bg-primary-900/25 dark:text-primary-300'
          : [PLATFORM_HOME_FLAT_CHIP_CLASS, PLATFORM_HOME_INSET_CONTROL_CLASS, 'text-neutral-600 dark:text-neutral-300']"
        @click="$emit('update:filter', chip.id)"
      >
        {{ chip.label }}
        <span
          v-if="chip.count != null && chip.count > 0"
          class="ml-1.5 inline-flex min-w-[1.125rem] items-center justify-center rounded-full bg-primary-600 px-1 text-[10px] font-semibold text-white"
        >
          {{ chip.count }}
        </span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { MagnifyingGlassIcon } from '@heroicons/vue/24/outline';
import {
  PLATFORM_HOME_FLAT_CHIP_CLASS,
  PLATFORM_HOME_INSET_CONTROL_CLASS
} from '@/utils/platformHomeLayout';

const props = defineProps({
  search: { type: String, default: '' },
  filter: { type: String, default: 'all' },
  openCount: { type: Number, default: 0 },
  actionCount: { type: Number, default: 0 },
  unreadCount: { type: Number, default: 0 }
});

defineEmits(['update:search', 'update:filter']);

const { t } = useI18n();

const filters = computed(() => [
  { id: 'all', label: t('cases.portalCasesFilterAll') },
  { id: 'open', label: t('cases.portalCasesFilterOpen'), count: props.openCount || null },
  { id: 'action', label: t('cases.portalCasesFilterAction'), count: props.actionCount || null },
  { id: 'closed', label: t('cases.portalCasesFilterClosed') }
]);
</script>
