<template>
  <div class="document-folder-browse flex min-h-[28rem] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
    <section v-if="childFolders.length" class="border-b border-gray-200 px-5 py-4 dark:border-gray-700">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('documents.foldersTitle') }}</h3>
      <div class="mt-3 grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-3">
        <button
          v-for="folder in childFolders"
          :key="folder._id"
          type="button"
          class="rounded-lg border border-gray-200 bg-white px-3 py-3 text-left transition hover:border-indigo-300 hover:bg-indigo-50/40 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-indigo-600 dark:hover:bg-indigo-950/20"
          @click="emit('select-folder', String(folder._id))"
        >
          <div class="flex items-start gap-2.5">
            <FolderIcon class="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <div class="min-w-0">
              <p class="truncate text-sm font-medium text-gray-900 dark:text-white">{{ folder.name }}</p>
              <p class="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                {{ t('documents.folderBrowseDateLabel', { date: formatFolderDate(folder.updatedAt || folder.createdAt) }) }}
              </p>
            </div>
          </div>
        </button>
      </div>
    </section>

    <section class="flex min-h-0 flex-1 flex-col">
      <div class="border-b border-gray-200 px-5 py-3 dark:border-gray-700">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('documents.folderBrowseAllFiles') }}</h3>
      </div>
      <div class="min-h-0 flex-1 overflow-hidden">
        <DocumentsListView
          ref="listViewRef"
          hide-page-header
          :show-search-toolbar="showSearchToolbar"
          :title="listTitle"
          :search-placeholder="searchPlaceholder"
          :data="documents"
          :columns="columns"
          :loading="loading"
          :pagination="pagination"
          :table-id="tableId"
          :empty-title="emptyTitle"
          :empty-message="emptyMessage"
          :parent-search-query="parentSearchQuery"
          :external-filters="externalFilters"
          :active-filter-chips="activeFilterChips"
          :is-favorite="isFavorite"
          :format-document-type="formatDocumentType"
          :format-status="formatStatus"
          :format-owner="formatOwner"
          :format-date="formatDate"
          :format-version="formatVersion"
          :status-variant-map="statusVariantMap"
          @row-click="(row, event) => emit('row-click', row, event)"
          @edit="(row) => emit('edit', row)"
          @delete="(row) => emit('delete', row)"
          @fetch="emit('fetch')"
          @update:pagination="(p) => emit('update:pagination', p)"
          @update:search-query="(q) => emit('update:search-query', q)"
          @search-submit="(q) => emit('search-submit', q)"
          @update:filters="(filters) => emit('update:filters', filters)"
          @toggle-favorite="(row, event) => emit('toggle-favorite', row, event)"
          @remove-active-filter="(id) => emit('remove-active-filter', id)"
          @clear-active-filters="emit('clear-active-filters')"
        />
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { FolderIcon } from '@heroicons/vue/24/outline';
import DocumentsListView from '@/components/documents/DocumentsListView.vue';

const props = defineProps({
  folders: { type: Array, default: () => [] },
  documents: { type: Array, default: () => [] },
  selectedFolderId: { type: String, default: 'root' },
  loading: { type: Boolean, default: false },
  listTitle: { type: String, required: true },
  searchPlaceholder: { type: String, required: true },
  columns: { type: Array, required: true },
  pagination: { type: Object, required: true },
  tableId: { type: String, required: true },
  emptyTitle: { type: String, required: true },
  emptyMessage: { type: String, required: true },
  parentSearchQuery: { type: String, default: '' },
  showSearchToolbar: { type: Boolean, default: false },
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
  'select-folder',
  'row-click',
  'edit',
  'delete',
  'fetch',
  'update:pagination',
  'update:search-query',
  'search-submit',
  'update:filters',
  'toggle-favorite',
  'remove-active-filter',
  'clear-active-filters'
]);

const { t } = useI18n();
const listViewRef = ref(null);

const parentKey = computed(() => (
  props.selectedFolderId && props.selectedFolderId !== 'root' ? props.selectedFolderId : 'root'
));

const childFolders = computed(() => {
  const rows = props.folders.filter((folder) => {
    const parent = folder.parentFolderId ? String(folder.parentFolderId) : 'root';
    return parent === parentKey.value;
  });
  return rows.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
});

function formatFolderDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

defineExpose({
  openCustomize: () => listViewRef.value?.openCustomize?.()
});
</script>
