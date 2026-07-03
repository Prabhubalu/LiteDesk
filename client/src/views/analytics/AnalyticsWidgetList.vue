<template>
  <div class="mx-auto w-full px-6 py-8">
    <div
      v-if="!canView"
      class="rounded-xl border border-dashed border-neutral-300 px-6 py-16 text-center dark:border-neutral-600"
    >
      <h2 class="text-lg font-medium text-neutral-900 dark:text-white">
        {{ t('analytics.emptyNoAccessTitle') }}
      </h2>
      <p class="mt-2 text-sm text-neutral-500">{{ t('analytics.emptyNoAccessDescription') }}</p>
    </div>

    <template v-else>
      <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 class="text-2xl font-semibold text-neutral-900 dark:text-white">
            {{ t('analytics.widgetsListTitle') }}
          </h1>
          <p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            {{ t('analytics.widgetsListDescription') }}
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium dark:border-neutral-600"
            @click="goHome"
          >
            {{ t('analytics.homeTitle') }}
          </button>
          <button
            type="button"
            class="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium dark:border-neutral-600"
            @click="goReports"
          >
            {{ t('analytics.listTitle') }}
          </button>
          <button
            type="button"
            class="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium dark:border-neutral-600"
            @click="goDashboards"
          >
            {{ t('analytics.dashboardsListTitle') }}
          </button>
          <button
            v-if="canCreate"
            type="button"
            class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500"
            @click="goCreate"
          >
            {{ t('analytics.newWidget') }}
          </button>
        </div>
      </div>

      <div class="mb-4 flex flex-wrap items-center gap-2">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          type="button"
          class="rounded-full px-3 py-1 text-sm font-medium transition-colors"
          :class="
            activeTab === tab.key
              ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300'
              : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800'
          "
          @click="setTab(tab.key)"
        >
          {{ tab.label }}
        </button>

        <select
          v-if="activeTab !== 'templates'"
          v-model="filterChartType"
          class="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-900"
          @change="load"
        >
          <option value="">{{ t('analytics.filterAllChartTypes') }}</option>
          <option v-for="type in chartTypes" :key="type" :value="type">
            {{ t(`analytics.chartType_${type}`) }}
          </option>
        </select>

        <input
          v-if="activeTab !== 'templates'"
          v-model="search"
          type="search"
          class="ml-auto min-w-[12rem] rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-900"
          :placeholder="t('analytics.widgetsSearchPlaceholder')"
          @input="debouncedLoad"
        />
      </div>

      <div v-if="loading" class="py-16 text-center text-sm text-neutral-500">
        {{ t('states.loading') }}
      </div>

      <div
        v-else-if="activeTab === 'templates'"
        class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <div
          v-for="template in templates"
          :key="template.templateKey"
          class="flex flex-col rounded-xl border border-neutral-200 p-4 dark:border-neutral-700"
        >
          <p class="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            {{ template.category }}
          </p>
          <h3 class="mt-1 text-base font-medium text-neutral-900 dark:text-white">
            {{ template.name }}
          </h3>
          <p class="mt-2 flex-1 text-sm text-neutral-500">{{ template.description }}</p>
          <p class="mt-2 text-xs capitalize text-neutral-400">
            {{ t(`analytics.chartType_${template.chartType}`, template.chartType) }}
          </p>
          <button
            v-if="canCreate"
            type="button"
            class="mt-4 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-500"
            @click="useTemplate(template.templateKey)"
          >
            {{ t('analytics.templateUseButton') }}
          </button>
        </div>
      </div>

      <div
        v-else-if="showEmptyState"
        class="rounded-xl border border-dashed border-neutral-300 px-6 py-16 text-center dark:border-neutral-600"
      >
        <h2 class="text-lg font-medium text-neutral-900 dark:text-white">{{ emptyTitle }}</h2>
        <p class="mt-2 text-sm text-neutral-500">{{ emptyDescription }}</p>
        <button
          v-if="canCreate && showCreateCta"
          type="button"
          class="mt-4 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white"
          @click="goCreate"
        >
          {{ isFirstVisit ? t('analytics.widgetsFirstTimeAction') : t('analytics.newWidget') }}
        </button>
        <button
          v-if="canCreate && showCreateCta"
          type="button"
          class="ml-2 mt-4 rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium dark:border-neutral-600"
          @click="setTab('templates')"
        >
          {{ t('analytics.tabTemplates') }}
        </button>
      </div>

      <div v-else class="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-700">
        <table class="min-w-full divide-y divide-neutral-200 dark:divide-neutral-700">
          <thead class="bg-neutral-50 dark:bg-neutral-800">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase text-neutral-500">
                {{ t('analytics.colName') }}
              </th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase text-neutral-500">
                {{ t('analytics.colChartType') }}
              </th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase text-neutral-500">
                {{ t('analytics.colReport') }}
              </th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase text-neutral-500">
                {{ t('analytics.colStatus') }}
              </th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase text-neutral-500">
                {{ t('analytics.colUpdated') }}
              </th>
              <th class="px-4 py-3 text-right text-xs font-semibold uppercase text-neutral-500">
                {{ t('analytics.colActions') }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-neutral-200 bg-white dark:divide-neutral-700 dark:bg-neutral-900">
            <tr
              v-for="row in widgets"
              :key="row._id"
              class="cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
              @click="openWidget(row._id)"
            >
              <td class="px-4 py-3 text-sm font-medium text-neutral-900 dark:text-white">{{ row.name }}</td>
              <td class="px-4 py-3 text-sm capitalize text-neutral-600 dark:text-neutral-300">
                {{ t(`analytics.chartType_${row.chartType}`, row.chartType) }}
              </td>
              <td class="px-4 py-3 text-sm text-neutral-600 dark:text-neutral-300">
                {{ reportName(row) }}
              </td>
              <td class="px-4 py-3 text-sm capitalize text-neutral-600 dark:text-neutral-300">
                {{ statusLabel(row.status) }}
              </td>
              <td class="px-4 py-3 text-sm text-neutral-500">{{ formatDate(row.updatedAt) }}</td>
              <td class="px-4 py-3 text-right">
                <ReportRowActionsMenu
                  :can-edit="canEdit && row.status !== 'archived'"
                  :can-create="canCreate"
                  :can-archive="canArchive && row.status !== 'archived'"
                  @edit="editWidget(row._id)"
                  @duplicate="duplicateRow(row._id)"
                  @archive="archiveRow(row)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import ReportRowActionsMenu from '@/components/analytics/ReportRowActionsMenu.vue';
import { useAnalyticsWidgets } from '@/composables/useAnalyticsWidgets';
import { useAuthStore } from '@/stores/authRegistry';
import { useOnboarding } from '@/composables/useOnboarding';
import {
  captureAnalyticsModuleVisited,
  captureAnalyticsWidgetArchived,
  captureAnalyticsWidgetDuplicated,
} from '@/config/posthogAnalytics';
import { captureFirstTimeEmptyStateSeen } from '@/config/posthogOnboarding';

const { t } = useI18n();
const router = useRouter();
const authStore = useAuthStore();
const { hasModuleVisit, recordModuleVisit } = useOnboarding();
const {
  widgets,
  templates,
  loading,
  fetchWidgets,
  fetchTemplates,
  duplicateWidget,
  archiveWidget,
} = useAnalyticsWidgets();

const activeTab = ref('all');
const search = ref('');
const filterChartType = ref('');
const isFirstVisit = ref(false);
let searchTimer = null;

const canView = computed(() => authStore.can('reports', 'view'));
const canCreate = computed(() => authStore.can('reports', 'create'));
const canEdit = computed(() => authStore.can('reports', 'edit'));
const canArchive = computed(() => authStore.can('reports', 'delete'));

const chartTypes = ['bar', 'line', 'area', 'pie', 'donut', 'funnel', 'kpi', 'table'];

const tabs = computed(() => [
  { key: 'all', label: t('analytics.tabAll') },
  { key: 'draft', label: t('analytics.tabDrafts') },
  { key: 'published', label: t('analytics.tabPublished') },
  { key: 'archived', label: t('analytics.tabArchived') },
  { key: 'templates', label: t('analytics.tabTemplates') },
]);

const hasActiveFilters = computed(() => {
  return Boolean(search.value.trim()) || activeTab.value !== 'all' || Boolean(filterChartType.value);
});

const showEmptyState = computed(() => activeTab.value !== 'templates' && widgets.value.length === 0);

const showCreateCta = computed(() => !hasActiveFilters.value);

const emptyTitle = computed(() => {
  if (hasActiveFilters.value) return t('analytics.emptyNoResultsTitle');
  if (isFirstVisit.value) return t('analytics.widgetsFirstTimeTitle');
  return t('analytics.widgetsEmptyTitle');
});

const emptyDescription = computed(() => {
  if (hasActiveFilters.value) return t('analytics.emptyNoResultsDescription');
  if (isFirstVisit.value) return t('analytics.widgetsFirstTimeDescription');
  return t('analytics.widgetsEmptyDescription');
});

function reportName(row) {
  const report = row.reportId;
  if (report && typeof report === 'object') return report.name || report.apiName;
  return row.reportApiName || '—';
}

function statusLabel(status) {
  if (status === 'published') return t('analytics.statusPublished');
  if (status === 'archived') return t('analytics.statusArchived');
  return t('analytics.statusDraft');
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}

function listParams() {
  const params = { limit: 100 };
  if (['draft', 'published', 'archived'].includes(activeTab.value)) {
    params.status = activeTab.value;
  }
  if (search.value.trim()) params.search = search.value.trim();
  if (filterChartType.value) params.chartType = filterChartType.value;
  return params;
}

async function load() {
  if (!canView.value || activeTab.value === 'templates') return;
  try {
    await fetchWidgets(listParams());
  } catch {
    /* list empty */
  }
}

function debouncedLoad() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(load, 300);
}

function setTab(key) {
  activeTab.value = key;
  if (key === 'templates') {
    void fetchTemplates();
  } else {
    load();
  }
}

function goCreate() {
  router.push({ name: 'analytics-widget-create' });
}

function goReports() {
  router.push({ name: 'analytics-reports' });
}

function goHome() {
  router.push({ name: 'analytics-home' });
}

function goDashboards() {
  router.push({ name: 'analytics-dashboards' });
}

function openWidget(id) {
  router.push({ name: 'analytics-widget-detail', params: { id } });
}

function editWidget(id) {
  router.push({ name: 'analytics-widget-edit', params: { id } });
}

function useTemplate(templateKey) {
  router.push({ name: 'analytics-widget-create', query: { template: templateKey } });
}

async function duplicateRow(id) {
  const res = await duplicateWidget(String(id));
  if (res?.success) {
    captureAnalyticsWidgetDuplicated({ source_widget_id: id, widget_id: res.data?._id });
    await load();
    if (res.data?._id) {
      editWidget(res.data._id);
    }
  }
}

async function archiveRow(row) {
  if (!window.confirm(t('analytics.widgetArchiveConfirm', { name: row.name }))) return;
  const res = await archiveWidget(String(row._id));
  if (res?.success) {
    captureAnalyticsWidgetArchived({ widget_id: row._id });
    await load();
  }
}

onMounted(async () => {
  isFirstVisit.value = !hasModuleVisit('widgets', 'PLATFORM');
  captureAnalyticsModuleVisited({ surface: 'widgets_list' });

  if (isFirstVisit.value && canView.value) {
    captureFirstTimeEmptyStateSeen('widgets', 'PLATFORM', {
      persona: authStore.user?.onboarding?.persona,
      origin: authStore.user?.onboarding?.origin,
      organizationId: authStore.user?.organizationId,
    });
  }

  void recordModuleVisit('widgets', 'PLATFORM');
  await fetchTemplates();
  load();
});
</script>
