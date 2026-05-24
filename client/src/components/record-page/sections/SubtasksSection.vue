<template>
  <section class="space-y-2">
    <h3 v-if="showHeader" class="text-base font-semibold text-gray-900 dark:text-white">
      {{ t('records.subtasksHeader', { completed: completedCount, total: subtasks.length }) }}
    </h3>
    <div
      v-if="subtasks.length || isCreatingSubtask"
      class="border-y border-x-0 border-gray-200/70 dark:border-gray-700/70 overflow-hidden"
    >
      <div :class="['divide-y divide-gray-200/70 dark:divide-gray-700/70', shouldUseScrollableList ? 'max-h-80 overflow-y-auto' : '']">
        <div
          v-for="subtask in subtasks"
          :key="subtask.id"
          class="group/subtask-row flex items-center gap-3 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
        >
          <HeadlessCheckbox
            :checked="Boolean(subtask.completed)"
            checkbox-class="h-4 w-4"
            @change="toggle(subtask)"
          />
          <div class="flex-1 min-w-0">
            <input
              v-if="editingSubtaskId === subtask.id"
              :value="editingSubtaskTitle"
              type="text"
              class="w-full min-w-0 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              @input="editingSubtaskTitle = $event?.target?.value || ''"
              @keydown.enter.prevent="saveSubtaskEdit(subtask)"
              @keydown.esc.prevent="cancelSubtaskEdit"
            />
            <span v-else :class="subtask.completed ? 'line-through text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-gray-100'" class="text-sm">
              {{ subtask.title || t('records.subtasksUntitled') }}
            </span>
          </div>
          <div v-if="canEditSubtasks" class="ml-auto flex items-center gap-1">
            <template v-if="editingSubtaskId === subtask.id">
              <button
                type="button"
                class="px-2 py-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
                @click="saveSubtaskEdit(subtask)"
              >
                {{ t('actions.save') }}
              </button>
              <button
                type="button"
                class="px-2 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                @click="cancelSubtaskEdit"
              >
                {{ t('actions.cancel') }}
              </button>
            </template>
            <template v-else>
              <button
                type="button"
                class="p-1.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 lg:opacity-0 lg:group-hover/subtask-row:opacity-100 transition-opacity"
                :title="t('records.subtasksEditAria')"
                :aria-label="t('records.subtasksEditAria')"
                @click="startSubtaskEdit(subtask)"
              >
                <PencilSquareIcon class="h-4 w-4" />
              </button>
              <button
                type="button"
                class="p-1.5 rounded text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 lg:opacity-0 lg:group-hover/subtask-row:opacity-100 transition-opacity"
                :title="t('records.subtasksDeleteAria')"
                :aria-label="t('records.subtasksDeleteAria')"
                :disabled="isDeletingSubtask && deletingSubtaskId === subtask.id"
                @click="deleteSubtask(subtask)"
              >
                <TrashIcon class="h-4 w-4" />
              </button>
            </template>
          </div>
        </div>

        <div
          v-if="isCreatingSubtask"
          :class="[
            'flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-900',
            shouldUseScrollableList ? 'sticky bottom-0 z-10 border-t border-gray-200/70 dark:border-gray-700/70' : ''
          ]"
        >
          <span class="h-4 w-4 rounded-full border-2 border-dashed border-gray-300 dark:border-gray-600 shrink-0" aria-hidden="true"></span>
          <input
            ref="newSubtaskInputRef"
            :value="newSubtaskTitle"
            type="text"
            :placeholder="t('records.subtasksNamePh')"
            class="flex-1 min-w-0 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            @input="setNewSubtaskTitle($event?.target?.value || '')"
            @keydown.enter.prevent="saveNewSubtask"
            @keydown.esc.prevent="cancelCreateSubtask"
          />
          <button
            type="button"
            class="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
            @click="cancelCreateSubtask"
          >
            {{ t('actions.cancel') }}
          </button>
          <button
            type="button"
            :disabled="!newSubtaskTitle.trim() || isSavingNewSubtask"
            class="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            @click="saveNewSubtask"
          >
            {{ t('actions.save') }}
          </button>
        </div>
      </div>
    </div>
    <div v-if="shouldShowViewAll" class="pt-1">
      <button
        type="button"
        class="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
        @click="viewAll"
      >
        {{ t('records.subtasksViewAll', { count: subtasksTotalCount }) }}
      </button>
    </div>
    <p v-else-if="!subtasks.length && !isCreatingSubtask && !isViewingAllSubtasks" class="text-sm text-gray-500 dark:text-gray-400">{{ t('records.subtasksEmpty') }}</p>
  </section>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
import { PencilSquareIcon, TrashIcon } from '@heroicons/vue/24/outline';
import HeadlessCheckbox from '@/components/ui/HeadlessCheckbox.vue';

const props = defineProps({
  record: { type: Object, default: null },
  adapter: { type: Object, default: () => ({}) },
  context: {
    type: Object,
    default: () => ({ module: '' })
  }
});

const subtasks = computed(() => {
  const value = props.adapter?.getSubtasks?.(props.record, props.context);
  return Array.isArray(value) ? value : [];
});

const showHeader = computed(() => props.context?.hideHeader !== true);
const isExpandedSubtasksMode = computed(() => props.context?.expandedLeftSection === 'subtasks');

const completedCount = computed(() => subtasks.value.filter((entry) => entry.completed).length);
const shouldUseScrollableList = computed(() => !isExpandedSubtasksMode.value && subtasks.value.length > 8);
const shouldShowViewAll = computed(() => props.adapter?.shouldShowSubtasksViewAll?.(props.record, props.context) === true);
const subtasksTotalCount = computed(() => props.adapter?.getSubtasksTotalCount?.(props.record, props.context) || subtasks.value.length);
const isViewingAllSubtasks = computed(() => props.adapter?.isViewingAllSubtasks?.(props.record, props.context) === true);
const canEditSubtasks = computed(() => props.adapter?.canEditSubtasks?.(props.record, props.context) === true);
const isDeletingSubtask = computed(() => props.adapter?.isDeletingSubtask?.(props.record, props.context) === true);
const deletingSubtaskId = computed(() => props.adapter?.deletingSubtaskId?.(props.record, props.context) || '');

const isCreatingSubtask = computed(() => props.adapter?.isCreatingSubtask?.(props.record, props.context) === true);
const newSubtaskTitle = computed(() => props.adapter?.getNewSubtaskTitle?.(props.record, props.context) || '');
const isSavingNewSubtask = computed(() => props.adapter?.isSavingNewSubtask?.(props.record, props.context) === true);
const newSubtaskInputRef = ref(null);
const editingSubtaskId = ref('');
const editingSubtaskTitle = ref('');

watch(isCreatingSubtask, (value) => {
  if (!value) return;
  nextTick(() => {
    newSubtaskInputRef.value?.focus?.();
  });
});

const toggle = (subtask) => {
  props.adapter?.toggleSubtask?.(subtask, props.record, props.context);
};

const startSubtaskEdit = (subtask) => {
  editingSubtaskId.value = String(subtask?.id || '');
  editingSubtaskTitle.value = String(subtask?.title || '');
};

const cancelSubtaskEdit = () => {
  editingSubtaskId.value = '';
  editingSubtaskTitle.value = '';
};

const saveSubtaskEdit = (subtask) => {
  const nextTitle = String(editingSubtaskTitle.value || '').trim();
  if (!nextTitle) return;
  props.adapter?.updateSubtaskTitle?.(subtask, nextTitle, props.record, props.context);
  cancelSubtaskEdit();
};

const deleteSubtask = (subtask) => {
  props.adapter?.deleteSubtask?.(subtask, props.record, props.context);
};

const setNewSubtaskTitle = (value) => {
  props.adapter?.setNewSubtaskTitle?.(value, props.record, props.context);
};

const cancelCreateSubtask = () => {
  props.adapter?.cancelCreateSubtask?.(props.record, props.context);
};

const saveNewSubtask = () => {
  props.adapter?.saveNewSubtask?.(props.record, props.context);
};

const viewAll = () => {
  props.adapter?.viewAllSubtasks?.(props.record, props.context);
};
</script>
