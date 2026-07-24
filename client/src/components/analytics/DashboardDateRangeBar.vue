<template>
  <div class="flex flex-wrap items-end gap-3">
    <label class="block min-w-[12rem] text-sm">
      <span class="mb-1.5 block text-neutral-700 dark:text-neutral-300">
        {{ t('analytics.dashboardDateRangeLabel') }}
      </span>
      <HeadlessSelect
        :model-value="preset"
        :options="presetOptions"
        teleport
        @update:model-value="onPresetChange"
      />
    </label>
    <template v-if="preset === 'custom'">
      <label class="block min-w-[10rem] text-sm">
        <span class="mb-1.5 block text-neutral-600 dark:text-neutral-400">{{ t('analytics.dateFrom') }}</span>
        <input
          type="date"
          class="block w-full rounded-md border-0 bg-gray-100 px-3 py-2 text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300/20 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 dark:bg-gray-700 dark:text-white dark:outline-white/10 dark:focus:bg-gray-800 dark:focus:outline-indigo-500"
          :value="fromDate"
          @change="onFromChange"
        />
      </label>
      <label class="block min-w-[10rem] text-sm">
        <span class="mb-1.5 block text-neutral-600 dark:text-neutral-400">{{ t('analytics.dateTo') }}</span>
        <input
          type="date"
          class="block w-full rounded-md border-0 bg-gray-100 px-3 py-2 text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300/20 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 dark:bg-gray-700 dark:text-white dark:outline-white/10 dark:focus:bg-gray-800 dark:focus:outline-indigo-500"
          :value="toDate"
          @change="onToChange"
        />
      </label>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import type { AnalyticsDateRangePreset, AnalyticsDateRangeValue } from '@/utils/analyticsDateRange';

const props = defineProps<{
  modelValue: AnalyticsDateRangeValue;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: AnalyticsDateRangeValue): void;
}>();

const { t } = useI18n();

const presetOptions = computed(() => [
  { value: 'today', label: t('analytics.datePresetToday') },
  { value: 'yesterday', label: t('analytics.datePresetYesterday') },
  { value: 'thisWeek', label: t('analytics.datePresetThisWeek') },
  { value: 'last7days', label: t('analytics.datePresetLast7') },
  { value: 'last30days', label: t('analytics.datePresetLast30') },
  { value: 'thisMonth', label: t('analytics.datePresetThisMonth') },
  { value: 'custom', label: t('analytics.datePresetCustom') },
]);

const preset = computed(() => props.modelValue.preset || 'last30days');

const fromDate = computed(() => (props.modelValue.from ? props.modelValue.from.slice(0, 10) : ''));
const toDate = computed(() => (props.modelValue.to ? props.modelValue.to.slice(0, 10) : ''));

function onPresetChange(value: string | number | null) {
  const next = String(value || 'last30days') as AnalyticsDateRangePreset;
  emit('update:modelValue', { ...props.modelValue, preset: next });
}

function onFromChange(event: Event) {
  const value = (event.target as HTMLInputElement).value;
  emit('update:modelValue', {
    ...props.modelValue,
    preset: 'custom',
    from: value ? new Date(`${value}T00:00:00`).toISOString() : undefined,
  });
}

function onToChange(event: Event) {
  const value = (event.target as HTMLInputElement).value;
  emit('update:modelValue', {
    ...props.modelValue,
    preset: 'custom',
    to: value ? new Date(`${value}T23:59:59.999`).toISOString() : undefined,
  });
}
</script>
