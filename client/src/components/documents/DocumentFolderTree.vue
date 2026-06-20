<template>
  <div class="document-folder-tree flex h-full min-h-[28rem] flex-col rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
    <div class="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
      <div class="flex items-center justify-between gap-2">
        <h2 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('documents.foldersTitle') }}</h2>
        <button
          v-if="canCreate"
          type="button"
          class="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-indigo-600 dark:hover:bg-gray-800 dark:hover:text-indigo-400"
          :title="t('documents.newFolder')"
          :aria-label="t('documents.newFolder')"
          @click="startCreate('root')"
        >
          <FolderPlusIcon class="h-4 w-4" />
        </button>
      </div>
    </div>

    <div v-if="loading" class="space-y-2 p-3">
      <div v-for="n in 8" :key="n" class="h-7 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
    </div>

    <div v-else class="min-h-0 flex-1 overflow-y-auto p-2">
      <button
        type="button"
        class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/60"
        :class="selectedFolderId === 'root' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-200' : 'text-gray-800 dark:text-gray-200'"
        @click="emit('select-folder', 'root')"
      >
        <span class="h-6 w-6 shrink-0" aria-hidden="true" />
        <FolderIcon class="h-4 w-4 shrink-0 text-amber-500" />
        <span class="truncate font-medium">{{ t('documents.allDocuments') }}</span>
      </button>

      <DocumentFolderTreeNode
        v-for="folder in rootFolders"
        :key="folder._id"
        :folder="folder"
        :depth="0"
        :folders-by-parent="foldersByParent"
        :expanded-folder-ids="expandedFolderIds"
        :selected-folder-id="selectedFolderId"
        :creating-under="creatingUnder"
        :inline-folder-name="inlineFolderName"
        :can-create="canCreate"
        :can-delete="canDelete"
        :deleting-folder-id="deletingFolderId"
        @toggle-folder="toggleFolder"
        @select-folder="emit('select-folder', $event)"
        @start-create="startCreate"
        @submit-create="submitCreate"
        @cancel-create="cancelCreate"
        @delete-folder="emit('delete-folder', $event)"
        @update:inline-folder-name="inlineFolderName = $event"
      />

      <div
        v-if="creatingUnder === 'root'"
        class="flex items-center gap-2 py-1 pr-2 pl-2"
      >
        <span class="h-6 w-6 shrink-0" aria-hidden="true" />
        <FolderIcon class="h-4 w-4 shrink-0 text-amber-500" />
        <input
          ref="rootInlineInputRef"
          v-model="inlineFolderName"
          type="text"
          class="min-w-0 flex-1 rounded-md border border-indigo-300 bg-white px-2 py-1 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-indigo-600 dark:bg-gray-900 dark:text-white"
          :placeholder="t('documents.folderNamePlaceholder')"
          @keydown.enter.prevent="submitCreate('root')"
          @keydown.esc.prevent="cancelCreate"
        />
        <button
          type="button"
          class="rounded px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/30"
          @click="submitCreate('root')"
        >
          {{ t('actions.create') }}
        </button>
      </div>

      <p
        v-if="!rootFolders.length && creatingUnder !== 'root'"
        class="px-2 py-6 text-center text-xs text-gray-500 dark:text-gray-400"
      >
        {{ t('documents.emptyFolderMessage') }}
      </p>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { FolderIcon, FolderPlusIcon } from '@heroicons/vue/24/outline';
import DocumentFolderTreeNode from '@/components/documents/DocumentFolderTreeNode.vue';

const props = defineProps({
  folders: { type: Array, default: () => [] },
  selectedFolderId: { type: String, default: 'root' },
  loading: { type: Boolean, default: false },
  canCreate: { type: Boolean, default: false },
  canDelete: { type: Boolean, default: false },
  creatingFolder: { type: Boolean, default: false },
  deletingFolderId: { type: String, default: null }
});

const emit = defineEmits(['select-folder', 'create-folder', 'delete-folder']);

const { t } = useI18n();

const expandedFolderIds = ref(new Set());
const creatingUnder = ref(null);
const inlineFolderName = ref('');
const rootInlineInputRef = ref(null);

const foldersByParent = computed(() => {
  const map = { root: [] };
  for (const folder of props.folders) {
    const parentKey = folder.parentFolderId ? String(folder.parentFolderId) : 'root';
    if (!map[parentKey]) map[parentKey] = [];
    map[parentKey].push(folder);
  }
  for (const key of Object.keys(map)) {
    map[key].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  }
  return map;
});

const rootFolders = computed(() => foldersByParent.value.root || []);

function ensureDefaultExpanded() {
  const next = new Set(expandedFolderIds.value);
  for (const folder of rootFolders.value) {
    next.add(String(folder._id));
  }
  expandedFolderIds.value = next;
}

watch(
  () => props.folders.length,
  () => {
    if (!expandedFolderIds.value.size) ensureDefaultExpanded();
  },
  { immediate: true }
);

watch(
  () => props.selectedFolderId,
  (value) => {
    if (!value || value === 'root') return;
    const next = new Set(expandedFolderIds.value);
    let current = value;
    while (current && current !== 'root') {
      next.add(String(current));
      const folder = props.folders.find((row) => String(row._id) === String(current));
      current = folder?.parentFolderId ? String(folder.parentFolderId) : 'root';
    }
    expandedFolderIds.value = next;
  },
  { immediate: true }
);

function toggleFolder(folderId) {
  const next = new Set(expandedFolderIds.value);
  if (next.has(folderId)) next.delete(folderId);
  else next.add(folderId);
  expandedFolderIds.value = next;
}

function startCreate(parentId) {
  creatingUnder.value = parentId;
  inlineFolderName.value = '';
  if (parentId && parentId !== 'root') {
    const next = new Set(expandedFolderIds.value);
    next.add(String(parentId));
    expandedFolderIds.value = next;
  }
}

function cancelCreate() {
  creatingUnder.value = null;
  inlineFolderName.value = '';
}

function submitCreate(parentId) {
  const name = inlineFolderName.value.trim();
  if (!name || props.creatingFolder) return;
  const resolvedParentId = parentId === 'root' ? null : parentId;
  emit('create-folder', { name, parentFolderId: resolvedParentId });
}

watch(creatingUnder, async (value) => {
  if (value === 'root') {
    await nextTick();
    rootInlineInputRef.value?.focus();
  }
});

defineExpose({
  expandFolder: (folderId) => {
    const next = new Set(expandedFolderIds.value);
    next.add(String(folderId));
    expandedFolderIds.value = next;
  },
  cancelCreate
});
</script>
