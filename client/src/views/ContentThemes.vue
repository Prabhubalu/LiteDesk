<template>
  <div class="mx-auto w-full">
    <TemplatesModuleNav />

    <ListView
      :title="t('templates.themesListTitle')"
      :description="t('templates.themesListDescription')"
      module-key="templates"
      :create-label="t('templates.newTheme')"
      :search-placeholder="t('templates.themesSearchPlaceholder')"
      :data="themes"
      :columns="columns"
      :loading="loading"
      :pagination="listPagination"
      table-id="content-themes-table"
      row-key="_id"
      :empty-title="t('templates.themesEmptyTitle')"
      :empty-message="t('templates.themesEmptyMessage')"
      :show-import="false"
      :show-export="false"
      :show-create="canCreate"
      @create="showCreateDrawer = true"
      @update:search-query="onSearchChange"
      @update:pagination="onPaginationChange"
      @fetch="loadThemes"
      @row-click="openTheme"
    >
      <template #cell-status="{ value }">
        <BadgeCell :value="formatStatus(value)" :variant-map="statusVariantMap" />
      </template>

      <template #cell-colors="{ row }">
        <div class="flex items-center gap-1">
          <span
            v-for="colorKey in colorPreviewKeys"
            :key="colorKey"
            class="h-4 w-4 rounded-full border border-gray-200 dark:border-gray-600"
            :style="{ backgroundColor: row.colors?.[colorKey] || '#e5e7eb' }"
            :title="colorKey"
          />
        </div>
      </template>

      <template #cell-updatedAt="{ value }">
        <span>{{ formatDate(value) }}</span>
      </template>
    </ListView>

    <CreateThemeDrawer
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
import CreateThemeDrawer from '@/components/templates/CreateThemeDrawer.vue';
import { useContentThemes } from '@/composables/useContentThemes';
import { useAuthStore } from '@/stores/authRegistry';
import { useNotifications } from '@/composables/useNotifications';

const { t } = useI18n();
const router = useRouter();
const authStore = useAuthStore();
const notifications = useNotifications();

const { themes, loading, pagination, fetchThemes, createTheme } = useContentThemes();

const showCreateDrawer = ref(false);
const searchQuery = ref('');
const colorPreviewKeys = ['primary', 'secondary', 'text', 'background'];

const canCreate = computed(() => authStore.can('templates', 'create'));

const columns = computed(() => [
  { key: 'name', label: t('templates.colName'), sortable: true },
  { key: 'status', label: t('templates.colStatus'), sortable: true },
  { key: 'colors', label: t('templates.themeColColors'), sortable: false },
  { key: 'latestVersion', label: t('templates.colVersion'), sortable: false },
  { key: 'updatedAt', label: t('templates.colUpdated'), sortable: true }
]);

const statusVariantMap = {
  draft: 'warning',
  published: 'success',
  archived: 'default'
};

const listPagination = computed(() => ({
  currentPage: pagination.currentPage,
  totalPages: pagination.totalPages,
  totalRecords: pagination.total,
  limit: pagination.limit
}));

function formatStatus(value) {
  if (!value) return 'Draft';
  return String(value).charAt(0).toUpperCase() + String(value).slice(1);
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

async function loadThemes() {
  await fetchThemes({
    page: pagination.currentPage,
    limit: pagination.limit,
    search: searchQuery.value
  });
}

function onSearchChange(query) {
  searchQuery.value = String(query || '').trim();
  pagination.currentPage = 1;
  loadThemes();
}

function onPaginationChange(next) {
  pagination.currentPage = next.currentPage || 1;
  pagination.limit = next.limit || pagination.limit;
  loadThemes();
}

function openTheme(row) {
  const id = row?._id || row?.id;
  if (!id) return;
  router.push({ name: 'content-theme-detail', params: { id } });
}

async function handleCreate(payload) {
  try {
    const created = await createTheme(payload);
    showCreateDrawer.value = false;
    notifications.success(t('templates.themeCreateSuccess'));
    await loadThemes();
    const id = created?._id || created?.id;
    if (id) {
      router.push({ name: 'content-theme-detail', params: { id } });
    }
  } catch (error) {
    notifications.error(error?.message || t('templates.themeLoadFailed'));
  }
}

onMounted(() => {
  loadThemes();
});
</script>
