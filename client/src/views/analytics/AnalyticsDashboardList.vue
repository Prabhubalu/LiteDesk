<template>
  <div class="mx-auto w-full">
    <div v-if="showTemplates" class="px-4 py-6 sm:px-6">
      <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
            {{ t('analytics.tabTemplates') }}
          </h1>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {{ t('analytics.dashboardsListDescription') }}
          </p>
        </div>
        <AnalyticsListHeaderActions
          active="dashboards"
          :create-label="t('analytics.newDashboard')"
          show-list
          @create="goCreate"
          @show-list="showTemplates = false"
        />
      </div>

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="template in templates"
          :key="template.templateKey"
          class="flex flex-col rounded-xl border border-gray-200 p-4 dark:border-gray-700"
        >
          <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">
            {{ t(`analytics.dashboardCategory_${template.category}`, template.category) }}
          </p>
          <h3 class="mt-1 text-base font-medium text-gray-900 dark:text-white">
            {{ template.name }}
          </h3>
          <p class="mt-2 flex-1 text-sm text-gray-500">{{ template.description }}</p>
          <button
            v-if="canCreate"
            type="button"
            class="mt-4 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            @click="useTemplate(template)"
          >
            {{ t('analytics.templateUseButton') }}
          </button>
        </div>
      </div>
    </div>

    <ModuleList
      v-else
      ref="moduleListRef"
      module-key="dashboards"
      app-key="PLATFORM"
      @create="goCreate"
      @row-click="openDashboard"
      @edit="editDashboard"
    >
      <template #header-actions>
        <AnalyticsListHeaderActions
          active="dashboards"
          :create-label="t('analytics.newDashboard')"
          show-templates
          @create="goCreate"
          @show-templates="showTemplates = true"
        />
      </template>

      <template #cell-name="{ row }">
        <div class="min-w-0">
          <p class="truncate font-semibold text-gray-900 dark:text-white">
            {{ row.name }}
          </p>
        </div>
      </template>

      <template #cell-category="{ value }">
        <span class="capitalize text-gray-700 dark:text-gray-300">
          {{ t(`analytics.dashboardCategory_${value}`, value) }}
        </span>
      </template>

      <template #cell-widgetCount="{ row }">
        <span class="tabular-nums text-gray-700 dark:text-gray-300">
          {{ row.widgetCount ?? row.layout?.length ?? 0 }}
        </span>
      </template>

      <template #cell-status="{ value }">
        <BadgeCell
          :value="formatStatus(value)"
          :variant="statusVariantMap[value] || 'default'"
        />
      </template>

      <template #cell-updatedAt="{ value }">
        <DateCell :value="value" format="short" />
      </template>

      <template #actions="{ row }">
        <ReportRowActionsMenu
          :can-edit="canEdit && row.status !== 'archived'"
          :can-create="canCreate"
          :can-archive="canArchive && row.status !== 'archived'"
          @edit="editDashboard(row._id)"
          @duplicate="duplicateRow(row._id)"
          @archive="archiveRow(row)"
        />
      </template>
    </ModuleList>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import ModuleList from '@/components/module-list/ModuleList.vue';
import AnalyticsListHeaderActions from '@/components/analytics/AnalyticsListHeaderActions.vue';
import BadgeCell from '@/components/common/table/BadgeCell.vue';
import DateCell from '@/components/common/table/DateCell.vue';
import ReportRowActionsMenu from '@/components/analytics/ReportRowActionsMenu.vue';
import { useAnalyticsDashboards } from '@/composables/useAnalyticsDashboards';
import { useAuthStore } from '@/stores/authRegistry';
import {
  captureAnalyticsModuleVisited,
  captureAnalyticsDashboardArchived,
} from '@/config/posthogAnalytics';

import { confirmAction } from '@/composables/useConfirmAction';
const { t } = useI18n();
const router = useRouter();
const authStore = useAuthStore();
const {
  templates,
  fetchTemplates,
  createDashboard,
  archiveDashboard,
} = useAnalyticsDashboards();

const moduleListRef = ref(null);
const showTemplates = ref(false);

const canCreate = computed(() => authStore.can('reports', 'create'));
const canEdit = computed(() => authStore.can('reports', 'edit'));
const canArchive = computed(() => authStore.can('reports', 'delete'));

const statusVariantMap = {
  draft: 'warning',
  published: 'success',
  archived: 'default',
};

function formatStatus(value) {
  if (value === 'published') return t('analytics.statusPublished');
  if (value === 'archived') return t('analytics.statusArchived');
  return t('analytics.statusDraft');
}

function refreshList() {
  moduleListRef.value?.refresh?.();
}

function goCreate() {
  router.push({ name: 'analytics-dashboard-create' });
}

function openDashboard(row) {
  const id = row?._id || row?.id;
  if (!id) return;
  router.push({ name: 'analytics-dashboard-view', params: { id } });
}

function editDashboard(idOrRow) {
  const id = typeof idOrRow === 'object' ? idOrRow?._id || idOrRow?.id : idOrRow;
  if (!id) return;
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

function duplicateRow(id) {
  router.push({ name: 'analytics-dashboard-create', query: { duplicateFrom: String(id) } });
}

async function archiveRow(row) {
  if (!await confirmAction(t('analytics.dashboardArchiveConfirm', { name: row.name }))) return;
  const res = await archiveDashboard(String(row._id));
  if (res?.success) {
    captureAnalyticsDashboardArchived({ dashboard_id: row._id });
    await refreshList();
  }
}

onMounted(() => {
  captureAnalyticsModuleVisited({ surface: 'dashboards_list' });
  void fetchTemplates();
});
</script>
