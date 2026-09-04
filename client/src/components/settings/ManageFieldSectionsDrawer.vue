<template>
  <TransitionRoot as="template" :show="isOpen">
    <Dialog class="relative z-50" @close="close">
      <TransitionChild
        as="template"
        enter="ease-out duration-200"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="ease-in duration-150"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-gray-500/75 dark:bg-gray-900/75" />
      </TransitionChild>

      <div class="fixed inset-0 z-50 overflow-hidden">
        <div class="absolute inset-0 overflow-hidden">
          <div class="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
            <TransitionChild
              as="template"
              enter="transform transition ease-in-out duration-300"
              enter-from="translate-x-full"
              enter-to="translate-x-0"
              leave="transform transition ease-in-out duration-300"
              leave-from="translate-x-0"
              leave-to="translate-x-full"
            >
              <DialogPanel class="pointer-events-auto w-screen max-w-md">
                <div class="flex h-full flex-col bg-white dark:bg-gray-800 shadow-xl">
                  <div class="px-4 py-4 border-b border-gray-200 dark:border-white/10 flex items-start justify-between gap-3">
                    <div>
                      <DialogTitle class="text-base font-semibold text-gray-900 dark:text-white">
                        {{ t('settings.modFieldsManageSections') }}
                      </DialogTitle>
                      <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {{ t('settings.modFieldsManageSectionsHint') }}
                      </p>
                    </div>
                    <button
                      type="button"
                      class="rounded-lg p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5"
                      @click="close"
                    >
                      <XMarkIcon class="w-5 h-5" />
                    </button>
                  </div>

                  <div class="flex-1 overflow-y-auto p-4 space-y-3">
                    <div
                      v-for="(section, idx) in draftSections"
                      :key="section.id"
                      class="rounded-lg border border-gray-200 dark:border-white/10 p-3 bg-gray-50 dark:bg-white/5"
                      :draggable="true"
                      @dragstart="onDragStart(idx)"
                      @dragover.prevent="onDragOver(idx)"
                      @drop.prevent="onDrop(idx)"
                    >
                      <div class="flex items-center gap-2">
                        <span class="cursor-grab text-gray-400 select-none">⋮⋮</span>
                        <input
                          v-model="section.editLabel"
                          type="text"
                          class="flex-1 min-w-0 px-2 py-1.5 rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white"
                          :placeholder="t('settings.modFieldsSectionNamePh')"
                        />
                        <button
                          type="button"
                          class="p-1.5 rounded-md text-gray-400 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-40 disabled:cursor-not-allowed"
                          :disabled="section.protected || fieldCount(section.id) > 0"
                          :title="deleteTitle(section)"
                          @click="removeSection(section.id)"
                        >
                          <TrashIcon class="w-4 h-4" />
                        </button>
                      </div>
                      <div class="mt-1.5 flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                        <span v-if="section.protected">{{ t('settings.modFieldsSectionProtected') }}</span>
                        <span>{{ t('settings.modFieldsSectionFieldCount', { count: fieldCount(section.id) }) }}</span>
                      </div>
                    </div>
                  </div>

                  <div class="border-t border-gray-200 dark:border-white/10 p-4 space-y-3">
                    <div class="flex gap-2">
                      <input
                        v-model="newSectionLabel"
                        type="text"
                        class="flex-1 px-2 py-1.5 rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 text-sm"
                        :placeholder="t('settings.modFieldsNewSectionPh')"
                        @keydown.enter.prevent="addSection"
                      />
                      <button
                        type="button"
                        class="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5"
                        @click="addSection"
                      >
                        {{ t('settings.modFieldsAddSection') }}
                      </button>
                    </div>
                    <div class="flex justify-end gap-2">
                      <button
                        type="button"
                        class="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200"
                        @click="close"
                      >
                        {{ t('actions.cancel') }}
                      </button>
                      <button
                        type="button"
                        class="px-3 py-2 rounded-lg bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-500"
                        @click="apply"
                      >
                        {{ t('actions.apply') }}
                      </button>
                    </div>
                  </div>
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue';
import { XMarkIcon, TrashIcon } from '@heroicons/vue/24/outline';
import {
  createCustomSection,
  renameSection,
  reorderSections,
  deleteSectionIfEmpty,
  resolveSectionDisplayLabel
} from '@/platform/fields/fieldLayout';

const props = defineProps({
  isOpen: { type: Boolean, default: false },
  layout: { type: Object, required: true },
  fields: { type: Array, default: () => [] }
});

const emit = defineEmits(['close', 'save']);

const { t } = useI18n();
const draftSections = ref([]);
const draftLayout = ref(null);
const newSectionLabel = ref('');
const dragFrom = ref(null);

watch(
  () => [props.isOpen, props.layout],
  () => {
    if (!props.isOpen || !props.layout) return;
    draftLayout.value = {
      version: 1,
      sections: (props.layout.sections || []).map((s) => ({ ...s }))
    };
    draftSections.value = draftLayout.value.sections
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((s) => ({
        ...s,
        editLabel: resolveSectionDisplayLabel(s, t)
      }));
    newSectionLabel.value = '';
  },
  { immediate: true }
);

function fieldCount(sectionId) {
  return (props.fields || []).filter((f) => String(f.sectionId) === sectionId).length;
}

function deleteTitle(section) {
  if (section.protected) return t('settings.modFieldsSectionCannotDeleteProtected');
  if (fieldCount(section.id) > 0) return t('settings.modFieldsSectionCannotDeleteNotEmpty');
  return t('actions.delete');
}

function close() {
  emit('close');
}

function addSection() {
  const label = String(newSectionLabel.value || '').trim();
  if (!label || !draftLayout.value) return;
  draftLayout.value = createCustomSection(draftLayout.value, label);
  draftSections.value = draftLayout.value.sections.map((s) => ({
    ...s,
    editLabel: s.label || resolveSectionDisplayLabel(s, t)
  }));
  newSectionLabel.value = '';
}

function removeSection(sectionId) {
  if (!draftLayout.value) return;
  const result = deleteSectionIfEmpty(draftLayout.value, props.fields, sectionId);
  if (!result.ok) return;
  draftLayout.value = result.layout;
  draftSections.value = draftLayout.value.sections.map((s) => {
    const prev = draftSections.value.find((d) => d.id === s.id);
    return {
      ...s,
      editLabel: prev?.editLabel || resolveSectionDisplayLabel(s, t)
    };
  });
}

function onDragStart(idx) {
  dragFrom.value = idx;
}

function onDragOver() {
  /* allow drop */
}

function onDrop(toIdx) {
  const fromIdx = dragFrom.value;
  dragFrom.value = null;
  if (fromIdx === null || fromIdx === toIdx) return;
  const next = [...draftSections.value];
  const [moved] = next.splice(fromIdx, 1);
  next.splice(toIdx, 0, moved);
  draftSections.value = next;
  if (draftLayout.value) {
    draftLayout.value = reorderSections(
      draftLayout.value,
      next.map((s) => s.id)
    );
  }
}

function apply() {
  if (!draftLayout.value) return;
  let layout = { version: 1, sections: [...draftLayout.value.sections] };
  for (const row of draftSections.value) {
    layout = renameSection(layout, row.id, row.editLabel);
  }
  layout = reorderSections(
    layout,
    draftSections.value.map((s) => s.id)
  );
  emit('save', layout);
  emit('close');
}
</script>
