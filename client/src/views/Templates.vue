<template>
  <div class="mx-auto w-full">
    <TemplatesModuleNav />

    <TemplatesDashboardPanel
      :summary="summary"
      :loading="summaryLoading"
      :can-create="canCreate"
      :active-status="statusFilter"
      @create="showCreateDrawer = true"
      @open="openTemplate"
      @filter-status="onStatusFilter"
    />

    <ListView
      :title="t('templates.listTitle')"
      :description="listDescription"
      module-key="templates"
      :create-label="t('templates.newTemplate')"
      :search-placeholder="t('templates.searchPlaceholder')"
      :data="templates"
      :columns="columns"
      :loading="loading"
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
      @fetch="loadTemplates"
      @row-click="openTemplate"
    >
      <template #cell-status="{ value }">
        <BadgeCell
          :value="formatStatus(value)"
          :variant-map="statusVariantMap"
        />
      </template>

      <template #cell-outputFormat="{ value }">
        <span class="uppercase text-xs font-medium text-gray-600 dark:text-gray-300">{{ value || 'pdf' }}</span>
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
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import ListView from '@/components/common/ListView.vue';
import BadgeCell from '@/components/common/table/BadgeCell.vue';
import TemplatesModuleNav from '@/components/templates/TemplatesModuleNav.vue';
import TemplatesDashboardPanel from '@/components/templates/TemplatesDashboardPanel.vue';
import CreateTemplateDrawer from '@/components/templates/CreateTemplateDrawer.vue';
import { useTemplates } from '@/composables/useTemplates';
import { useAuthStore } from '@/stores/authRegistry';
import { useNotifications } from '@/composables/useNotifications';

const { t } = useI18n();
const router = useRouter();
const authStore = useAuthStore();
const notifications = useNotifications();

const {
  templates,
  loading,
  summary,
  summaryLoading,
  pagination,
  fetchTemplates,
  fetchTemplateSummary,
  createTemplate
} = useTemplates();

const showCreateDrawer = ref(false);
const searchQuery = ref('');
const statusFilter = ref('');

const canCreate = computed(() => authStore.can('templates', 'create'));

const listDescription = computed(() => {
  if (!statusFilter.value) return t('templates.listDescription');
  return t('templates.listDescriptionFiltered', { status: formatStatus(statusFilter.value) });
});

const columns = computed(() => [
  { key: 'name', label: t('templates.colName'), sortable: true },
  { key: 'purpose', label: t('templates.colPurpose'), sortable: true },
  { key: 'moduleScope', label: t('templates.colModuleScope'), sortable: true },
  { key: 'status', label: t('templates.colStatus'), sortable: true },
  { key: 'outputFormat', label: t('templates.colOutputFormat'), sortable: true },
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

function onStatusFilter(status) {
  statusFilter.value = status || '';
  pagination.currentPage = 1;
  loadTemplates();
}

function openTemplate(row) {
  const id = row?._id || row?.id;
  if (!id) return;
  router.push({ name: 'template-detail', params: { id } });
}

async function handleCreate(payload) {
  try {
    const created = await createTemplate(payload);
    showCreateDrawer.value = false;
    notifications.success(t('templates.createSuccess'));
    await refreshPage();
    const id = created?._id || created?.id;
    if (id) {
      const openBuilder = Boolean(payload?.jsonDefinition);
      router.push(
        openBuilder
          ? { name: 'template-builder', params: { id } }
          : { name: 'template-detail', params: { id } }
      );
    }
  } catch (error) {
    notifications.error(error?.message || t('templates.loadFailed'));
  }
}

onMounted(() => {
  refreshPage();
});
</script>
