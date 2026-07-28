<template>
  <div class="mx-auto w-full px-6 py-8">
    <div class="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">
          {{ t('marketing.assetsListTitle') }}
        </h1>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {{ t('marketing.assetsListDescription') }}
        </p>
      </div>

      <label
        v-if="canCreate"
        class="inline-flex cursor-pointer items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
      >
        <input type="file" accept="image/*" class="hidden" @change="onUpload" />
        {{ uploadBusy ? t('states.saving') : t('marketing.assetsUpload') }}
      </label>
    </div>

    <div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
      <input
        v-model="searchQuery"
        type="search"
        :placeholder="t('marketing.assetsSearchPlaceholder')"
        class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white sm:max-w-md"
        @keyup.enter="loadAssets(1)"
      />
      <button
        type="button"
        class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
        @click="loadAssets(1)"
      >
        {{ t('actions.search') }}
      </button>
    </div>

    <div v-if="loading" class="py-16 text-center text-sm text-gray-500">
      {{ t('states.loading') }}
    </div>

    <div
      v-else-if="!imageAssets.length"
      class="rounded-xl border border-dashed border-gray-300 px-6 py-16 text-center dark:border-gray-700"
    >
      <p class="text-base font-medium text-gray-900 dark:text-white">{{ emptyTitle }}</p>
      <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">{{ emptyMessage }}</p>
    </div>

    <div v-else class="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
      <div
        v-for="asset in imageAssets"
        :key="asset._id || asset.assetId"
        class="group relative overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
      >
        <img
          :src="assetImageUrl(asset.downloadUrl)"
          :alt="asset.accessibilityAltText || asset.filename"
          class="aspect-square w-full object-cover"
        />
        <div class="border-t border-gray-200 px-3 py-2 dark:border-gray-700">
          <p class="truncate text-sm font-medium text-gray-900 dark:text-white">{{ asset.filename }}</p>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            {{ formatDimensions(asset) }}
          </p>
        </div>
        <button
          v-if="canDelete"
          type="button"
          class="absolute right-2 top-2 rounded-md bg-black/60 px-2 py-1 text-xs text-white opacity-0 transition group-hover:opacity-100"
          @click="confirmDelete(asset)"
        >
          {{ t('actions.delete') }}
        </button>
      </div>
    </div>

    <div
      v-if="pagination.totalPages > 1"
      class="mt-8 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400"
    >
      <span>{{ t('marketing.assetsPagination', { page: pagination.currentPage, total: pagination.totalPages }) }}</span>
      <div class="flex gap-2">
        <button
          type="button"
          class="rounded-lg border border-gray-300 px-3 py-1.5 disabled:opacity-50 dark:border-gray-600"
          :disabled="pagination.currentPage <= 1"
          @click="loadAssets(pagination.currentPage - 1)"
        >
          {{ t('actions.previous') }}
        </button>
        <button
          type="button"
          class="rounded-lg border border-gray-300 px-3 py-1.5 disabled:opacity-50 dark:border-gray-600"
          :disabled="pagination.currentPage >= pagination.totalPages"
          @click="loadAssets(pagination.currentPage + 1)"
        >
          {{ t('actions.next') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/authRegistry';
import { useMarketingAssets } from '@/composables/useMarketingAssets';
import { useNotifications } from '@/composables/useNotifications';
import { getApiUrlForFetch } from '@/config/apiBase';
import { captureMarketingAssetDeleted, captureMarketingAssetUploaded, captureMarketingModuleVisited } from '@/config/posthogMarketing';

import { confirmAction } from '@/composables/useConfirmAction';
const { t } = useI18n();
const authStore = useAuthStore();
const notifications = useNotifications();
const searchQuery = ref('');
const uploadBusy = ref(false);
const { assets, loading, pagination, fetchAssets, uploadAsset, deleteAsset } = useMarketingAssets();

const canCreate = computed(() => authStore.can('assets', 'create'));
const canDelete = computed(() => authStore.can('assets', 'delete'));

const imageAssets = computed(() =>
  assets.value.filter((asset) => String(asset.mimeType || '').startsWith('image/'))
);

const emptyTitle = computed(() =>
  searchQuery.value.trim()
    ? t('marketing.assetsNoResultsTitle')
    : t('marketing.assetsEmptyTitle')
);

const emptyMessage = computed(() =>
  searchQuery.value.trim()
    ? t('marketing.assetsNoResultsMessage')
    : t('marketing.assetsEmptyMessage')
);

function assetImageUrl(downloadUrl) {
  if (!downloadUrl) return '';
  if (downloadUrl.startsWith('http')) return downloadUrl;
  return getApiUrlForFetch(downloadUrl);
}

function formatDimensions(asset) {
  if (asset.width && asset.height) {
    return `${asset.width} × ${asset.height}`;
  }
  return String(asset.type || 'image');
}

async function loadAssets(page = pagination.currentPage) {
  await fetchAssets({
    page,
    limit: pagination.limit,
    type: 'image',
    search: searchQuery.value.trim() || undefined
  });
}

async function onUpload(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;

  uploadBusy.value = true;
  try {
    await uploadAsset(file, {
      type: 'image',
      accessibilityAltText: file.name
    });
    captureMarketingAssetUploaded({ mime_type: file.type });
    notifications.success(t('marketing.assetsUploadSuccess'));
    await loadAssets(1);
  } catch (error) {
    notifications.error(error?.message || t('marketing.assetsUploadFailed'));
  } finally {
    uploadBusy.value = false;
  }
}

async function confirmDelete(asset) {
  const id = asset._id || asset.assetId;
  if (!id) return;
  if (!await confirmAction(t('marketing.assetsDeleteConfirm'))) return;

  try {
    await deleteAsset(id);
    captureMarketingAssetDeleted({ asset_id: id });
    notifications.success(t('marketing.assetsDeleteSuccess'));
    await loadAssets();
  } catch (error) {
    notifications.error(error?.message || t('marketing.assetsDeleteFailed'));
  }
}

onMounted(() => {
  captureMarketingModuleVisited('assets', { route: '/marketing/assets' });
  void loadAssets();
});
</script>
