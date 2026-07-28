<template>
  <div class="mx-auto w-full px-6 py-8">
    <div class="mb-6">
      <button type="button" class="mb-2 text-sm text-primary-600 hover:underline" @click="goList">
        ← {{ t('analytics.dashboardsListTitle') }}
      </button>
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 class="text-2xl font-semibold text-neutral-900 dark:text-white">
            {{ dashboard?.name || t('states.loading') }}
          </h1>
          <p v-if="dashboard" class="mt-1 text-sm text-neutral-500 capitalize">
            {{ t(`analytics.dashboardCategory_${dashboard.category}`, dashboard.category) }} ·
            {{ statusLabel(dashboard.status) }}
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            v-if="dashboard?.status === 'published'"
            type="button"
            class="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium dark:border-neutral-600"
            @click="createEmbedLink"
          >
            {{ t('analytics.embedCreateLink') }}
          </button>
          <button
            type="button"
            class="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium dark:border-neutral-600"
            @click="goEdit"
          >
            {{ t('actions.edit') }}
          </button>
          <button
            type="button"
            class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            :disabled="executing || dashboard?.status !== 'published'"
            @click="refresh"
          >
            {{ t('analytics.refreshDashboard') }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="py-16 text-center text-sm text-neutral-500">{{ t('states.loading') }}</div>

    <template v-else-if="dashboard">
      <div class="mb-4 space-y-3">
        <DashboardDateRangeBar
          v-if="dashboard.allowViewerDateChange !== false"
          v-model="dateRange"
          @update:model-value="refresh"
        />
        <div
          v-if="activeDrillLabel"
          class="flex flex-wrap items-center gap-2 rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-sm dark:border-primary-800 dark:bg-primary-900/20"
        >
          <span class="text-neutral-600 dark:text-neutral-300">
            {{ t('analytics.dashboardDrillActive', { label: activeDrillLabel }) }}
          </span>
          <button type="button" class="font-medium text-primary-600 hover:underline" @click="clearDrill">
            {{ t('analytics.dashboardClearDrill') }}
          </button>
        </div>
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
            :interactive="dashboard.drillDownEnabled === true"
            @segment-click="onSegmentClick(item.instanceId, $event)"
          />
        </div>
      </div>

      <p v-if="layout.length === 0" class="py-16 text-center text-sm text-neutral-500">
        {{ t('analytics.dashboardEmptyCanvas') }}
      </p>
    </template>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import DashboardDateRangeBar from '@/components/analytics/DashboardDateRangeBar.vue';
import DashboardWidgetCell from '@/components/analytics/DashboardWidgetCell.vue';
import { useAnalyticsDashboards } from '@/composables/useAnalyticsDashboards';
import { useColorMode } from '@/composables/useColorMode';
import { adaptDashboardLayout, buildDrillFilterPayload, detectDashboardBreakpoint } from '@/utils/analyticsDashboardLayout';
import { resolveDateRange } from '@/utils/analyticsDateRange';
import {
  captureAnalyticsDashboardDrillDown,
  captureAnalyticsDashboardExecuted,
  captureAnalyticsEmbedLinkCreated,
} from '@/config/posthogAnalytics';
import { useAnalyticsEmbed } from '@/composables/useAnalyticsEmbed';

import { useNotifications } from '@/composables/useNotifications';
const { t } = useI18n();
const notifications = useNotifications();

const route = useRoute();
const router = useRouter();
const { effectiveDark } = useColorMode();

const {
  dashboard,
  executePayload,
  loading,
  executing,
  fetchDashboard,
  executeDashboard,
  widgetPayloadByInstance,
} = useAnalyticsDashboards();

const { createEmbedToken } = useAnalyticsEmbed();

const dateRange = ref({ preset: 'last30days' });
const drillFilters = ref(null);
const activeDrillLabel = ref('');
const breakpoint = ref(detectDashboardBreakpoint(typeof window !== 'undefined' ? window.innerWidth : 1280));

const themeMode = computed(() => (effectiveDark.value ? 'dark' : 'light'));
const layout = computed(() => dashboard.value?.layout || []);
const rowHeight = computed(() => dashboard.value?.rowHeight || 80);
const gridColumns = computed(() => (breakpoint.value === 'tablet' ? 6 : 12));
const responsiveLayout = computed(() => adaptDashboardLayout(layout.value, breakpoint.value));

function statusLabel(status) {
  if (status === 'published') return t('analytics.statusPublished');
  if (status === 'archived') return t('analytics.statusArchived');
  return t('analytics.statusDraft');
}

function cellTitle(item) {
  const payload = widgetPayloadByInstance(item.instanceId);
  return payload?.name || payload?.kpiLabel || t('analytics.dashboardWidgetPlaceholder');
}

function cellChartType(item) {
  return widgetPayloadByInstance(item.instanceId)?.chartType || null;
}

function goList() {
  router.push({ name: 'analytics-dashboards' });
}

function goEdit() {
  router.push({ name: 'analytics-dashboard-edit', params: { id: route.params.id } });
}

function clearDrill() {
  drillFilters.value = null;
  activeDrillLabel.value = '';
  void refresh();
}

function onSegmentClick(instanceId, segment) {
  if (!dashboard.value?.drillDownEnabled) return;
  const payload = widgetPayloadByInstance(instanceId);
  const dimensionField = payload?.columnMapping?.dimension;
  if (!dimensionField || segment.label == null) return;

  drillFilters.value = buildDrillFilterPayload(dimensionField, segment.label);
  activeDrillLabel.value = String(segment.label);
  captureAnalyticsDashboardDrillDown({
    dashboard_id: dashboard.value._id,
    dimension: dimensionField,
    value: segment.label,
  });
  void refresh();
}

async function refresh() {
  const id = route.params.id;
  if (!id) return;
  const preview = dashboard.value?.status !== 'published';
  const body = {
    preview,
    variables: { dateRange: resolveDateRange(dateRange.value) },
  };
  if (drillFilters.value) {
    body.drillFilters = drillFilters.value;
  }
  const res = await executeDashboard(String(id), body);
  if (res?.success) {
    captureAnalyticsDashboardExecuted({
      dashboard_id: id,
      widget_count: executePayload.value?.widgets?.length || 0,
      drilled: Boolean(drillFilters.value),
    });
  }
}

function onResize() {
  breakpoint.value = detectDashboardBreakpoint(window.innerWidth);
}

async function createEmbedLink() {
  if (!dashboard.value?._id) return;
  const res = await createEmbedToken(String(dashboard.value._id), dashboard.value.name);
  if (res?.success && res.token) {
    captureAnalyticsEmbedLinkCreated({ dashboard_id: dashboard.value._id });
    const origin = window.location.origin;
    const url = `${origin}${res.embedPath || `/analytics/embed/dashboard?token=${encodeURIComponent(res.token)}`}`;
    await navigator.clipboard.writeText(url);
    notifications.success(t('analytics.embedLinkCopied'));
  }
}

onMounted(async () => {
  window.addEventListener('resize', onResize);
  await fetchDashboard(String(route.params.id));
  await refresh();
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize);
});
</script>
