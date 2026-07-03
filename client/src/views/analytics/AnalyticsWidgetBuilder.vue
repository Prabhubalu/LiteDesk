<template>
  <div class="mx-auto w-full px-6 py-8">
    <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <button type="button" class="mb-2 text-sm text-primary-600 hover:underline" @click="goList">
          ← {{ t('analytics.widgetsListTitle') }}
        </button>
        <h1 class="text-2xl font-semibold text-neutral-900 dark:text-white">
          {{ isNew ? t('analytics.widgetBuilderTitle') : form.name || t('analytics.widgetBuilderEditTitle') }}
        </h1>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium dark:border-neutral-600"
          :disabled="saving"
          @click="saveDraft"
        >
          {{ t('analytics.saveDraft') }}
        </button>
        <button
          type="button"
          class="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium dark:border-neutral-600"
          :disabled="executing"
          @click="runPreview"
        >
          {{ t('analytics.preview') }}
        </button>
        <button
          v-if="!isNew"
          type="button"
          class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          :disabled="saving"
          @click="publish"
        >
          {{ t('analytics.publish') }}
        </button>
      </div>
    </div>

    <section
      v-if="isNew && templates.length"
      class="mb-6 rounded-xl border border-neutral-200 p-4 dark:border-neutral-700"
    >
      <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
        {{ t('analytics.templatesSectionTitle') }}
      </h2>
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <button
          v-for="template in templates"
          :key="template.templateKey"
          type="button"
          class="rounded-lg border p-3 text-left transition-colors hover:border-primary-400 dark:border-neutral-600"
          :class="
            form.templateKey === template.templateKey
              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
              : 'border-neutral-200'
          "
          @click="applyTemplate(template)"
        >
          <p class="text-sm font-medium text-neutral-900 dark:text-white">{{ template.name }}</p>
          <p class="mt-1 text-xs text-neutral-500">{{ template.description }}</p>
        </button>
      </div>
      <p v-if="templateApplying" class="mt-2 text-xs text-neutral-500">{{ t('states.loading') }}</p>
    </section>

    <div class="grid gap-6 xl:grid-cols-2">
      <section class="space-y-4 rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
        <label class="block text-sm">
          <span class="mb-1 block font-medium">{{ t('analytics.fieldName') }}</span>
          <input v-model="form.name" type="text" class="w-full rounded-lg border px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900" />
        </label>
        <label class="block text-sm">
          <span class="mb-1 block font-medium">{{ t('analytics.fieldReport') }}</span>
          <select v-model="form.reportId" class="w-full rounded-lg border px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900">
            <option value="">{{ t('analytics.selectReport') }}</option>
            <option v-for="report in publishedReports" :key="report._id" :value="report._id">
              {{ report.name }}
            </option>
          </select>
        </label>
        <label class="block text-sm">
          <span class="mb-1 block font-medium">{{ t('analytics.fieldChartType') }}</span>
          <select v-model="form.chartType" class="w-full rounded-lg border px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900">
            <option v-for="type in chartTypes" :key="type" :value="type">
              {{ t(`analytics.chartType_${type}`) }}
            </option>
          </select>
        </label>
        <template v-if="form.chartType !== 'kpi' && form.chartType !== 'table'">
          <label class="block text-sm">
            <span class="mb-1 block font-medium">{{ t('analytics.fieldDimension') }}</span>
            <select v-model="dimensionField" class="w-full rounded-lg border px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900">
              <option v-for="col in previewColumns" :key="col" :value="col">{{ col }}</option>
            </select>
          </label>
        </template>
        <label v-if="form.chartType !== 'table'" class="block text-sm">
          <span class="mb-1 block font-medium">{{ t('analytics.fieldMetric') }}</span>
          <select v-model="metricField" class="w-full rounded-lg border px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900">
            <option v-for="col in previewColumns" :key="col" :value="col">{{ col }}</option>
          </select>
        </label>
        <label v-if="form.chartType === 'kpi'" class="block text-sm">
          <span class="mb-1 block font-medium">{{ t('analytics.kpiLabelField') }}</span>
          <input v-model="form.kpiLabel" type="text" class="w-full rounded-lg border px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900" />
        </label>

        <div v-if="form.chartType === 'kpi'" class="space-y-3 border-t border-neutral-200 pt-4 dark:border-neutral-700">
          <h3 class="text-sm font-semibold">{{ t('analytics.sectionKpiThresholds') }}</h3>
          <label class="block text-sm">
            <span class="mb-1 block text-neutral-600 dark:text-neutral-400">
              {{ t('analytics.kpiThresholdWarningBelow') }}
            </span>
            <input
              v-model.number="kpiWarningMax"
              type="number"
              min="0"
              class="w-full rounded-lg border px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900"
            />
          </label>
          <label class="block text-sm">
            <span class="mb-1 block text-neutral-600 dark:text-neutral-400">
              {{ t('analytics.kpiThresholdGoodAbove') }}
            </span>
            <input
              v-model.number="kpiGoodMin"
              type="number"
              min="0"
              class="w-full rounded-lg border px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900"
            />
          </label>
        </div>

        <div
          v-if="showChartOptions"
          class="space-y-2 border-t border-neutral-200 pt-4 dark:border-neutral-700"
        >
          <h3 class="text-sm font-semibold">{{ t('analytics.sectionChartOptions') }}</h3>
          <label v-if="form.chartType === 'bar'" class="flex items-center gap-2 text-sm">
            <input v-model="form.orientation" type="checkbox" true-value="horizontal" false-value="vertical" />
            {{ t('analytics.optionHorizontal') }}
          </label>
          <label v-if="form.chartType === 'bar'" class="flex items-center gap-2 text-sm">
            <input v-model="form.stacked" type="checkbox" />
            {{ t('analytics.optionStacked') }}
          </label>
          <label v-if="form.chartType === 'bar'" class="flex items-center gap-2 text-sm">
            <input v-model="form.showDataLabels" type="checkbox" />
            {{ t('analytics.optionShowDataLabels') }}
          </label>
          <label v-if="form.chartType === 'line' || form.chartType === 'area'" class="flex items-center gap-2 text-sm">
            <input v-model="form.smooth" type="checkbox" />
            {{ t('analytics.optionSmooth') }}
          </label>
          <label v-if="form.chartType !== 'funnel'" class="flex items-center gap-2 text-sm">
            <input v-model="form.showLegend" type="checkbox" />
            {{ t('analytics.optionShowLegend') }}
          </label>
        </div>
      </section>

      <section class="rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
        <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          {{ t('analytics.sectionPreview') }}
        </h2>
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
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import AnalyticsChartView from '@/components/analytics/AnalyticsChartView.vue';
import AnalyticsKpiCard from '@/components/analytics/AnalyticsKpiCard.vue';
import ReportPreviewPanel from '@/components/analytics/ReportPreviewPanel.vue';
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

const isNew = computed(() => route.name === 'analytics-widget-create');
const chartTypes = ['bar', 'line', 'area', 'pie', 'donut', 'funnel', 'gauge', 'heatmap', 'scatter', 'combo', 'kpi', 'table'];

const form = reactive({
  name: '',
  apiName: '',
  reportId: '',
  chartType: 'bar',
  kpiLabel: '',
  templateKey: '',
  orientation: 'vertical',
  stacked: false,
  smooth: true,
  showLegend: true,
  showDataLabels: false,
});

const dimensionField = ref('stage');
const metricField = ref('count');
const kpiWarningMax = ref(30);
const kpiGoodMin = ref(70);
const widgetId = ref(null);
const templateApplying = ref(false);

const publishedReports = computed(() =>
  reports.value.filter((r) => r.status === 'published')
);

const previewResult = computed(() => executePayload.value?.result || null);

const previewColumns = computed(() =>
  (previewResult.value?.columns || []).map((col) => col.key)
);

const themeMode = computed(() => (effectiveDark.value ? 'dark' : 'light'));

const showChartOptions = computed(() => {
  return ['bar', 'line', 'area', 'pie', 'donut'].includes(form.chartType);
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

function slugify(name) {
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

function loadThresholdsFromWidget(thresholds) {
  if (!thresholds?.length) return;
  const warning = thresholds.find((band) => band.max !== null && band.min === null);
  const good = thresholds.find((band) => band.min !== null && band.max === null);
  if (warning?.max != null) kpiWarningMax.value = warning.max;
  if (good?.min != null) kpiGoodMin.value = good.min;
}

async function resolveReportForTemplate(preset) {
  const presetName = String(preset.name || '');
  let report = publishedReports.value.find(
    (r) => r.name === presetName || r.apiName === slugify(presetName)
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
        publishedReports.value.find((r) => r._id === createRes.data._id) ||
        pubRes?.data ||
        createRes.data;
    }
  }

  return report;
}

async function applyTemplate(template) {
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

function goList() {
  router.push({ name: 'analytics-widgets' });
}

watch(
  () => form.name,
  (name) => {
    if (isNew.value && !form.apiName) form.apiName = slugify(name);
  }
);

watch(previewColumns, (cols) => {
  if (cols.length && !cols.includes(dimensionField.value)) dimensionField.value = cols[0];
  if (cols.length && !cols.includes(metricField.value)) {
    metricField.value = cols.find((c) => c !== dimensionField.value) || cols[0];
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
      const w = res.data;
      form.name = w.name;
      form.apiName = w.apiName;
      form.reportId = typeof w.reportId === 'object' ? w.reportId._id : w.reportId;
      form.chartType = w.chartType;
      form.kpiLabel = w.kpiLabel || '';
      form.templateKey = w.templateKey || '';
      form.orientation = w.orientation || 'vertical';
      form.stacked = Boolean(w.stacked);
      form.smooth = w.smooth !== false;
      form.showLegend = w.showLegend !== false;
      form.showDataLabels = Boolean(w.showDataLabels);
      dimensionField.value = w.columnMapping?.dimension || dimensionField.value;
      metricField.value = w.columnMapping?.metric || w.kpiValueField || metricField.value;
      loadThresholdsFromWidget(w.thresholds);
      await runPreview();
    }
  }
});
</script>
