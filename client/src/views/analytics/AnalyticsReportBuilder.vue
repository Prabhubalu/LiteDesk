<template>
  <div class="mx-auto w-full px-6 py-8">
    <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <button
          type="button"
          class="mb-2 text-sm text-primary-600 hover:underline dark:text-primary-400"
          @click="goBack"
        >
          ← {{ t('analytics.listTitle') }}
        </button>
        <h1 class="text-2xl font-semibold text-neutral-900 dark:text-white">
          {{ isNew ? t('analytics.builderTitle') : form.name || t('analytics.builderEditTitle') }}
        </h1>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <span v-if="executing && autoPreview" class="text-xs text-neutral-500">
          {{ t('analytics.previewUpdating') }}
        </span>
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
          class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500 disabled:opacity-50"
          :disabled="saving"
          @click="publish"
        >
          {{ t('analytics.publish') }}
        </button>
      </div>
    </div>

    <div class="grid gap-6 xl:grid-cols-3">
      <section class="space-y-4 rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          {{ t('analytics.sectionData') }}
        </h2>
        <label class="block text-sm">
          <span class="mb-1 block font-medium">{{ t('analytics.fieldName') }}</span>
          <input v-model="form.name" type="text" class="w-full rounded-lg border px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900" />
        </label>
        <label class="block text-sm">
          <span class="mb-1 block font-medium">{{ t('analytics.fieldApiName') }}</span>
          <input v-model="form.apiName" type="text" class="w-full rounded-lg border px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900" />
        </label>
        <label class="block text-sm">
          <span class="mb-1 block font-medium">{{ t('analytics.fieldModule') }}</span>
          <select v-model="form.primaryModule" class="w-full rounded-lg border px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900">
            <option v-for="mod in catalogModules" :key="mod.moduleKey" :value="mod.moduleKey">
              {{ mod.label }}
            </option>
          </select>
        </label>
        <label class="block text-sm">
          <span class="mb-1 block font-medium">{{ t('analytics.fieldType') }}</span>
          <select v-model="form.type" class="w-full rounded-lg border px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900">
            <option value="tabular">{{ t('analytics.typeTabular') }}</option>
            <option value="summary">{{ t('analytics.typeSummary') }}</option>
            <option value="kpi">{{ t('analytics.typeKpi') }}</option>
            <option value="joined">{{ t('analytics.typeJoined') }}</option>
            <option value="trend">{{ t('analytics.typeTrend') }}</option>
            <option value="matrix">{{ t('analytics.typeMatrix') }}</option>
            <option value="exception">{{ t('analytics.typeException') }}</option>
          </select>
        </label>
        <div v-if="joinTargets.length" class="block text-sm">
          <span class="mb-1 block font-medium">{{ t('analytics.fieldRelatedModules') }}</span>
          <div class="space-y-1 rounded-lg border px-3 py-2 dark:border-neutral-600">
            <label
              v-for="join in joinTargets"
              :key="join.relationshipKey"
              class="flex items-center gap-2"
            >
              <input
                v-model="relatedModules"
                type="checkbox"
                :value="join.targetModule"
              />
              <span>{{ join.targetModule }}</span>
            </label>
          </div>
        </div>
        <label v-if="folders.length" class="block text-sm">
          <span class="mb-1 block font-medium">{{ t('analytics.fieldFolder') }}</span>
          <select v-model="form.folderId" class="w-full rounded-lg border px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900">
            <option value="">{{ t('analytics.filterUnfiled') }}</option>
            <option v-for="folder in folders" :key="folder._id" :value="folder._id">
              {{ folder.name }}
            </option>
          </select>
        </label>
      </section>

      <section class="space-y-4 rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          {{ t('analytics.sectionConfigure') }}
        </h2>
        <label v-if="showGroupBy" class="block text-sm">
          <span class="mb-1 block font-medium">{{ t('analytics.fieldGroupBy') }}</span>
          <select
            v-model="groupByField"
            class="w-full rounded-lg border px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900"
          >
            <option v-for="field in moduleFields" :key="field" :value="field">
              {{ field }}
            </option>
          </select>
        </label>
        <div v-if="showMetrics" class="space-y-3">
          <div class="flex items-center justify-between gap-2">
            <p class="text-sm font-medium">{{ t('analytics.fieldMetrics') }}</p>
            <button
              v-if="form.type !== 'kpi' && metrics.length < 3"
              type="button"
              class="text-xs font-medium text-primary-600 hover:underline"
              @click="addMetric"
            >
              {{ t('analytics.metricAdd') }}
            </button>
          </div>
          <div
            v-for="(metric, index) in metrics"
            :key="index"
            class="space-y-2 rounded-lg border border-neutral-200 p-3 dark:border-neutral-600"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                {{ form.type === 'kpi' ? t('analytics.metricPrimary') : t('analytics.metricIndex', { index: index + 1 }) }}
              </span>
              <button
                v-if="form.type !== 'kpi' && metrics.length > 1"
                type="button"
                class="text-xs text-neutral-500 hover:text-red-600"
                @click="removeMetric(index)"
              >
                {{ t('actions.remove') }}
              </button>
            </div>
            <label class="block text-sm">
              <span class="mb-1 block text-neutral-600 dark:text-neutral-400">{{ t('analytics.metricFn') }}</span>
              <select
                v-model="metric.fn"
                class="w-full rounded-lg border px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900"
                @change="onMetricFnChange(metric)"
              >
                <option v-for="fn in aggregationFns" :key="fn" :value="fn">
                  {{ t(`analytics.metricFn_${fn}`) }}
                </option>
              </select>
            </label>
            <label v-if="metric.fn !== 'count'" class="block text-sm">
              <span class="mb-1 block text-neutral-600 dark:text-neutral-400">{{ t('analytics.metricField') }}</span>
              <select
                v-model="metric.field"
                class="w-full rounded-lg border px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900"
              >
                <option v-for="field in numericModuleFields" :key="field" :value="field">
                  {{ field }}
                </option>
              </select>
            </label>
            <label class="block text-sm">
              <span class="mb-1 block text-neutral-600 dark:text-neutral-400">{{ t('analytics.metricLabel') }}</span>
              <input
                v-model="metric.label"
                type="text"
                class="w-full rounded-lg border px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900"
                :placeholder="defaultMetricLabel(metric)"
              />
            </label>
          </div>
          <p v-if="form.type === 'kpi'" class="text-xs text-neutral-500">
            {{ t('analytics.metricKpiHint') }}
          </p>
        </div>
        <div v-else-if="showColumnPicker" class="space-y-2">
          <p class="text-sm font-medium">{{ t('analytics.fieldColumns') }}</p>
          <label
            v-for="field in moduleFields"
            :key="field"
            class="flex items-center gap-2 text-sm"
          >
            <input v-model="selectedFields" type="checkbox" :value="field" />
            {{ field }}
          </label>
        </div>

        <div class="space-y-2">
          <p class="text-sm font-medium">{{ t('analytics.sectionFilters') }}</p>
          <ReportFilterSection
            :key="`${form.primaryModule}-${filterRemountToken}`"
            :module-key="form.primaryModule"
            :field-keys="moduleFields"
            :initial-state="filterInitialState"
            @update:state="onFilterStateChange"
          />
        </div>
      </section>

      <section class="rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            {{ t('analytics.sectionPreview') }}
          </h2>
          <span v-if="previewResult?.meta" class="text-xs text-neutral-500">
            {{ t('analytics.previewRows', { count: previewResult.meta.totalRows, ms: previewResult.meta.executionMs }) }}
          </span>
        </div>
        <ReportTypePreviewPanel
          :result="previewResult"
          :report-type="form.type"
          :metric-field="previewMetricField"
          :dimension-field="groupByField"
          :label="previewKpiLabel"
          :loading="executing"
          :theme-mode="themeMode"
          :empty-message="t('analytics.previewEmpty')"
        />
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import ReportTypePreviewPanel from '@/components/analytics/ReportTypePreviewPanel.vue';
import ReportFilterSection from '@/components/analytics/ReportFilterSection.vue';
import { useAnalyticsReports } from '@/composables/useAnalyticsReports';
import { useAnalyticsHome } from '@/composables/useAnalyticsHome';
import { useColorMode } from '@/composables/useColorMode';
import {
  captureAnalyticsReportCreated,
  captureAnalyticsReportPublished,
} from '@/config/posthogAnalytics';
import { hydrateFilterBuilderFromAst } from '@/utils/marketingAudienceFilterConfig';
import {
  buildAnalyticsFilterConfigByKey,
  buildAnalyticsFilterTree,
} from '@/utils/analyticsFilterConfig';

const props = defineProps({
  reportId: { type: String, default: null },
});

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const {
  catalogModules,
  previewResult,
  saving,
  executing,
  fetchCatalog,
  fetchReport,
  createReport,
  updateReport,
  publishReport,
  previewReport,
} = useAnalyticsReports();
const { folders, fetchFolders } = useAnalyticsHome();
const { effectiveDark } = useColorMode();

const themeMode = computed(() => (effectiveDark.value ? 'dark' : 'light'));

const isNew = computed(() => !props.reportId && route.name === 'analytics-report-create');

const showColumnPicker = computed(() => form.type === 'tabular' || form.type === 'joined');
const showGroupBy = computed(() =>
  !showColumnPicker.value && form.type !== 'kpi',
);
const showMetrics = computed(() => !showColumnPicker.value);

const form = reactive({
  name: '',
  apiName: '',
  primaryModule: 'deals',
  type: 'summary',
  folderId: '',
});

const aggregationFns = ['count', 'sum', 'avg', 'min', 'max'];

const groupByField = ref('stage');
const metrics = ref([{ fn: 'count', field: '_id', label: 'count' }]);
const selectedFields = ref(['name', 'stage', 'amount']);
const filterState = ref(null);
const filterInitialState = ref(null);
const filterRemountToken = ref(0);
const autoPreview = ref(false);
let previewTimer = null;

const moduleFields = computed(() => {
  const mod = catalogModules.value.find((m) => m.moduleKey === form.primaryModule);
  if (mod?.fields?.length) {
    return mod.fields.map((field) => field.key);
  }
  return mod?.defaultFields?.length ? mod.defaultFields : ['name'];
});

const joinTargets = computed(() => {
  const mod = catalogModules.value.find((m) => m.moduleKey === form.primaryModule);
  return mod?.joinTargets || [];
});

const relatedModules = ref([]);

const numericModuleFields = computed(() => {
  const mod = catalogModules.value.find((m) => m.moduleKey === form.primaryModule);
  if (mod?.fields?.length) {
    const typed = mod.fields
      .filter((field) => {
        const type = String(field.type || '').toLowerCase();
        return ['number', 'currency', 'percent', 'integer', 'decimal', 'float'].includes(type);
      })
      .map((field) => field.key);
    if (typed.length) return typed;
  }
  const heuristic = moduleFields.value.filter((key) =>
    /amount|total|score|percent|rate|rating|probability|qty|quantity|count|value|price|cost|revenue/i.test(key),
  );
  return heuristic.length ? heuristic : moduleFields.value.filter((key) => key !== '_id');
});

function defaultMetricLabel(metric) {
  if (metric.fn === 'count') return 'count';
  return `${metric.field}_${metric.fn}`;
}

function onMetricFnChange(metric) {
  if (metric.fn === 'count') {
    metric.field = '_id';
    if (!metric.label || metric.label.includes('_')) metric.label = 'count';
    return;
  }
  if (!numericModuleFields.value.includes(metric.field)) {
    metric.field = numericModuleFields.value[0] || 'amount';
  }
  if (!metric.label || metric.label === 'count') {
    metric.label = defaultMetricLabel(metric);
  }
}

function addMetric() {
  const field = numericModuleFields.value[0] || 'amount';
  metrics.value.push({ fn: 'sum', field, label: `${field}_sum` });
}

function removeMetric(index) {
  metrics.value.splice(index, 1);
}

function buildAggregations() {
  return metrics.value.map((metric) => ({
    field: metric.fn === 'count' ? '_id' : metric.field,
    fn: metric.fn,
    label: (metric.label || defaultMetricLabel(metric)).trim(),
  }));
}

const previewMetricField = computed(() => {
  const primary = metrics.value[0];
  if (!primary) return 'count';
  return (primary.label || defaultMetricLabel(primary)).trim();
});

const previewKpiLabel = computed(() => {
  const primary = metrics.value[0];
  if (!primary) return form.name || t('analytics.typeKpi');
  const fnLabel = t(`analytics.metricFn_${primary.fn}`);
  if (primary.fn === 'count') return form.name || fnLabel;
  return `${fnLabel} (${primary.field})`;
});

function slugify(name) {
  return String(name || 'report')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80);
}

function onFilterStateChange(nextState) {
  filterState.value = nextState;
}

function buildFilterPayload() {
  if (!filterState.value) {
    return { filterTree: null, filterLogic: 'AND' };
  }

  const filterByKey = buildAnalyticsFilterConfigByKey(
    moduleFields.value.map((field, index) => ({
      key: field,
      label: field,
      filterType: 'text',
      fieldPath: field,
      options: [],
      priority: index + 1,
    })),
  );

  const filterTree = buildAnalyticsFilterTree(
    filterState.value.query,
    filterState.value.filters,
    filterState.value.operators,
    filterByKey,
  );

  return {
    filterTree,
    filterLogic: filterState.value.query?.logic || 'AND',
  };
}

function buildPayload() {
  const payload = {
    name: form.name.trim(),
    apiName: form.apiName.trim() || slugify(form.name),
    primaryModule: form.primaryModule,
    type: form.type,
    relatedModules: relatedModules.value,
    selectedFields: [],
    rowGroups: [],
    aggregations: [],
    folderId: form.folderId || null,
    ...buildFilterPayload(),
  };

  if (form.type === 'tabular' || form.type === 'joined') {
    payload.selectedFields = selectedFields.value.map((field) => ({ field, role: 'dimension' }));
  } else {
    if (showGroupBy.value && groupByField.value.trim()) {
      payload.rowGroups = [{ field: groupByField.value.trim() }];
    }
    payload.aggregations = buildAggregations();
  }

  return payload;
}

function applyModuleDefaults() {
  const fields = moduleFields.value;
  if (!fields.includes(groupByField.value)) {
    groupByField.value = fields.includes('stage') ? 'stage' : fields[0];
  }
  selectedFields.value = fields.slice(0, Math.min(3, fields.length));
}

function hydrateFiltersFromReport(report) {
  if (!report?.filterTree) {
    filterInitialState.value = null;
    filterState.value = null;
    return;
  }

  const hydrated = hydrateFilterBuilderFromAst(report.filterTree, form.primaryModule);
  filterInitialState.value = {
    query: hydrated.query,
    filters: hydrated.filters,
    operators: hydrated.operators,
  };
  filterState.value = filterInitialState.value;
}

async function saveDraft() {
  const payload = buildPayload();
  if (isNew.value) {
    const res = await createReport(payload);
    if (res?.success) {
      captureAnalyticsReportCreated({ module: payload.primaryModule, type: payload.type });
      router.replace({ name: 'analytics-report-edit', params: { id: res.data._id } });
    }
  } else {
    const id = props.reportId || route.params.id;
    await updateReport(String(id), payload);
  }
}

async function runPreview() {
  await previewReport(buildPayload());
}

function schedulePreview() {
  if (!autoPreview.value) return;
  clearTimeout(previewTimer);
  previewTimer = setTimeout(() => {
    void runPreview();
  }, 800);
}

async function publish() {
  const id = props.reportId || route.params.id;
  if (!id) return;
  await saveDraft();
  const res = await publishReport(String(id));
  if (res?.success) {
    captureAnalyticsReportPublished({ report_id: id });
    router.push({ name: 'analytics-report-detail', params: { id } });
  }
}

function goBack() {
  router.push({ name: 'analytics-reports' });
}

watch(
  () => form.name,
  (name) => {
    if (isNew.value && !form.apiName) {
      form.apiName = slugify(name);
    }
  },
);

watch(
  () => form.primaryModule,
  (next, prev) => {
    if (prev && next !== prev) {
      filterInitialState.value = null;
      filterState.value = null;
      filterRemountToken.value += 1;
    }
    applyModuleDefaults();
    schedulePreview();
  },
);

watch(
  [form, groupByField, metrics, selectedFields, filterState],
  () => {
    schedulePreview();
  },
  { deep: true },
);

watch(
  () => form.type,
  (nextType) => {
    if (nextType === 'kpi' && metrics.value.length > 1) {
      metrics.value = [metrics.value[0]];
    }
    applyModuleDefaults();
    schedulePreview();
  },
);

onMounted(async () => {
  await Promise.all([fetchCatalog(), fetchFolders()]);
  if (catalogModules.value.length && isNew.value) {
    form.primaryModule = catalogModules.value[0].moduleKey;
  }
  applyModuleDefaults();

  const id = props.reportId || route.params.id;
  if (id) {
    const res = await fetchReport(String(id));
    if (res?.success && res.data) {
      const r = res.data;
      form.name = r.name;
      form.apiName = r.apiName;
      form.primaryModule = r.primaryModule;
      form.type = r.type;
      form.folderId = r.folderId ? String(r.folderId) : '';
      relatedModules.value = Array.isArray(r.relatedModules) ? [...r.relatedModules] : [];
      if (Array.isArray(r.rowGroups) && r.rowGroups.length) {
        groupByField.value = r.rowGroups[0].field || r.rowGroups[0];
      }
      if (Array.isArray(r.selectedFields)) {
        selectedFields.value = r.selectedFields.map((f) => f.field || f).filter(Boolean);
      }
      if (Array.isArray(r.aggregations) && r.aggregations.length) {
        metrics.value = r.aggregations.map((agg) => ({
          fn: String(agg.fn || 'count').toLowerCase(),
          field: agg.fn === 'count' ? '_id' : String(agg.field || numericModuleFields.value[0] || 'amount'),
          label: String(agg.label || defaultMetricLabel({ fn: agg.fn, field: agg.field })),
        }));
      }
      hydrateFiltersFromReport(r);
    }
  }

  autoPreview.value = true;
  schedulePreview();
});

onUnmounted(() => {
  clearTimeout(previewTimer);
});
</script>
