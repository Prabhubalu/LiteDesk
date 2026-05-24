<template>
  <div class="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 h-full">
    <div class="flex items-center justify-between gap-2 mb-4">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ displayTitle }}</h3>
      <span v-if="summary.length" class="text-xs text-gray-500">{{ summary.length }}</span>
    </div>

    <div v-if="loading" class="space-y-3">
      <div v-for="i in 2" :key="i" class="h-12 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-700" />
    </div>

    <p v-else-if="!summary.length" class="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
      —
    </p>

    <div v-else class="space-y-4">
      <div v-for="item in summary" :key="item.id" class="space-y-2">
        <div class="flex items-center justify-between gap-2 text-sm">
          <span class="truncate text-gray-700 dark:text-gray-300 font-medium">{{ item.name }}</span>
          <span
            class="shrink-0 tabular-nums text-xs font-semibold"
            :class="item.percent >= 100 ? 'text-emerald-600' : item.percent < 50 ? 'text-amber-600' : 'text-indigo-600'"
          >
            {{ item.percent }}%
          </span>
        </div>
        <div class="h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
          <div
            class="h-full rounded-full bg-indigo-500 transition-all duration-500"
            :style="{ width: `${Math.min(100, item.percent)}%` }"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useTargetSummary } from '@/composables/useTargetSummary';

const props = defineProps({
  appKey: { type: String, required: true },
  moduleKey: { type: String, required: true },
  title: { type: String, default: '' },
});

const { t } = useI18n();
const appKeyRef = computed(() => props.appKey);
const moduleKeyRef = computed(() => props.moduleKey);

const { summary, loading } = useTargetSummary({
  appKey: appKeyRef,
  moduleKey: moduleKeyRef,
});

const displayTitle = computed(() => {
  if (props.title) return props.title;
  if (props.appKey === 'SALES') return t('performance.widgetSalesTitle');
  if (props.appKey === 'HELPDESK') return t('performance.widgetHelpdeskTitle');
  return `${props.appKey} · ${props.moduleKey}`;
});
</script>
