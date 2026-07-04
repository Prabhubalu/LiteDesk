<template>
  <div class="mx-auto w-full max-w-7xl px-6 py-8">
    <button
      type="button"
      class="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
      @click="goBack"
    >
      <ArrowLeftIcon class="h-4 w-4" aria-hidden="true" />
      {{ backLabel }}
    </button>

    <div class="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div class="min-w-0">
        <h1 class="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
          {{ isNew ? t('analytics.widgetBuilderTitle') : form.name || t('analytics.widgetBuilderEditTitle') }}
        </h1>
        <p class="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          {{ t('analytics.widgetBuilderHint') }}
        </p>
      </div>
      <div class="flex shrink-0 flex-wrap items-center gap-2">
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
          :disabled="saving"
          @click="saveDraft"
        >
          {{ t('analytics.saveDraft') }}
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
          :disabled="executing || !form.reportId"
          @click="runPreview"
        >
          <ArrowPathIcon
            class="h-4 w-4"
            :class="{ 'animate-spin': executing }"
            aria-hidden="true"
          />
          {{ t('analytics.preview') }}
        </button>
        <button
          v-if="!isNew"
          type="button"
          class="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="saving || !form.reportId"
          @click="publish"
        >
          {{ t('analytics.publish') }}
        </button>
      </div>
    </div>

    <div
      v-if="boundReportName"
      class="mb-6 flex items-center gap-2 rounded-xl border border-primary-200 bg-primary-50/60 px-4 py-3 text-sm text-primary-800 dark:border-primary-800/50 dark:bg-primary-950/30 dark:text-primary-200"
    >
      <DocumentChartBarIcon class="h-5 w-5 shrink-0" aria-hidden="true" />
      {{ t('analytics.widgetBuilderFromReport', { name: boundReportName }) }}
    </div>

    <section
      v-if="isNew && templates.length"
      class="mb-6 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-900"
    >
      <div class="border-b border-neutral-100 px-5 py-4 dark:border-neutral-800">
        <h2 class="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          {{ t('analytics.templatesSectionTitle') }}
        </h2>
      </div>
      <div class="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
        <button
          v-for="template in templates"
          :key="template.templateKey"
          type="button"
          class="rounded-xl border p-4 text-left transition-all hover:border-primary-300 hover:shadow-sm dark:hover:border-primary-700"
          :class="
            form.templateKey === template.templateKey
              ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500/20 dark:border-primary-600 dark:bg-primary-950/40'
              : 'border-neutral-200 dark:border-neutral-700'
          "
          @click="applyTemplate(template)"
        >
          <p class="text-sm font-semibold text-neutral-900 dark:text-white">{{ template.name }}</p>
          <p class="mt-1 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
            {{ template.description }}
          </p>
          <span
            class="mt-3 inline-flex rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
          >
            {{ t(`analytics.chartType_${template.chartType}`, template.chartType) }}
          </span>
        </button>
      </div>
      <p v-if="templateApplying" class="border-t border-neutral-100 px-5 py-3 text-xs text-neutral-500 dark:border-neutral-800">
        {{ t('states.loading') }}
      </p>
    </section>

    <div class="grid gap-6 xl:grid-cols-2">
      <section class="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
        <div class="border-b border-neutral-100 px-5 py-4 dark:border-neutral-800">
          <h2 class="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            {{ t('analytics.widgetBuilderConfig') }}
          </h2>
        </div>
        <div class="space-y-5 p-5">
          <label class="block">
            <span :class="labelClass">{{ t('analytics.fieldName') }}</span>
            <input v-model="form.name" type="text" :class="inputClass" />
          </label>

          <div>
            <span :class="labelClass">{{ t('analytics.fieldReport') }}</span>
            <HeadlessSelect
              v-model="form.reportId"
              :options="reportOptions"
              :placeholder="t('analytics.selectReport')"
              wrapper-class="mt-0"
              teleport
            />
          </div>

          <div>
            <span :class="labelClass">{{ t('analytics.fieldChartType') }}</span>
            <HeadlessSelect
              v-model="form.chartType"
              :options="chartTypeOptions"
              wrapper-class="mt-0"
              teleport
            />
          </div>

          <template v-if="form.chartType !== 'kpi' && form.chartType !== 'table'">
            <div>
              <span :class="labelClass">{{ t('analytics.fieldDimension') }}</span>
              <HeadlessSelect
                v-model="dimensionField"
                :options="columnOptions"
                wrapper-class="mt-0"
                teleport
              />
            </div>
          </template>

          <div v-if="form.chartType !== 'table'">
            <span :class="labelClass">{{ t('analytics.fieldMetric') }}</span>
            <HeadlessSelect
              v-model="metricField"
              :options="columnOptions"
              wrapper-class="mt-0"
              teleport
            />
          </div>

          <label v-if="form.chartType === 'kpi'" class="block">
            <span :class="labelClass">{{ t('analytics.kpiLabelField') }}</span>
            <input v-model="form.kpiLabel" type="text" :class="inputClass" />
          </label>

          <div
            v-if="form.chartType === 'kpi'"
            class="space-y-4 rounded-xl border border-neutral-100 bg-neutral-50/60 p-4 dark:border-neutral-800 dark:bg-neutral-800/40"
          >
            <h3 class="text-sm font-semibold text-neutral-900 dark:text-white">
              {{ t('analytics.sectionKpiThresholds') }}
            </h3>
            <label class="block">
              <span class="mb-1.5 block text-xs text-neutral-500 dark:text-neutral-400">
                {{ t('analytics.kpiThresholdWarningBelow') }}
              </span>
              <input
                v-model.number="kpiWarningMax"
                type="number"
                min="0"
                :class="inputClass"
              />
            </label>
            <label class="block">
              <span class="mb-1.5 block text-xs text-neutral-500 dark:text-neutral-400">
                {{ t('analytics.kpiThresholdGoodAbove') }}
              </span>
              <input
                v-model.number="kpiGoodMin"
                type="number"
                min="0"
                :class="inputClass"
              />
            </label>
          </div>

          <div
            v-if="showChartOptions"
            class="space-y-3 rounded-xl border border-neutral-100 bg-neutral-50/60 p-4 dark:border-neutral-800 dark:bg-neutral-800/40"
          >
            <h3 class="text-sm font-semibold text-neutral-900 dark:text-white">
              {{ t('analytics.sectionChartOptions') }}
            </h3>

            <div v-if="form.chartType === 'bar'" class="space-y-2">
              <span class="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                {{ t('analytics.optionHorizontal') }}
              </span>
              <div class="inline-flex rounded-lg bg-neutral-100 p-0.5 dark:bg-neutral-800">
                <button
                  type="button"
                  class="rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
                  :class="form.orientation === 'vertical'
                    ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white'
                    : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400'"
                  @click="form.orientation = 'vertical'"
                >
                  {{ t('analytics.widgetOrientationVertical') }}
                </button>
                <button
                  type="button"
                  class="rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
                  :class="form.orientation === 'horizontal'
                    ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white'
                    : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400'"
                  @click="form.orientation = 'horizontal'"
                >
                  {{ t('analytics.widgetOrientationHorizontal') }}
                </button>
              </div>
            </div>

            <div
              v-for="toggle in chartOptionToggles"
              :key="toggle.key"
              class="flex items-center justify-between gap-3"
            >
              <span class="text-sm text-neutral-700 dark:text-neutral-300">{{ toggle.label }}</span>
              <HeadlessSwitch v-model="form[toggle.key]" />
            </div>
          </div>
        </div>
      </section>

      <section class="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
        <div
          class="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-5 py-4 dark:border-neutral-800"
        >
          <h2 class="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            {{ t('analytics.sectionPreview') }}
          </h2>
          <p
            v-if="previewResult?.meta"
            class="text-xs tabular-nums text-neutral-400 dark:text-neutral-500"
          >
            {{
              t('analytics.previewRows', {
                count: previewResult.meta.totalRows ?? 0,
                ms: previewResult.meta.executionMs ?? 0,
              })
            }}
          </p>
        </div>

        <div class="relative min-h-[20rem] p-5">
          <div
            v-if="executing"
            class="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-[1px] dark:bg-neutral-900/70"
          >
            <div class="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
              <ArrowPathIcon class="h-5 w-5 animate-spin text-primary-600" aria-hidden="true" />
              {{ t('analytics.detailRunning') }}
            </div>
          </div>

          <div
            v-if="!form.reportId"
            class="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-neutral-300 text-center dark:border-neutral-600"
          >
            <ChartBarIcon class="h-10 w-10 text-neutral-300 dark:text-neutral-600" aria-hidden="true" />
            <p class="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
              {{ t('analytics.widgetPreviewSelectReport') }}
            </p>
          </div>
          <template v-else>
            <AnalyticsKpiCard
              v-if="form.chartType === 'kpi'"
              :result="previewResult"
              :value-field="metricField"
              :label="form.kpiLabel || form.name"
              :thresholds="kpiThresholds"
            />
            <ReportPreviewPanel
              v-else-if="form.chartType === 'table'"
              :result="previewResult"
              :empty-message="t('analytics.previewEmpty')"
            />
            <AnalyticsChartView
              v-else
              :result="previewResult"
              :config="chartConfig"
              :theme-mode="themeMode"
              :loading="executing"
            />
          </template>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  ChartBarIcon,
  DocumentChartBarIcon,
} from '@heroicons/vue/24/outline';
import AnalyticsChartView from '@/components/analytics/AnalyticsChartView.vue';
import AnalyticsKpiCard from '@/components/analytics/AnalyticsKpiCard.vue';
import ReportPreviewPanel from '@/components/analytics/ReportPreviewPanel.vue';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import HeadlessSwitch from '@/components/ui/HeadlessSwitch.vue';
import { useAnalyticsWidgets } from '@/composables/useAnalyticsWidgets';
import { useAnalyticsReports } from '@/composables/useAnalyticsReports';
import { useColorMode } from '@/composables/useColorMode';
import {
  captureAnalyticsWidgetCreated,
  captureAnalyticsWidgetPublished,
} from '@/config/posthogAnalytics';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { effectiveDark } = useColorMode();

const {
  saving,
  executing,
  executePayload,
  templates,
  fetchWidget,
  fetchTemplates,
  createWidget,
  updateWidget,
  publishWidget,
  executeWidget,
} = useAnalyticsWidgets();

const { reports, fetchReports, createReport, publishReport } = useAnalyticsReports();

const labelClass = 'mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300';
const inputClass =
  'w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-neutral-600 dark:bg-neutral-900 dark:text-white';

const chartTypes = ['bar', 'line', 'area', 'pie', 'donut', 'funnel', 'gauge', 'heatmap', 'scatter', 'combo', 'kpi', 'table'];

const isNew = computed(() => route.name === 'analytics-widget-create');

const form = reactive({
  name: '',
  apiName: '',
  reportId: '',
  chartType: 'bar',
  kpiLabel: '',
  templateKey: '',
  orientation: 'vertical' as 'vertical' | 'horizontal',
  stacked: false,
  smooth: true,
  showLegend: true,
  showDataLabels: false,
});

const dimensionField = ref('stage');
const metricField = ref('count');
const kpiWarningMax = ref(30);
const kpiGoodMin = ref(70);
const widgetId = ref<string | null>(null);
const templateApplying = ref(false);

const publishedReports = computed(() =>
  reports.value.filter((entry) => entry.status === 'published'),
);

const reportOptions = computed(() =>
  publishedReports.value.map((entry) => ({ value: entry._id, label: entry.name })),
);

const chartTypeOptions = computed(() =>
  chartTypes.map((type) => ({
    value: type,
    label: t(`analytics.chartType_${type}`, type),
  })),
);

const boundReportName = computed(() => {
  if (!route.query.reportId) return '';
  const match = publishedReports.value.find((entry) => entry._id === String(route.query.reportId));
  return match?.name || '';
});

const backLabel = computed(() => (
  route.query.reportId
    ? t('analytics.schedulesBackToReport')
    : t('analytics.widgetsListTitle')
));

const previewResult = computed(() => executePayload.value?.result || null);

const previewColumns = computed(() =>
  (previewResult.value?.columns || []).map((col) => col.key),
);

const columnOptions = computed(() =>
  previewColumns.value.map((col) => ({ value: col, label: col })),
);

const themeMode = computed(() => (effectiveDark.value ? 'dark' : 'light'));

const showChartOptions = computed(() =>
  ['bar', 'line', 'area', 'pie', 'donut'].includes(form.chartType),
);

const chartOptionToggles = computed(() => {
  const toggles: Array<{ key: 'stacked' | 'smooth' | 'showLegend' | 'showDataLabels'; label: string }> = [];
  if (form.chartType === 'bar') {
    toggles.push({ key: 'stacked', label: t('analytics.optionStacked') });
    toggles.push({ key: 'showDataLabels', label: t('analytics.optionShowDataLabels') });
  }
  if (form.chartType === 'line' || form.chartType === 'area') {
    toggles.push({ key: 'smooth', label: t('analytics.optionSmooth') });
  }
  if (form.chartType !== 'funnel') {
    toggles.push({ key: 'showLegend', label: t('analytics.optionShowLegend') });
  }
  return toggles;
});

const kpiThresholds = computed(() => [
  { min: null, max: kpiWarningMax.value, color: '#ef4444' },
  { min: kpiWarningMax.value, max: kpiGoodMin.value, color: '#f59e0b' },
  { min: kpiGoodMin.value, max: null, color: '#10b981' },
]);

const chartConfig = computed(() => ({
  chartType: form.chartType,
  columnMapping: {
    dimension: dimensionField.value,
    metric: metricField.value,
  },
  showLegend: form.showLegend,
  orientation: form.orientation,
  stacked: form.stacked,
  smooth: form.smooth,
  showDataLabels: form.showDataLabels,
}));

function slugify(name: string) {
  return String(name || 'widget')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80);
}

function buildPayload() {
  return {
    name: form.name.trim(),
    apiName: form.apiName.trim() || slugify(form.name),
    reportId: form.reportId,
    chartType: form.chartType,
    columnMapping: {
      dimension: dimensionField.value,
      metric: metricField.value,
    },
    kpiValueField: form.chartType === 'kpi' ? metricField.value : null,
    kpiLabel: form.kpiLabel || form.name,
    thresholds: form.chartType === 'kpi' ? kpiThresholds.value : null,
    templateKey: form.templateKey || null,
    orientation: form.orientation,
    stacked: form.stacked,
    smooth: form.smooth,
    showLegend: form.showLegend,
    showDataLabels: form.showDataLabels,
  };
}

function loadThresholdsFromWidget(thresholds: Array<{ min: number | null; max: number | null }> | null | undefined) {
  if (!thresholds?.length) return;
  const warning = thresholds.find((band) => band.max !== null && band.min === null);
  const good = thresholds.find((band) => band.min !== null && band.max === null);
  if (warning?.max != null) kpiWarningMax.value = warning.max;
  if (good?.min != null) kpiGoodMin.value = good.min;
}

async function resolveReportForTemplate(preset: Record<string, unknown>) {
  const presetName = String(preset.name || '');
  let report = publishedReports.value.find(
    (entry) => entry.name === presetName || entry.apiName === slugify(presetName),
  );

  if (!report) {
    const createRes = await createReport({
      ...preset,
      name: presetName,
      apiName: slugify(presetName),
    });
    if (createRes?.success && createRes.data?._id) {
      const pubRes = await publishReport(String(createRes.data._id));
      await fetchReports({ status: 'published', limit: 200 });
      report =
        publishedReports.value.find((entry) => entry._id === createRes.data._id) ||
        pubRes?.data ||
        createRes.data;
    }
  }

  return report;
}

async function applyTemplate(template: {
  templateKey: string;
  name: string;
  chartType: string;
  kpiLabel?: string;
  columnMapping?: { dimension?: string; metric?: string };
  kpiValueField?: string;
  reportPreset?: Record<string, unknown>;
}) {
  templateApplying.value = true;
  try {
    form.templateKey = template.templateKey;
    form.name = template.name;
    form.chartType = template.chartType;
    form.kpiLabel = template.kpiLabel || template.name;

    if (template.columnMapping?.dimension) {
      dimensionField.value = String(template.columnMapping.dimension);
    }
    if (template.columnMapping?.metric) {
      metricField.value = String(template.columnMapping.metric);
    } else if (template.kpiValueField) {
      metricField.value = template.kpiValueField;
    }

    if (template.reportPreset) {
      const report = await resolveReportForTemplate(template.reportPreset);
      if (report?._id) {
        form.reportId = report._id;
      }
    }
  } finally {
    templateApplying.value = false;
  }
}

async function saveDraft() {
  const payload = buildPayload();
  if (!payload.reportId) return;
  if (isNew.value) {
    const res = await createWidget(payload);
    if (res?.success) {
      captureAnalyticsWidgetCreated({ chart_type: payload.chartType, template_key: payload.templateKey });
      widgetId.value = res.data._id;
      router.replace({ name: 'analytics-widget-edit', params: { id: res.data._id } });
    }
  } else {
    await updateWidget(String(widgetId.value || route.params.id), payload);
  }
}

async function runPreview() {
  const id = widgetId.value || route.params.id;
  if (id) {
    await executeWidget(String(id), { preview: true });
    return;
  }
  await saveDraft();
  const nextId = widgetId.value || route.params.id;
  if (nextId) {
    await executeWidget(String(nextId), { preview: true });
  }
}

async function publish() {
  const id = widgetId.value || route.params.id;
  if (!id) return;
  await saveDraft();
  const res = await publishWidget(String(id));
  if (res?.success) {
    captureAnalyticsWidgetPublished({ widget_id: id });
    router.push({ name: 'analytics-widget-detail', params: { id } });
  }
}

function goBack() {
  if (route.query.reportId) {
    router.push({ name: 'analytics-report-detail', params: { id: String(route.query.reportId) } });
    return;
  }
  router.push({ name: 'analytics-widgets' });
}

watch(
  () => form.name,
  (name) => {
    if (isNew.value && !form.apiName) form.apiName = slugify(name);
  },
);

watch(previewColumns, (cols) => {
  if (cols.length && !cols.includes(dimensionField.value)) dimensionField.value = cols[0];
  if (cols.length && !cols.includes(metricField.value)) {
    metricField.value = cols.find((col) => col !== dimensionField.value) || cols[0];
  }
});

onMounted(async () => {
  await Promise.all([
    fetchReports({ status: 'published', limit: 200 }),
    fetchTemplates(),
  ]);

  if (route.query.reportId) {
    form.reportId = String(route.query.reportId);
  }

  const templateKey = route.query.template;
  if (templateKey && isNew.value) {
    const template = templates.value.find((item) => item.templateKey === templateKey);
    if (template) {
      await applyTemplate(template);
    }
  }

  const id = route.params.id;
  if (id) {
    widgetId.value = String(id);
    const res = await fetchWidget(String(id));
    if (res?.success && res.data) {
      const widget = res.data;
      form.name = widget.name;
      form.apiName = widget.apiName;
      form.reportId = typeof widget.reportId === 'object' ? widget.reportId._id : widget.reportId;
      form.chartType = widget.chartType;
      form.kpiLabel = widget.kpiLabel || '';
      form.templateKey = widget.templateKey || '';
      form.orientation = widget.orientation || 'vertical';
      form.stacked = Boolean(widget.stacked);
      form.smooth = widget.smooth !== false;
      form.showLegend = widget.showLegend !== false;
      form.showDataLabels = Boolean(widget.showDataLabels);
      dimensionField.value = widget.columnMapping?.dimension || dimensionField.value;
      metricField.value = widget.columnMapping?.metric || widget.kpiValueField || metricField.value;
      loadThresholdsFromWidget(widget.thresholds);
      await runPreview();
    }
  }
});
</script>
