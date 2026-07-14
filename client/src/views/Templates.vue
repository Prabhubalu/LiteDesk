<template>
  <div class="mx-auto w-full">
    <TemplatesModuleNav />

    <ListView
      :title="t('templates.listTitle')"
      :description="listDescription"
      module-key="templates"
      :create-label="t('templates.newTemplate')"
      :search-placeholder="t('templates.searchPlaceholder')"
      :data="templates"
      :columns="columns"
      :loading="loading"
      :statistics="statistics"
      :stats-config="statsConfig"
      :pagination="listPagination"
      table-id="templates-table"
      row-key="_id"
      :empty-title="t('templates.emptyTitle')"
      :empty-message="t('templates.emptyMessage')"
      :show-import="false"
      :show-export="false"
      :show-create="canCreate"
      @create="showCreateDrawer = true"
      @update:search-query="onSearchChange"
      @update:pagination="onPaginationChange"
      @stat-click="onStatClick"
      @fetch="loadTemplates"
      @row-click="openTemplate"
      @delete="handleDelete"
      @bulk-action="handleBulkAction"
    >
      <template #cell-status="{ value }">
        <BadgeCell
          :value="formatStatus(value)"
          :variant-map="statusVariantMap"
        />
      </template>

      <template #cell-outputFormat="{ value }">
        <span class="text-xs font-medium text-gray-600 dark:text-gray-300">{{ formatTypeLabel(value) }}</span>
      </template>

      <template #cell-paperSize="{ value, row }">
        <span class="text-xs text-gray-600 dark:text-gray-300">{{ formatPaperSize(row) }}</span>
      </template>

      <template #cell-orientation="{ value, row }">
        <span class="text-xs text-gray-600 dark:text-gray-300">{{ formatOrientation(row) }}</span>
      </template>

      <template #cell-latestPublishedVersion="{ value, row }">
        <span>{{ publishedVersionLabel(row, value) }}</span>
      </template>

      <template #cell-updatedAt="{ value }">
        <span>{{ formatDate(value) }}</span>
      </template>
    </ListView>

    <CreateTemplateDrawer
      :is-open="showCreateDrawer"
      @close="showCreateDrawer = false"
      @create="handleCreate"
      @import-html="handleImportHtmlStart"
    />

    <HtmlImportWizard
      :open="showImportWizard"
      :initial-name="importMetadata.name || ''"
      :initial-metadata="importMetadata"
      @close="showImportWizard = false"
      @import="handleImportHtmlComplete"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import ListView from '@/components/common/ListView.vue';
import BadgeCell from '@/components/common/table/BadgeCell.vue';
import TemplatesModuleNav from '@/components/templates/TemplatesModuleNav.vue';
import CreateTemplateDrawer from '@/components/templates/CreateTemplateDrawer.vue';
import HtmlImportWizard from '@/modules/template/components/html/HtmlImportWizard.vue';
import { useTemplates } from '@/composables/useTemplates';
import { useAuthStore } from '@/stores/authRegistry';
import { useNotifications } from '@/composables/useNotifications';
import { openRecordInTab } from '@/utils/tabNavigation';

const { t } = useI18n();
const authStore = useAuthStore();
const notifications = useNotifications();

const {
  templates,
  loading,
  summary,
  pagination,
  fetchTemplates,
  fetchTemplateSummary,
  createTemplate,
  deleteTemplate
} = useTemplates();

const showCreateDrawer = ref(false);
const showImportWizard = ref(false);
const importMetadata = ref({});
const searchQuery = ref('');
const statusFilter = ref('');

const canCreate = computed(() => authStore.can('templates', 'create'));

const listDescription = computed(() => {
  if (!statusFilter.value) return t('templates.listDescription');
  return t('templates.listDescriptionFiltered', { status: formatStatus(statusFilter.value) });
});

const statistics = computed(() => ({
  total: summary.value?.total ?? 0,
  draft: summary.value?.draft ?? 0,
  published: summary.value?.published ?? 0,
  review: summary.value?.review ?? 0,
  archived: summary.value?.archived ?? 0
}));

const statsConfig = computed(() => [
  { name: t('templates.dashboardStatTotal'), key: 'total', formatter: 'number' },
  { name: t('templates.dashboardStatDraft'), key: 'draft', formatter: 'number' },
  { name: t('templates.dashboardStatPublished'), key: 'published', formatter: 'number' },
  { name: t('templates.dashboardStatReview'), key: 'review', formatter: 'number' },
  { name: t('templates.dashboardStatArchived'), key: 'archived', formatter: 'number' }
]);

const columns = computed(() => [
  { key: 'name', label: t('templates.colName'), sortable: true },
  { key: 'moduleScope', label: t('templates.colModuleScope'), sortable: true },
  { key: 'status', label: t('templates.colStatus'), sortable: true },
  { key: 'outputFormat', label: t('templates.colType'), sortable: true },
  { key: 'paperSize', label: t('templates.colSize'), sortable: true },
  { key: 'orientation', label: t('templates.colOrientation'), sortable: true },
  { key: 'latestPublishedVersion', label: t('templates.colVersion'), sortable: false },
  { key: 'updatedAt', label: t('templates.colUpdated'), sortable: true }
]);

const statusVariantMap = {
  draft: 'warning',
  published: 'success',
  archived: 'default',
  review: 'info',
  approved: 'primary',
  deprecated: 'default'
};

const listPagination = computed(() => ({
  currentPage: pagination.currentPage,
  totalPages: pagination.totalPages,
  totalRecords: pagination.total,
  limit: pagination.limit
}));

function formatStatus(value) {
  if (!value) return 'draft';
  return String(value).charAt(0).toUpperCase() + String(value).slice(1);
}

function isPrintTemplate(row) {
  return String(row?.outputFormat || 'pdf').toLowerCase() !== 'email';
}

function formatTypeLabel(value) {
  return String(value || 'pdf').toLowerCase() === 'email'
    ? t('templates.typeEmailTemplate')
    : t('templates.typePrintTemplate');
}

function formatPaperSize(row) {
  if (!isPrintTemplate(row)) return '—';
  const size = String(row?.paperSize || 'A4');
  if (size === 'Custom') {
    const w = row?.customPageWidth;
    const h = row?.customPageHeight;
    if (w && h) return `${w}×${h} mm`;
    return t('templates.builderPageCustom');
  }
  return size;
}

function formatOrientation(row) {
  if (!isPrintTemplate(row)) return '—';
  return row?.orientation === 'landscape'
    ? t('templates.builderPageOrientationLandscape')
    : t('templates.builderPageOrientationPortrait');
}

function publishedVersionLabel(row, value) {
  if (value) return `v${value}`;
  if (row?.latestVersion) return `v${row.latestVersion} (${formatStatus(row.status)})`;
  return '—';
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

async function loadTemplates() {
  await fetchTemplates({
    page: pagination.currentPage,
    limit: pagination.limit,
    search: searchQuery.value,
    status: statusFilter.value || undefined
  });
}

async function refreshPage() {
  await Promise.all([fetchTemplateSummary(), loadTemplates()]);
}

function onSearchChange(query) {
  searchQuery.value = String(query || '').trim();
  pagination.currentPage = 1;
  loadTemplates();
}

function onPaginationChange(next) {
  pagination.currentPage = next.currentPage || 1;
  pagination.limit = next.limit || pagination.limit;
  loadTemplates();
}

function onStatClick(statItem) {
  const statusMap = {
    total: '',
    draft: 'draft',
    published: 'published',
    review: 'review',
    archived: 'archived'
  };
  statusFilter.value = statusMap[statItem?.key] ?? '';
  pagination.currentPage = 1;
  loadTemplates();
}

function openTemplate(row) {
  const id = row?._id || row?.id;
  if (!id) return;
  const name = String(row?.name || '').trim() || t('templates.detailTitle');
  openRecordInTab(`/templates/${id}`, {
    title: name,
    icon: 'document-text',
    params: { id, name },
    name: `template-detail-${id}`
  });
}

function openTemplateBuilder(created, fallbackName = '') {
  const id = created?._id || created?.id;
  if (!id) return;
  const name = String(created?.name || fallbackName || '').trim() || t('templates.detailTitle');
  openRecordInTab(`/templates/${id}/builder`, {
    title: name,
    icon: 'document-text',
    params: { id, name },
    name: `template-builder-${id}`
  });
}

async function handleCreate(payload) {
  try {
    const created = await createTemplate(payload);
    showCreateDrawer.value = false;
    notifications.success(t('templates.createSuccess'));
    await refreshPage();
    openTemplateBuilder(created, payload?.name);
  } catch (error) {
    notifications.error(error?.message || t('templates.loadFailed'));
  }
}

function handleImportHtmlStart(metadata) {
  importMetadata.value = { ...metadata };
  showCreateDrawer.value = false;
  showImportWizard.value = true;
}

async function handleDelete(row) {
  const id = row?._id || row?.id;
  if (!id) return;
  try {
    await deleteTemplate(id);
    notifications.success(t('templates.deleteSuccess'));
    await refreshPage();
  } catch (error) {
    notifications.error(error?.message || t('templates.deleteFailed'));
  }
}

function resolveBulkDeleteIds(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) {
    return payload.map((row) => row?._id || row?.id).filter(Boolean);
  }
  if (Array.isArray(payload.selectedIds) && payload.selectedIds.length) {
    return payload.selectedIds;
  }
  return [];
}

async function handleBulkAction(actionId, payload) {
  if (actionId !== 'bulk-delete' && actionId !== 'delete') return;
  const ids = resolveBulkDeleteIds(payload);
  if (!ids.length) return;

  try {
    const results = await Promise.allSettled(ids.map((id) => deleteTemplate(id)));
    const failed = results.filter((result) => result.status === 'rejected').length;
    if (failed > 0) {
      notifications.error(t('templates.deleteFailed'));
    } else {
      notifications.success(t('templates.deleteSuccess'));
    }
    await refreshPage();
  } catch (error) {
    notifications.error(error?.message || t('templates.deleteFailed'));
  }
}

async function handleImportHtmlComplete(payload) {
  if (!String(payload?.name || '').trim()) {
    notifications.error(t('templates.htmlImport.errorNameRequired'));
    return;
  }
  try {
    const created = await createTemplate(payload);
    showImportWizard.value = false;
    notifications.success(t('templates.htmlImport.createSuccess'));
    await refreshPage();
    openTemplateBuilder(created, payload?.name);
  } catch (error) {
    const details = error?.response?.data?.details;
    const detailMessage = Array.isArray(details) && details.length
      ? details.map((item) => item?.message).filter(Boolean).join(' ')
      : '';
    notifications.error(
      detailMessage || error?.message || t('templates.htmlImport.errorAnalyzeFailed')
    );
  }
}

onMounted(() => {
  refreshPage();
});
</script>
