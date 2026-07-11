<template>
  <section class="space-y-2">
    <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div class="min-w-0">
        <h1 class="text-[30px] font-bold leading-tight text-slate-900 dark:text-white">
          {{ dashboardDefinition.title || t('dashboard.dashboardTitleFallback') }}
        </h1>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {{ dashboardDefinition.description || t('dashboard.dashboardDescFallback') }}
        </p>
      </div>
      <div v-if="showControls" class="flex flex-col items-stretch gap-2 sm:items-end">
        <div class="flex flex-wrap items-center justify-end gap-2">
          <div class="flex min-w-[11rem] flex-col gap-0.5">
            <span class="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              {{ t('dashboard.periodLabel') }}
            </span>
            <HeadlessSelect
              :model-value="selectedRangeKey"
              :options="rangeOptions"
              :teleport="true"
              :truncate-button-label="false"
              button-class="!bg-white dark:!bg-slate-900 !outline-slate-200 dark:!outline-slate-700 !py-1.5 !text-xs !font-medium !text-slate-800 dark:!text-slate-100"
              options-class="min-w-[12rem]"
              @update:model-value="$emit('update:range', $event)"
            />
          </div>
          <button
            type="button"
            class="mt-auto inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-400/30 dark:bg-indigo-500/10 dark:text-indigo-200 dark:hover:bg-indigo-500/20"
            @click="$emit('refresh')"
          >
            <ArrowPathIcon class="h-3.5 w-3.5" aria-hidden="true" />
            {{ t('actions.refresh') }}
          </button>
        </div>
        <p
          v-if="rangeWindowLabel"
          class="text-right text-xs font-medium text-slate-600 dark:text-slate-300"
        >
          {{ rangeWindowLabel }}
        </p>
        <p class="text-right text-[11px] text-slate-400 dark:text-slate-500">
          {{ t('dashboard.lastSyncedAt', { time: formattedNow }) }}
        </p>
      </div>
    </div>
  </section>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { ArrowPathIcon } from '@heroicons/vue/24/outline';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';

defineProps({
  dashboardDefinition: { type: Object, required: true },
  formattedNow: { type: String, required: true },
  selectedRangeKey: { type: String, required: true },
  rangeOptions: { type: Array, required: true },
  rangeWindowLabel: { type: String, default: '' },
  showControls: { type: Boolean, default: true }
});

const { t } = useI18n();

defineEmits(['update:range', 'refresh', 'action']);
</script>
