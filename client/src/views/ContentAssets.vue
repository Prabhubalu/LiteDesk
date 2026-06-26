<template>
  <div class="mx-auto w-full">
    <TemplatesModuleNav />

    <input
      ref="fileInputRef"
      type="file"
      accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
      class="hidden"
      @change="handleFileSelected"
    />

    <ListView
      :title="t('templates.assetsListTitle')"
      :description="t('templates.assetsListDescription')"
      module-key="templates"
      :create-label="t('templates.uploadAsset')"
      :search-placeholder="t('templates.assetsSearchPlaceholder')"
      :data="assets"
      :columns="columns"
      :loading="loading"
      :pagination="listPagination"
      table-id="content-assets-table"
      row-key="_id"
      :empty-title="t('templates.assetsEmptyTitle')"
      :empty-message="t('templates.assetsEmptyMessage')"
      :show-import="false"
      :show-export="false"
      :show-create="canUpload"
      @create="triggerUpload"
      @update:search-query="onSearchChange"
      @update:pagination="onPaginationChange"
      @fetch="loadAssets"
    >
        <img
          v-if="row.downloadUrl && isImageMime(row.mimeType)"
          :src="assetImageUrl(row.downloadUrl)"
          :alt="row.accessibilityAltText || row.filename"
          class="h-10 w-10 rounded object-cover border border-gray-200 dark:border-gray-700"
        />
        <span v-else class="text-xs text-gray-400">—</span>
      </template>

      <template #cell-type="{ value }">
        <span class="capitalize text-xs">{{ value || 'image' }}</span>
      </template>

      <template #cell-dimensions="{ row }">
        <span>{{ formatDimensions(row) }}</span>
      </template>

      <template #cell-updatedAt="{ value }">
        <span>{{ formatDate(value) }}</span>
      </template>

      <template #cell-actions="{ row }">
        <button
          v-if="canDelete"
          type="button"
          class="text-sm text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
          :disabled="deletingId === row._id"
          @click.stop="handleDelete(row)"
        >
          {{ deletingId === row._id ? t('states.loading') : t('actions.delete') }}
        </button>
      </template>
    </ListView>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import ListView from '@/components/common/ListView.vue';
import TemplatesModuleNav from '@/components/templates/TemplatesModuleNav.vue';
import { useContentAssets } from '@/composables/useContentAssets';
import { getApiUrlForFetch } from '@/config/apiBase';
import { useAuthStore } from '@/stores/authRegistry';
import { useNotifications } from '@/composables/useNotifications';

const { t } = useI18n();
const authStore = useAuthStore();
const notifications = useNotifications();

const { assets, loading, pagination, fetchAssets, uploadAsset, deleteAsset } = useContentAssets();

const fileInputRef = ref(null);
const searchQuery = ref('');
const deletingId = ref(null);
const uploading = ref(false);

const canUpload = computed(() => authStore.can('templates', 'create'));
const canDelete = computed(() => authStore.can('templates', 'delete'));

const columns = computed(() => [
  { key: 'preview', label: t('templates.assetsColPreview'), sortable: false },
  { key: 'filename', label: t('templates.assetsColFilename'), sortable: true },
  { key: 'type', label: t('templates.assetsColType'), sortable: true },
  { key: 'dimensions', label: t('templates.assetsColDimensions'), sortable: false },
  { key: 'updatedAt', label: t('templates.colUpdated'), sortable: true },
  { key: 'actions', label: t('templates.assetsColActions'), sortable: false }
]);

const listPagination = computed(() => ({
  currentPage: pagination.currentPage,
  totalPages: pagination.totalPages,
  totalRecords: pagination.total,
  limit: pagination.limit
}));

function isImageMime(mimeType) {
  return String(mimeType || '').startsWith('image/');
}

function assetImageUrl(path) {
  return getApiUrlForFetch(path);
}

function formatDimensions(row) {
  if (row?.width && row?.height) return `${row.width}×${row.height}`;
  return '—';
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

async function loadAssets() {
  await fetchAssets({
    page: pagination.currentPage,
    limit: pagination.limit,
    search: searchQuery.value
  });
}

function onSearchChange(query) {
  searchQuery.value = String(query || '').trim();
  pagination.currentPage = 1;
  loadAssets();
}

function onPaginationChange(next) {
  pagination.currentPage = next.currentPage || 1;
  pagination.limit = next.limit || pagination.limit;
  loadAssets();
}

function triggerUpload() {
  fileInputRef.value?.click();
}

async function handleFileSelected(event) {
  const file = event.target?.files?.[0];
  event.target.value = '';
  if (!file || uploading.value) return;

  uploading.value = true;
  try {
    await uploadAsset(file);
    notifications.success(t('templates.assetUploadSuccess'));
    pagination.currentPage = 1;
    await loadAssets();
  } catch (error) {
    notifications.error(error?.message || t('templates.assetUploadFailed'));
  } finally {
    uploading.value = false;
  }
}

async function handleDelete(row) {
  const id = row?._id;
  if (!id || deletingId.value) return;

  deletingId.value = id;
  try {
    await deleteAsset(id);
    notifications.success(t('templates.assetDeleteSuccess'));
    await loadAssets();
  } catch (error) {
    notifications.error(error?.message || t('templates.assetDeleteFailed'));
  } finally {
    deletingId.value = null;
  }
}

onMounted(() => {
  loadAssets();
});
</script>
