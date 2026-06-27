<template>
  <ListView
    ref="listViewRef"
    skip-mount-fetch
    :title="title"
    module-key="documents"
    :search-placeholder="searchPlaceholder"
    :data="data"
    :columns="columns"
    :loading="loading"
    :pagination="pagination"
    :table-id="tableId"
    row-key="_id"
    :empty-title="emptyTitle"
    :empty-message="emptyMessage"
    :show-create="false"
    :show-import="false"
    :show-export="false"
    :show-stats="false"
    :hide-page-header="hidePageHeader"
    :hide-search-toolbar="!showSearchToolbar"
    :parent-search-query="parentSearchQuery"
    :saved-views="savedViews"
    :active-saved-view-id="activeSavedViewId"
    :default-view-id="defaultViewId"
    :external-filters="externalFilters"
    @row-click="(row, event) => emit('row-click', row, event)"
    @edit="(row) => emit('edit', row)"
    @delete="(row) => emit('delete', row)"
    @update:search-query="(q) => emit('update:search-query', q)"
    @update:filters="(filters) => emit('update:filters', filters)"
    @update:pagination="(p) => emit('update:pagination', p)"
    @fetch="emit('fetch')"
    @search-submit="(q) => emit('search-submit', q)"
    @saved-view-selected="(view) => emit('saved-view-selected', view)"
    @saved-views-updated="(views) => emit('saved-views-updated', views)"
    @set-default-view="(viewId) => emit('set-default-view', viewId)"
  >
    <template v-if="activeFilterChips.length" #active-filters>
      <div
        class="mb-4 inline-flex min-w-0 flex-wrap items-center gap-2"
        role="region"
        :aria-label="t('common.listActiveFiltersRegion')"
      >
        <span
          v-for="chip in activeFilterChips"
          :key="chip.id"
          class="inline-flex max-w-full items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 py-1 pl-2.5 pr-1 text-xs font-medium text-indigo-800 dark:border-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-200"
        >
          <span class="truncate">{{ chip.label }}</span>
          <button
            type="button"
            class="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-indigo-600 transition-colors hover:bg-indigo-100 hover:text-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-900/50"
            :aria-label="t('common.listActiveFilterRemove', { label: chip.label })"
            @click="emit('remove-active-filter', chip.id)"
          >
            <XMarkIcon class="h-3.5 w-3.5" />
          </button>
        </span>
        <button
          type="button"
          class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          @click="emit('clear-active-filters')"
        >
          {{ t('common.listActiveFiltersClearAll') }}
        </button>
      </div>
    </template>

    <template #cell-title="{ row, value }">
      <div class="flex min-w-0 items-center gap-2">
        <DocumentTypeIcon :doc="row" />
        <span class="min-w-0 flex-1 truncate font-medium text-gray-900 dark:text-white">{{ value }}</span>
        <span
          v-if="row.documentType === 'external_link' && row.externalLinkStatus === 'unavailable'"
          class="shrink-0 rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300"
        >
          {{ t('documents.externalLinkBrokenBadge') }}
        </span>
        <button
          type="button"
          class="shrink-0 rounded p-0.5 text-gray-300 hover:text-amber-500"
          :class="isFavorite(row._id) ? 'text-amber-500' : ''"
          :title="isFavorite(row._id) ? t('documents.unfavorite') : t('documents.favorite')"
          @click="emit('toggle-favorite', row, $event)"
        >
          <StarIconSolid v-if="isFavorite(row._id)" class="h-4 w-4" />
          <StarIcon v-else class="h-4 w-4" />
        </button>
      </div>
    </template>

    <template #cell-documentType="{ value }">
      <BadgeCell :value="formatDocumentType(value)" variant="default" />
    </template>

    <template #cell-folderId="{ row }">
      <div class="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
        <FolderIcon class="h-4 w-4 text-gray-400" />
        <span>{{ row.folderName || '—' }}</span>
      </div>
    </template>

    <template #cell-status="{ value }">
      <BadgeCell :value="formatStatus(value)" :variant-map="statusVariantMap" />
    </template>

    <template #cell-versionNumber="{ value }">
      <span class="text-sm text-gray-600 dark:text-gray-300">{{ formatVersion(value) }}</span>
    </template>

    <template #cell-ownerId="{ row }">
      <span class="text-sm text-gray-700 dark:text-gray-300">{{ formatOwner(row) }}</span>
    </template>

    <template #cell-tags="{ row }">
      <div class="flex flex-wrap gap-1">
        <span
          v-for="tag in (row.tags || []).slice(0, 3)"
          :key="tag"
          class="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300"
        >
          #{{ tag }}
        </span>
      </div>
    </template>

    <template #cell-updatedAt="{ value }">
      <span class="text-sm text-gray-600 dark:text-gray-300">{{ formatDate(value) }}</span>
    </template>
  </ListView>
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { FolderIcon, StarIcon } from '@heroicons/vue/24/outline';
import { XMarkIcon } from '@heroicons/vue/20/solid';
import { StarIcon as StarIconSolid } from '@heroicons/vue/24/solid';
import ListView from '@/components/common/ListView.vue';
import BadgeCell from '@/components/common/table/BadgeCell.vue';
import DocumentTypeIcon from '@/components/documents/DocumentTypeIcon.vue';

defineProps({
  title: { type: String, required: true },
  searchPlaceholder: { type: String, required: true },
  data: { type: Array, default: () => [] },
  columns: { type: Array, required: true },
  loading: { type: Boolean, default: false },
  pagination: { type: Object, required: true },
  tableId: { type: String, required: true },
  emptyTitle: { type: String, required: true },
  emptyMessage: { type: String, required: true },
  parentSearchQuery: { type: String, default: '' },
  hidePageHeader: { type: Boolean, default: false },
  showSearchToolbar: { type: Boolean, default: false },
  savedViews: { type: Array, default: () => [] },
  activeSavedViewId: { type: String, default: null },
  defaultViewId: { type: String, default: null },
  externalFilters: { type: Object, default: () => ({}) },
  activeFilterChips: { type: Array, default: () => [] },
  isFavorite: { type: Function, required: true },
  formatDocumentType: { type: Function, required: true },
  formatStatus: { type: Function, required: true },
  formatOwner: { type: Function, required: true },
  formatDate: { type: Function, required: true },
  formatVersion: { type: Function, required: true },
  statusVariantMap: { type: Object, required: true }
});

const emit = defineEmits([
  'row-click',
  'edit',
  'delete',
  'fetch',
  'update:pagination',
  'update:search-query',
  'update:filters',
  'search-submit',
  'toggle-favorite',
  'saved-view-selected',
  'saved-views-updated',
  'set-default-view',
  'remove-active-filter',
  'clear-active-filters'
]);

const { t } = useI18n();
const listViewRef = ref(null);

defineExpose({
  openCustomize: () => listViewRef.value?.openCustomize?.()
});
</script>
