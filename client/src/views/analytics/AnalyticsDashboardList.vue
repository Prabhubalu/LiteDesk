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
            {{ t('analytics.dashboardsListTitle') }}
          </h1>
          <p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            {{ t('analytics.dashboardsListDescription') }}
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
            @click="goWidgets"
          >
            {{ t('analytics.widgetsListTitle') }}
          </button>
          <button
            v-if="canCreate"
            type="button"
            class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500"
            @click="goCreate"
          >
            {{ t('analytics.newDashboard') }}
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
          v-model="filterCategory"
          class="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-900"
          @change="load"
        >
          <option value="">{{ t('analytics.filterAllCategories') }}</option>
          <option v-for="cat in categories" :key="cat" :value="cat">
            {{ t(`analytics.dashboardCategory_${cat}`) }}
          </option>
        </select>

        <input
          v-if="activeTab !== 'templates'"
          v-model="search"
          type="search"
          class="ml-auto min-w-[12rem] rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-900"
          :placeholder="t('analytics.dashboardsSearchPlaceholder')"
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
            {{ t(`analytics.dashboardCategory_${template.category}`, template.category) }}
          </p>
          <h3 class="mt-1 text-base font-medium text-neutral-900 dark:text-white">
            {{ template.name }}
          </h3>
          <p class="mt-2 flex-1 text-sm text-neutral-500">{{ template.description }}</p>
          <button
            v-if="canCreate"
            type="button"
            class="mt-4 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-500"
            @click="useTemplate(template)"
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
          {{ isFirstVisit ? t('analytics.dashboardsFirstTimeAction') : t('analytics.newDashboard') }}
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
                {{ t('analytics.colCategory') }}
              </th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase text-neutral-500">
                {{ t('analytics.colWidgets') }}
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
              v-for="row in dashboards"
              :key="row._id"
              class="cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
              @click="openDashboard(row._id)"
            >
              <td class="px-4 py-3 text-sm font-medium text-neutral-900 dark:text-white">{{ row.name }}</td>
              <td class="px-4 py-3 text-sm capitalize text-neutral-600 dark:text-neutral-300">
                {{ t(`analytics.dashboardCategory_${row.category}`, row.category) }}
              </td>
              <td class="px-4 py-3 text-sm text-neutral-600 dark:text-neutral-300">
                {{ row.widgetCount ?? row.layout?.length ?? 0 }}
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
                  @edit="editDashboard(row._id)"
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
import { useAnalyticsDashboards } from '@/composables/useAnalyticsDashboards';
import { useAuthStore } from '@/stores/authRegistry';
import { useOnboarding } from '@/composables/useOnboarding';
import {
  captureAnalyticsModuleVisited,
  captureAnalyticsDashboardArchived,
  captureAnalyticsDashboardDuplicated,
} from '@/config/posthogAnalytics';
import { captureFirstTimeEmptyStateSeen } from '@/config/posthogOnboarding';

const { t } = useI18n();
const router = useRouter();
const authStore = useAuthStore();
const { hasModuleVisit, recordModuleVisit } = useOnboarding();
const {
  dashboards,
  templates,
  loading,
  fetchDashboards,
  fetchTemplates,
  createDashboard,
  duplicateDashboard,
  archiveDashboard,
} = useAnalyticsDashboards();

const activeTab = ref('all');
const search = ref('');
const filterCategory = ref('');
const isFirstVisit = ref(false);
let searchTimer = null;

const canView = computed(() => authStore.can('reports', 'view'));
const canCreate = computed(() => authStore.can('reports', 'create'));
const canEdit = computed(() => authStore.can('reports', 'edit'));
const canArchive = computed(() => authStore.can('reports', 'delete'));

const categories = ['personal', 'team', 'executive', 'app'];

const tabs = computed(() => [
  { key: 'all', label: t('analytics.tabAll') },
  { key: 'draft', label: t('analytics.tabDrafts') },
  { key: 'published', label: t('analytics.tabPublished') },
  { key: 'archived', label: t('analytics.tabArchived') },
  { key: 'templates', label: t('analytics.tabTemplates') },
]);

const hasActiveFilters = computed(() => {
  return Boolean(search.value.trim()) || activeTab.value !== 'all' || Boolean(filterCategory.value);
});

const showEmptyState = computed(() => activeTab.value !== 'templates' && dashboards.value.length === 0);
const showCreateCta = computed(() => !hasActiveFilters.value);

const emptyTitle = computed(() => {
  if (hasActiveFilters.value) return t('analytics.emptyNoResultsTitle');
  if (isFirstVisit.value) return t('analytics.dashboardsFirstTimeTitle');
  return t('analytics.dashboardsEmptyTitle');
});

const emptyDescription = computed(() => {
  if (hasActiveFilters.value) return t('analytics.emptyNoResultsDescription');
  if (isFirstVisit.value) return t('analytics.dashboardsFirstTimeDescription');
  return t('analytics.dashboardsEmptyDescription');
});

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
  if (filterCategory.value) params.category = filterCategory.value;
  return params;
}

async function load() {
  if (!canView.value || activeTab.value === 'templates') return;
  try {
    await fetchDashboards(listParams());
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
  router.push({ name: 'analytics-dashboard-create' });
}

function goWidgets() {
  router.push({ name: 'analytics-widgets' });
}

function goHome() {
  router.push({ name: 'analytics-home' });
}

function openDashboard(id) {
  router.push({ name: 'analytics-dashboard-view', params: { id } });
}

function editDashboard(id) {
  router.push({ name: 'analytics-dashboard-edit', params: { id } });
}

async function useTemplate(template) {
  const res = await createDashboard({
    name: template.name,
    description: template.description,
    category: template.category,
    appKey: template.appKey || null,
    templateKey: template.templateKey,
    layout: [],
  });
  if (res?.success && res.data?._id) {
    editDashboard(res.data._id);
  }
}

async function duplicateRow(id) {
  const res = await duplicateDashboard(String(id));
  if (res?.success) {
    captureAnalyticsDashboardDuplicated({ source_dashboard_id: id, dashboard_id: res.data?._id });
    await load();
    if (res.data?._id) {
      editDashboard(res.data._id);
    }
  }
}

async function archiveRow(row) {
  if (!window.confirm(t('analytics.dashboardArchiveConfirm', { name: row.name }))) return;
  const res = await archiveDashboard(String(row._id));
  if (res?.success) {
    captureAnalyticsDashboardArchived({ dashboard_id: row._id });
    await load();
  }
}

onMounted(async () => {
  isFirstVisit.value = !hasModuleVisit('dashboards', 'PLATFORM');
  captureAnalyticsModuleVisited({ surface: 'dashboards_list' });

  if (isFirstVisit.value && canView.value) {
    captureFirstTimeEmptyStateSeen('dashboards', 'PLATFORM', {
      persona: authStore.user?.onboarding?.persona,
      origin: authStore.user?.onboarding?.origin,
      organizationId: authStore.user?.organizationId,
    });
  }

  void recordModuleVisit('dashboards', 'PLATFORM');
  await fetchTemplates();
  load();
});
</script>
