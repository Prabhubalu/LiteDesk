<template>
  <div class="mx-auto w-full max-w-7xl px-6 py-8">
    <div v-if="loading" class="space-y-6">
      <div class="h-5 w-28 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
      <div class="h-8 w-2/3 max-w-md animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-700" />
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div
          v-for="idx in 4"
          :key="idx"
          class="h-24 animate-pulse rounded-xl bg-neutral-200 dark:bg-neutral-700"
        />
      </div>
      <div class="h-96 animate-pulse rounded-2xl bg-neutral-200 dark:bg-neutral-700" />
    </div>

    <template v-else-if="widget">
      <button
        type="button"
        class="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
        @click="goList"
      >
        <ArrowLeftIcon class="h-4 w-4" aria-hidden="true" />
        {{ t('analytics.widgetsListTitle') }}
      </button>

      <div class="mb-6 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div class="min-w-0 flex-1">
          <h1 class="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
            {{ widget.name }}
          </h1>
          <div class="mt-3 flex flex-wrap items-center gap-2">
            <span
              class="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
            >
              <ChartBarIcon class="h-3.5 w-3.5" aria-hidden="true" />
              {{ chartTypeLabel(widget.chartType) }}
            </span>
            <span
              class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
              :class="statusBadgeClass(widget.status)"
            >
              {{ statusLabel(widget.status) }}
            </span>
          </div>
        </div>

        <div class="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="executing"
            @click="refresh"
          >
            <ArrowPathIcon
              class="h-4 w-4"
              :class="{ 'animate-spin': executing }"
              aria-hidden="true"
            />
            {{ executing ? t('analytics.detailRunning') : t('analytics.refreshWidget') }}
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm transition-colors hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
            @click="goEdit"
          >
            <PencilSquareIcon class="h-4 w-4" aria-hidden="true" />
            {{ t('actions.edit') }}
          </button>
        </div>
      </div>

      <div
        v-if="widget.status !== 'published'"
        class="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800/60 dark:bg-amber-950/30"
      >
        <ExclamationTriangleIcon
          class="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400"
          aria-hidden="true"
        />
        <p class="text-sm text-amber-800 dark:text-amber-200">
          {{ t('analytics.widgetDetailDraftHint') }}
        </p>
      </div>

      <div class="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div
          v-for="card in statCards"
          :key="card.key"
          class="rounded-xl border border-neutral-200/80 bg-white px-4 py-4 shadow-sm dark:border-neutral-700 dark:bg-neutral-900/80"
        >
          <div class="flex items-center gap-2">
            <component
              :is="card.icon"
              class="h-4 w-4 text-neutral-400 dark:text-neutral-500"
              aria-hidden="true"
            />
            <p class="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              {{ card.label }}
            </p>
          </div>
          <p class="mt-2 text-xl font-semibold tabular-nums text-neutral-900 dark:text-white">
            {{ card.value }}
          </p>
        </div>
      </div>

      <button
        type="button"
        class="mb-6 flex w-full items-center justify-between gap-4 rounded-xl border border-neutral-200 bg-white px-5 py-4 text-left shadow-sm transition-colors hover:border-primary-300 hover:bg-primary-50/30 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-primary-700 dark:hover:bg-primary-950/20"
        @click="goReport"
      >
        <div class="flex min-w-0 items-center gap-3">
          <div
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-300"
          >
            <DocumentChartBarIcon class="h-5 w-5" aria-hidden="true" />
          </div>
          <div class="min-w-0">
            <p class="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              {{ t('analytics.boundReport') }}
            </p>
            <p class="truncate text-sm font-semibold text-neutral-900 dark:text-white">
              {{ reportLabel }}
            </p>
          </div>
        </div>
        <ArrowTopRightOnSquareIcon class="h-4 w-4 shrink-0 text-neutral-400" aria-hidden="true" />
      </button>

      <section
        class="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-900"
      >
        <div
          class="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-5 py-4 dark:border-neutral-800"
        >
          <p class="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            {{ t('analytics.sectionPreview') }}
          </p>
          <p
            v-if="executePayload?.result?.meta"
            class="text-xs tabular-nums text-neutral-400 dark:text-neutral-500"
          >
            {{
              t('analytics.previewRows', {
                count: executePayload.result.meta.totalRows ?? 0,
                ms: executePayload.result.meta.executionMs ?? 0,
              })
            }}
          </p>
        </div>

        <div class="relative p-5">
          <div
            v-if="executing"
            class="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-[1px] dark:bg-neutral-900/70"
          >
            <div class="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
              <ArrowPathIcon class="h-5 w-5 animate-spin text-primary-600" aria-hidden="true" />
              {{ t('analytics.detailRunning') }}
            </div>
          </div>

          <AnalyticsKpiCard
            v-if="widget.chartType === 'kpi'"
            :result="executePayload?.result || null"
            :value-field="widget.kpiValueField || executePayload?.kpiValueField"
            :label="widget.kpiLabel || widget.name"
            :prefix="widget.kpiPrefix"
            :suffix="widget.kpiSuffix"
            :thresholds="widget.thresholds"
          />
          <ReportPreviewPanel
            v-else-if="widget.chartType === 'table'"
            :result="executePayload?.result || null"
            :empty-message="t('analytics.previewEmpty')"
          />
          <AnalyticsChartView
            v-else
            :result="executePayload?.result || null"
            :config="chartConfig"
            :theme-mode="themeMode"
            :loading="executing"
          />
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ClockIcon,
  DocumentChartBarIcon,
  ExclamationTriangleIcon,
  PencilSquareIcon,
  Squares2X2Icon,
} from '@heroicons/vue/24/outline';
import AnalyticsChartView from '@/components/analytics/AnalyticsChartView.vue';
import AnalyticsKpiCard from '@/components/analytics/AnalyticsKpiCard.vue';
import ReportPreviewPanel from '@/components/analytics/ReportPreviewPanel.vue';
import { useAnalyticsWidgets } from '@/composables/useAnalyticsWidgets';
import { useColorMode } from '@/composables/useColorMode';
import { captureAnalyticsWidgetExecuted } from '@/config/posthogAnalytics';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { effectiveDark } = useColorMode();

const { widget, executePayload, loading, executing, fetchWidget, executeWidget } = useAnalyticsWidgets();

const themeMode = computed(() => (effectiveDark.value ? 'dark' : 'light'));

const chartConfig = computed(() => {
  if (!widget.value) return { chartType: 'bar' };
  return {
    chartType: widget.value.chartType,
    columnMapping: widget.value.columnMapping || {},
    showLegend: widget.value.showLegend !== false,
    orientation: widget.value.orientation,
    stacked: widget.value.stacked,
    smooth: widget.value.smooth,
    showDataLabels: widget.value.showDataLabels,
  };
});

const reportLabel = computed(() => {
  const report = widget.value?.reportId;
  if (report && typeof report === 'object') return report.name;
  return widget.value?.reportApiName || '—';
});

const reportId = computed(() => {
  const report = widget.value?.reportId;
  if (report && typeof report === 'object') return report._id;
  return widget.value?.reportId;
});

const statCards = computed(() => {
  if (!widget.value) return [];
  return [
    {
      key: 'chartType',
      label: t('analytics.colChartType'),
      value: chartTypeLabel(widget.value.chartType),
      icon: ChartBarIcon,
    },
    {
      key: 'dashboards',
      label: t('analytics.widgetDetailDashboards'),
      value: String(widget.value.dashboardCount ?? 0),
      icon: Squares2X2Icon,
    },
    {
      key: 'status',
      label: t('analytics.colStatus'),
      value: statusLabel(widget.value.status),
      icon: CheckCircleIcon,
    },
    {
      key: 'updated',
      label: t('analytics.widgetDetailUpdated'),
      value: formatDate(widget.value.updatedAt),
      icon: ClockIcon,
    },
  ];
});

function chartTypeLabel(type: string) {
  return t(`analytics.chartType_${type}`, type);
}

function statusBadgeClass(status: string) {
  if (status === 'published') {
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200';
  }
  if (status === 'archived') {
    return 'bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300';
  }
  return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200';
}

function statusLabel(status: string) {
  if (status === 'published') return t('analytics.statusPublished');
  if (status === 'archived') return t('analytics.statusArchived');
  return t('analytics.statusDraft');
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function goList() {
  router.push({ name: 'analytics-widgets' });
}

function goEdit() {
  router.push({ name: 'analytics-widget-edit', params: { id: route.params.id } });
}

function goReport() {
  if (reportId.value) {
    router.push({ name: 'analytics-report-detail', params: { id: reportId.value } });
  }
}

async function refresh() {
  const res = await executeWidget(String(route.params.id), {});
  if (res?.success) {
    captureAnalyticsWidgetExecuted({ widget_id: route.params.id });
  }
}

onMounted(async () => {
  await fetchWidget(String(route.params.id));
  if (widget.value?.status === 'published') {
    await refresh();
  } else {
    await executeWidget(String(route.params.id), { preview: true });
  }
});
</script>
