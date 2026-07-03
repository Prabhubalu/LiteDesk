<template>
  <section v-if="dashboard" class="space-y-4 rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-lg font-semibold text-neutral-900 dark:text-white">{{ dashboard.name }}</h2>
        <p class="text-sm text-neutral-500">{{ t('analytics.dashboardEmbedDescription') }}</p>
      </div>
      <router-link
        :to="{ name: 'analytics-dashboard-view', params: { id: dashboard._id } }"
        class="text-sm font-medium text-primary-600 hover:underline"
      >
        {{ t('analytics.dashboardOpenFull') }}
      </router-link>
    </div>

    <DashboardDateRangeBar v-model="dateRange" @update:model-value="refresh" />

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
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import DashboardDateRangeBar from '@/components/analytics/DashboardDateRangeBar.vue';
import DashboardWidgetCell from '@/components/analytics/DashboardWidgetCell.vue';
import { useAnalyticsDashboards } from '@/composables/useAnalyticsDashboards';
import { useColorMode } from '@/composables/useColorMode';
import { adaptDashboardLayout, detectDashboardBreakpoint } from '@/utils/analyticsDashboardLayout';
import { resolveDateRange, type AnalyticsDateRangeValue } from '@/utils/analyticsDateRange';
import type { AnalyticsDashboardLayoutItem } from '@/types/analytics.types';

const props = defineProps<{
  appKey: string;
}>();

const { t } = useI18n();
const { effectiveDark } = useColorMode();
const {
  dashboard,
  executing,
  fetchDefaultDashboard,
  executeDashboard,
  widgetPayloadByInstance,
} = useAnalyticsDashboards();

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
  if (!dashboard.value?._id) return;
  await executeDashboard(String(dashboard.value._id), {
    variables: { dateRange: resolveDateRange(dateRange.value) },
  });
}

function onResize() {
  breakpoint.value = detectDashboardBreakpoint(window.innerWidth);
}

onMounted(async () => {
  window.addEventListener('resize', onResize);
  const res = await fetchDefaultDashboard(props.appKey);
  if (res?.success) {
    await refresh();
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize);
});

watch(
  () => props.appKey,
  async (appKey) => {
    const res = await fetchDefaultDashboard(appKey);
    if (res?.success) {
      await refresh();
    }
  },
);
</script>
