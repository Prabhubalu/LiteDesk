<template>
  <div class="mx-auto w-full px-6 py-8">
    <div class="mb-6">
      <button type="button" class="mb-2 text-sm text-primary-600 hover:underline" @click="goList">
        ← {{ t('analytics.widgetsListTitle') }}
      </button>
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 class="text-2xl font-semibold text-neutral-900 dark:text-white">
            {{ widget?.name || t('states.loading') }}
          </h1>
          <p v-if="widget" class="mt-1 text-sm text-neutral-500 capitalize">
            {{ t(`analytics.chartType_${widget.chartType}`, widget.chartType) }} · {{ statusLabel(widget.status) }}
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
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
            :disabled="executing || widget?.status !== 'published'"
            @click="refresh"
          >
            {{ t('analytics.refreshWidget') }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="py-16 text-center text-sm text-neutral-500">{{ t('states.loading') }}</div>

    <template v-else-if="widget">
      <div class="mb-4 rounded-lg border border-neutral-200 p-4 text-sm dark:border-neutral-700">
        <p class="text-neutral-500">
          {{ t('analytics.boundReport') }}:
          <button type="button" class="font-medium text-primary-600 hover:underline" @click="goReport">
            {{ reportLabel }}
          </button>
        </p>
      </div>

      <section class="rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
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
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
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

function statusLabel(status) {
  if (status === 'published') return t('analytics.statusPublished');
  if (status === 'archived') return t('analytics.statusArchived');
  return t('analytics.statusDraft');
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
