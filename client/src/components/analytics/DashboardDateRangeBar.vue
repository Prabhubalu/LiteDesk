<template>
  <div class="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-2 dark:border-neutral-700 dark:bg-neutral-800/50">
    <label class="flex items-center gap-2 text-sm">
      <span class="font-medium text-neutral-700 dark:text-neutral-300">
        {{ t('analytics.dashboardDateRangeLabel') }}
      </span>
      <select
        :value="preset"
        class="rounded-lg border border-neutral-300 bg-white px-2 py-1 text-sm dark:border-neutral-600 dark:bg-neutral-900"
        @change="onPresetChange"
      >
        <option v-for="option in presets" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </label>
    <template v-if="preset === 'custom'">
      <label class="flex items-center gap-1 text-sm text-neutral-600 dark:text-neutral-400">
        <span>{{ t('analytics.dateFrom') }}</span>
        <input
          type="date"
          class="rounded-lg border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-600 dark:bg-neutral-900"
          :value="fromDate"
          @change="onFromChange"
        />
      </label>
      <label class="flex items-center gap-1 text-sm text-neutral-600 dark:text-neutral-400">
        <span>{{ t('analytics.dateTo') }}</span>
        <input
          type="date"
          class="rounded-lg border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-600 dark:bg-neutral-900"
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
import type { AnalyticsDateRangePreset, AnalyticsDateRangeValue } from '@/utils/analyticsDateRange';

const props = defineProps<{
  modelValue: AnalyticsDateRangeValue;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: AnalyticsDateRangeValue): void;
}>();

const { t } = useI18n();

const presets = computed(() => [
  { value: 'last7days', label: t('analytics.datePresetLast7') },
  { value: 'last30days', label: t('analytics.datePresetLast30') },
  { value: 'thisMonth', label: t('analytics.datePresetThisMonth') },
  { value: 'custom', label: t('analytics.datePresetCustom') },
]);

const preset = computed(() => props.modelValue.preset || 'last30days');

const fromDate = computed(() => (props.modelValue.from ? props.modelValue.from.slice(0, 10) : ''));
const toDate = computed(() => (props.modelValue.to ? props.modelValue.to.slice(0, 10) : ''));

function onPresetChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value as AnalyticsDateRangePreset;
  emit('update:modelValue', { ...props.modelValue, preset: value });
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
    to: value ? new Date(`${value}T23:59:59`).toISOString() : undefined,
  });
}
</script>
