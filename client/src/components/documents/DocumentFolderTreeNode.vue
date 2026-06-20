<template>
  <div class="document-folder-tree-node">
    <div
      class="group flex min-w-0 items-center gap-1 rounded-md py-1 pr-2 text-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/60"
      :class="selected ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-200' : 'text-gray-800 dark:text-gray-200'"
      :style="{ paddingLeft: `${depth * 16 + 8}px` }"
    >
      <button
        v-if="hasChildren"
        type="button"
        class="flex h-6 w-6 shrink-0 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
        :aria-label="expanded ? t('documents.folderTreeCollapse') : t('documents.folderTreeExpand')"
        :aria-expanded="expanded"
        @click.stop="emit('toggle-folder', folderId)"
      >
        <ChevronDownIcon v-if="expanded" class="h-3.5 w-3.5" />
        <ChevronRightIcon v-else class="h-3.5 w-3.5" />
      </button>
      <span v-else class="h-6 w-6 shrink-0" aria-hidden="true" />

      <button
        type="button"
        class="flex min-w-0 flex-1 items-center gap-2 text-left"
        @click="emit('select-folder', folderId)"
      >
        <FolderIcon class="h-4 w-4 shrink-0 text-amber-500" />
        <span class="truncate">{{ folder.name }}</span>
      </button>

      <button
        v-if="canCreate"
        type="button"
        class="rounded p-1 text-gray-400 opacity-0 transition hover:bg-white hover:text-indigo-600 group-hover:opacity-100 dark:hover:bg-gray-700 dark:hover:text-indigo-400"
        :title="t('documents.addSubfolder')"
        :aria-label="t('documents.addSubfolder')"
        @click.stop="emit('start-create', folderId)"
      >
        <FolderPlusIcon class="h-4 w-4" />
      </button>

      <button
        v-if="canDelete"
        type="button"
        class="rounded p-1 text-gray-400 opacity-0 transition hover:bg-white hover:text-red-600 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-gray-700 dark:hover:text-red-400"
        :title="t('documents.deleteFolder')"
        :aria-label="t('documents.deleteFolder')"
        :disabled="deletingFolderId === folderId"
        @click.stop="emit('delete-folder', folder)"
      >
        <TrashIcon class="h-4 w-4" />
      </button>
    </div>

    <div v-if="expanded">
      <div
        v-if="creatingUnder === folderId"
        class="flex items-center gap-2 py-1 pr-2"
        :style="{ paddingLeft: `${(depth + 1) * 16 + 8}px` }"
      >
        <span class="h-6 w-6 shrink-0" aria-hidden="true" />
        <FolderIcon class="h-4 w-4 shrink-0 text-amber-500" />
        <input
          ref="inlineInputRef"
          :value="inlineFolderName"
          type="text"
          class="min-w-0 flex-1 rounded-md border border-indigo-300 bg-white px-2 py-1 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-indigo-600 dark:bg-gray-900 dark:text-white"
          :placeholder="t('documents.folderNamePlaceholder')"
          @input="emit('update:inlineFolderName', $event.target.value)"
          @keydown.enter.prevent="emit('submit-create', folderId)"
          @keydown.esc.prevent="emit('cancel-create')"
        />
        <button
          type="button"
          class="rounded px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/30"
          @click="emit('submit-create', folderId)"
        >
          {{ t('actions.create') }}
        </button>
      </div>

      <DocumentFolderTreeNode
        v-for="childFolder in childFolders"
        :key="childFolder._id"
        :folder="childFolder"
        :depth="depth + 1"
        :folders-by-parent="foldersByParent"
        :expanded-folder-ids="expandedFolderIds"
        :selected-folder-id="selectedFolderId"
        :creating-under="creatingUnder"
        :inline-folder-name="inlineFolderName"
        :can-create="canCreate"
        :can-delete="canDelete"
        :deleting-folder-id="deletingFolderId"
        @toggle-folder="emit('toggle-folder', $event)"
        @select-folder="emit('select-folder', $event)"
        @start-create="emit('start-create', $event)"
        @submit-create="emit('submit-create', $event)"
        @cancel-create="emit('cancel-create')"
        @delete-folder="emit('delete-folder', $event)"
        @update:inline-folder-name="emit('update:inlineFolderName', $event)"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  FolderIcon,
  FolderPlusIcon,
  TrashIcon
} from '@heroicons/vue/24/outline';
import DocumentFolderTreeNode from '@/components/documents/DocumentFolderTreeNode.vue';

const props = defineProps({
  folder: { type: Object, required: true },
  depth: { type: Number, default: 0 },
  foldersByParent: { type: Object, default: () => ({}) },
  expandedFolderIds: { type: Object, default: () => new Set() },
  selectedFolderId: { type: String, default: 'root' },
  creatingUnder: { type: String, default: null },
  inlineFolderName: { type: String, default: '' },
  canCreate: { type: Boolean, default: false },
  canDelete: { type: Boolean, default: false },
  deletingFolderId: { type: String, default: null }
});

const emit = defineEmits([
  'toggle-folder',
  'select-folder',
  'start-create',
  'submit-create',
  'cancel-create',
  'delete-folder',
  'update:inlineFolderName'
]);

const { t } = useI18n();
const inlineInputRef = ref(null);

const folderId = computed(() => String(props.folder._id));
const childFolders = computed(() => props.foldersByParent[folderId.value] || []);
const hasChildren = computed(() => childFolders.value.length > 0);
const expanded = computed(() => props.expandedFolderIds.has(folderId.value));
const selected = computed(() => props.selectedFolderId === folderId.value);

watch(
  () => props.creatingUnder,
  async (value) => {
    if (value === folderId.value) {
      await nextTick();
      inlineInputRef.value?.focus();
    }
  }
);
</script>
