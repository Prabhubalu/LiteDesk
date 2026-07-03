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
            {{ t('analytics.listTitle') }}
          </h1>
          <p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            {{ t('analytics.listDescription') }}
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <router-link
            :to="{ name: 'analytics-home' }"
            class="inline-flex items-center rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium dark:border-neutral-600"
          >
            {{ t('analytics.homeTitle') }}
          </router-link>
          <router-link
            :to="{ name: 'analytics-widgets' }"
            class="inline-flex items-center rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium dark:border-neutral-600"
          >
            {{ t('analytics.widgetsListTitle') }}
          </router-link>
          <router-link
            :to="{ name: 'analytics-dashboards' }"
            class="inline-flex items-center rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium dark:border-neutral-600"
          >
            {{ t('analytics.dashboardsListTitle') }}
          </router-link>
          <button
            v-if="canCreate"
            type="button"
            class="inline-flex items-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500"
            @click="goCreate"
          >
            {{ t('analytics.newReport') }}
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
          v-model="filterType"
          class="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-900"
          @change="load"
        >
          <option value="">{{ t('analytics.filterAllTypes') }}</option>
          <option value="tabular">{{ t('analytics.typeTabular') }}</option>
          <option value="summary">{{ t('analytics.typeSummary') }}</option>
          <option value="kpi">{{ t('analytics.typeKpi') }}</option>
        </select>

        <select
          v-model="filterModule"
          class="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-900"
          @change="load"
        >
          <option value="">{{ t('analytics.filterAllModules') }}</option>
          <option v-for="mod in catalogModules" :key="mod.moduleKey" :value="mod.moduleKey">
            {{ mod.label }}
          </option>
        </select>

        <select
          v-if="folders.length"
          v-model="filterFolder"
          class="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-900"
          @change="load"
        >
          <option value="">{{ t('analytics.filterAllFolders') }}</option>
          <option value="none">{{ t('analytics.filterUnfiled') }}</option>
          <option v-for="folder in folders" :key="folder._id" :value="folder._id">
            {{ folder.name }}
          </option>
        </select>

        <input
          v-model="search"
          type="search"
          class="ml-auto min-w-[12rem] rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-900"
          :placeholder="t('analytics.searchPlaceholder')"
          @input="debouncedLoad"
        />
      </div>

      <div v-if="loading" class="py-16 text-center text-sm text-neutral-500">
        {{ t('states.loading') }}
      </div>

      <div
        v-else-if="showEmptyState"
        class="rounded-xl border border-dashed border-neutral-300 px-6 py-16 text-center dark:border-neutral-600"
      >
        <h2 class="text-lg font-medium text-neutral-900 dark:text-white">
          {{ emptyTitle }}
        </h2>
        <p class="mt-2 text-sm text-neutral-500">{{ emptyDescription }}</p>
        <button
          v-if="canCreate && showCreateCta"
          type="button"
          class="mt-4 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white"
          @click="goCreate"
        >
          {{ isFirstVisit ? t('onboarding.firstTimeReportsAction') : t('analytics.newReport') }}
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
                {{ t('analytics.colType') }}
              </th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase text-neutral-500">
                {{ t('analytics.colModule') }}
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
              v-for="row in reports"
              :key="row._id"
              class="cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
              @click="openReport(row._id)"
            >
              <td class="px-4 py-3 text-sm font-medium text-neutral-900 dark:text-white">
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    class="text-lg leading-none"
                    :aria-label="isFavorite('report', row._id) ? t('analytics.favoriteRemove') : t('analytics.favoriteAdd')"
                    @click.stop="toggleFavorite('report', row._id)"
                  >
                    {{ isFavorite('report', row._id) ? '★' : '☆' }}
                  </button>
                  <span>{{ row.name }}</span>
                </div>
              </td>
              <td class="px-4 py-3 text-sm capitalize text-neutral-600 dark:text-neutral-300">
                {{ row.type }}
              </td>
              <td class="px-4 py-3 text-sm text-neutral-600 dark:text-neutral-300">
                {{ moduleLabel(row.primaryModule) }}
              </td>
              <td class="px-4 py-3 text-sm capitalize text-neutral-600 dark:text-neutral-300">
                {{ statusLabel(row.status) }}
              </td>
              <td class="px-4 py-3 text-sm text-neutral-500">
                {{ formatDate(row.updatedAt) }}
              </td>
              <td class="px-4 py-3 text-right">
                <ReportRowActionsMenu
                  :can-run="row.status === 'published'"
                  :can-edit="canEdit && row.status !== 'archived'"
                  :can-create="canCreate"
                  :can-export="row.status === 'published'"
                  :can-archive="canArchive && row.status !== 'archived'"
                  @run="runReport(row._id)"
                  @edit="editReport(row._id)"
                  @duplicate="duplicateRow(row._id)"
                  @export="exportRow(row._id)"
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
import { useAnalyticsReports } from '@/composables/useAnalyticsReports';
import { useAnalyticsHome } from '@/composables/useAnalyticsHome';
import { useAuthStore } from '@/stores/authRegistry';
import { useOnboarding } from '@/composables/useOnboarding';
import {
  captureAnalyticsModuleVisited,
  captureAnalyticsReportArchived,
  captureAnalyticsReportDuplicated,
  captureAnalyticsReportExecuted,
} from '@/config/posthogAnalytics';
import { captureFirstTimeEmptyStateSeen } from '@/config/posthogOnboarding';

const { t } = useI18n();
const router = useRouter();
const authStore = useAuthStore();
const { hasModuleVisit, recordModuleVisit } = useOnboarding();
const {
  reports,
  catalogModules,
  loading,
  fetchCatalog,
  fetchReports,
  duplicateReport,
  archiveReport,
  executeReport,
  exportReport,
} = useAnalyticsReports();
const { folders, fetchFolders, isFavorite, toggleFavorite } = useAnalyticsHome();

const activeTab = ref('all');
const search = ref('');
const filterType = ref('');
const filterModule = ref('');
const filterFolder = ref('');
const isFirstVisit = ref(false);
let searchTimer = null;

const canView = computed(() => authStore.can('reports', 'view'));
const canCreate = computed(() => authStore.can('reports', 'create'));
const canEdit = computed(() => authStore.can('reports', 'edit'));
const canArchive = computed(() => authStore.can('reports', 'delete'));

const tabs = [
  { key: 'all', label: t('analytics.tabAll') },
  { key: 'mine', label: t('analytics.tabMine') },
  { key: 'draft', label: t('analytics.tabDrafts') },
  { key: 'published', label: t('analytics.tabPublished') },
  { key: 'archived', label: t('analytics.tabArchived') },
];

const hasActiveFilters = computed(() => {
  return (
    Boolean(search.value.trim()) ||
    activeTab.value !== 'all' ||
    Boolean(filterType.value) ||
    Boolean(filterModule.value) ||
    Boolean(filterFolder.value)
  );
});

const showEmptyState = computed(() => reports.value.length === 0);

const showCreateCta = computed(() => !hasActiveFilters.value);

const emptyTitle = computed(() => {
  if (hasActiveFilters.value) return t('analytics.emptyNoResultsTitle');
  if (isFirstVisit.value) return t('onboarding.firstTimeReportsTitle');
  return t('analytics.emptyNoDataTitle');
});

const emptyDescription = computed(() => {
  if (hasActiveFilters.value) return t('analytics.emptyNoResultsDescription');
  if (isFirstVisit.value) return t('onboarding.firstTimeReportsDescription');
  return t('analytics.emptyNoDataDescription');
});

function moduleLabel(moduleKey) {
  const mod = catalogModules.value.find((m) => m.moduleKey === moduleKey);
  return mod?.label || moduleKey;
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
  if (activeTab.value === 'mine') params.mine = true;
  if (['draft', 'published', 'archived'].includes(activeTab.value)) {
    params.status = activeTab.value;
  }
  if (search.value.trim()) params.search = search.value.trim();
  if (filterType.value) params.type = filterType.value;
  if (filterModule.value) params.primaryModule = filterModule.value;
  if (filterFolder.value) params.folderId = filterFolder.value;
  return params;
}

async function load() {
  if (!canView.value) return;
  try {
    await fetchReports(listParams());
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
  load();
}

function goCreate() {
  router.push({ name: 'analytics-report-create' });
}

function openReport(id) {
  router.push({ name: 'analytics-report-detail', params: { id } });
}

function editReport(id) {
  router.push({ name: 'analytics-report-edit', params: { id } });
}

async function runReport(id) {
  const res = await executeReport(String(id), {});
  if (res?.success) {
    captureAnalyticsReportExecuted({ report_id: id, surface: 'reports_list' });
    openReport(id);
  }
}

async function duplicateRow(id) {
  const res = await duplicateReport(String(id));
  if (res?.success) {
    captureAnalyticsReportDuplicated({ source_report_id: id, report_id: res.data?._id });
    await load();
    if (res.data?._id) {
      editReport(res.data._id);
    }
  }
}

async function exportRow(id) {
  await exportReport(String(id), 'csv', {});
}

async function archiveRow(row) {
  if (!window.confirm(t('analytics.archiveConfirm', { name: row.name }))) return;
  const res = await archiveReport(String(row._id));
  if (res?.success) {
    captureAnalyticsReportArchived({ report_id: row._id });
    await load();
  }
}

onMounted(async () => {
  isFirstVisit.value = !hasModuleVisit('reports', 'PLATFORM');
  captureAnalyticsModuleVisited({ surface: 'reports_list' });

  if (isFirstVisit.value && canView.value) {
    captureFirstTimeEmptyStateSeen('reports', 'PLATFORM', {
      persona: authStore.user?.onboarding?.persona,
      origin: authStore.user?.onboarding?.origin,
      organizationId: authStore.user?.organizationId,
    });
  }

  void recordModuleVisit('reports', 'PLATFORM');
  await Promise.all([fetchCatalog(), fetchFolders()]);
  load();
});
</script>
