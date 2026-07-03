<template>
  <div class="min-h-screen bg-neutral-50 px-4 py-6 dark:bg-neutral-950">
    <div v-if="loading" class="py-16 text-center text-sm text-neutral-500">{{ t('states.loading') }}</div>
    <div v-else-if="error" class="py-16 text-center text-sm text-red-600">{{ error }}</div>
    <div v-else-if="dashboard" class="mx-auto max-w-7xl space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-xl font-semibold text-neutral-900 dark:text-white">{{ dashboard.name }}</h1>
        <DashboardDateRangeBar v-model="dateRange" @update:model-value="refresh" />
      </div>
      <div
        class="grid gap-2"
        :style="{
          gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`,
          gridAutoRows: `${rowHeight}px`,
        }"
      >
        <div
          v-for="item in responsiveLayout"
          :key="item.instanceId"
          :style="{
            gridColumn: `${item.x + 1} / span ${item.w}`,
            gridRow: `${item.y + 1} / span ${item.h}`,
          }"
          class="min-h-0"
        >
          <DashboardWidgetCell
            :title="cellTitle(item)"
            :chart-type="cellChartType(item)"
            :payload="widgetPayloadByInstance(item.instanceId)"
            :theme-mode="themeMode"
            :loading="executing"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import DashboardDateRangeBar from '@/components/analytics/DashboardDateRangeBar.vue';
import DashboardWidgetCell from '@/components/analytics/DashboardWidgetCell.vue';
import { useAnalyticsEmbed } from '@/composables/useAnalyticsEmbed';
import { useColorMode } from '@/composables/useColorMode';
import { adaptDashboardLayout, detectDashboardBreakpoint } from '@/utils/analyticsDashboardLayout';
import { resolveDateRange, type AnalyticsDateRangeValue } from '@/utils/analyticsDateRange';
import type { AnalyticsDashboardLayoutItem } from '@/types/analytics.types';

const { t } = useI18n();
const route = useRoute();
const { effectiveDark } = useColorMode();
const {
  dashboard,
  loading,
  executing,
  fetchEmbedDashboard,
  executeEmbedDashboard,
  widgetPayloadByInstance,
} = useAnalyticsEmbed();

const error = ref('');
const dateRange = ref<AnalyticsDateRangeValue>({ preset: 'last30days' });
const breakpoint = ref(detectDashboardBreakpoint(typeof window !== 'undefined' ? window.innerWidth : 1280));

const themeMode = computed(() => (effectiveDark.value ? 'dark' : 'light'));
const layout = computed(() => dashboard.value?.layout || []);
const rowHeight = computed(() => dashboard.value?.rowHeight || 80);
const gridColumns = computed(() => (breakpoint.value === 'tablet' ? 6 : 12));
const responsiveLayout = computed(() => adaptDashboardLayout(layout.value, breakpoint.value));

function cellTitle(item: AnalyticsDashboardLayoutItem) {
  const payload = widgetPayloadByInstance(item.instanceId);
  return payload?.name || payload?.kpiLabel || t('analytics.dashboardWidgetPlaceholder');
}

function cellChartType(item: AnalyticsDashboardLayoutItem) {
  return widgetPayloadByInstance(item.instanceId)?.chartType || null;
}

async function refresh() {
  const token = String(route.query.token || '');
  if (!token) return;
  await executeEmbedDashboard(token, {
    variables: { dateRange: resolveDateRange(dateRange.value) },
  });
}

function onResize() {
  breakpoint.value = detectDashboardBreakpoint(window.innerWidth);
}

onMounted(async () => {
  window.addEventListener('resize', onResize);
  const token = String(route.query.token || '');
  if (!token) {
    error.value = t('analytics.embedMissingToken');
    return;
  }
  const meta = await fetchEmbedDashboard(token);
  if (!meta?.success) {
    error.value = meta?.message || t('analytics.embedInvalidToken');
    return;
  }
  await refresh();
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize);
});
</script>
