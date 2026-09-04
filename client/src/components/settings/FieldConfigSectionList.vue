<template>
  <div class="space-y-4">
    <div
      v-for="group in groups"
      :key="group.section.id"
      class="mb-1"
      @dragover.prevent="onSectionDragOver(group.section.id)"
      @drop.prevent="onSectionDrop(group.section.id)"
    >
      <div
        class="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2 px-2 flex items-center justify-between gap-2"
        :class="dragOverSectionId === group.section.id ? 'text-indigo-600 dark:text-indigo-400' : ''"
      >
        <span class="truncate">{{ sectionLabel(group.section) }}</span>
        <div class="flex items-center gap-1.5 shrink-0">
          <span class="text-[10px] font-normal normal-case tracking-normal text-gray-400 dark:text-gray-500">
            {{ group.fieldKeys.length }}
          </span>
          <button
            v-if="allowAddField"
            type="button"
            class="inline-flex items-center justify-center w-5 h-5 rounded text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-white/10"
            :title="t('settings.modFieldsAddFieldToSection')"
            @click.stop="$emit('add-field', group.section.id)"
          >
            <PlusIcon class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <ul class="space-y-1 min-h-[8px]">
        <li
          v-for="fieldKey in group.fieldKeys"
          :key="fieldKey"
          class="group"
          :draggable="isFieldDraggable(fieldKey)"
          @dragstart="onDragStart(fieldKey)"
          @dragover.prevent="onDragOver(fieldKey)"
          @drop.prevent="onDrop(fieldKey)"
          @dragend="onDragEnd"
        >
          <div
            :class="[
              'w-full px-3 py-2 rounded-lg text-sm flex items-center justify-between gap-2',
              isSelected(fieldKey)
                ? 'bg-gray-100 dark:bg-white/5 text-gray-900 dark:text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5',
              dragOverKey === fieldKey ? 'ring-2 ring-indigo-500 dark:ring-indigo-400' : '',
              isSystem(fieldKey) ? 'opacity-75' : ''
            ]"
          >
            <div
              v-if="isFieldDraggable(fieldKey)"
              class="cursor-grab select-none mr-2 text-gray-400 dark:text-gray-500"
            >
              ⋮⋮
            </div>
            <div
              v-else
              class="mr-2 text-xs text-purple-600 dark:text-purple-400"
              :title="t('settings.modFieldsTitleSystemField')"
            >
              🔒
            </div>
            <button
              type="button"
              class="flex-1 text-left truncate flex items-center gap-2 min-w-0"
              @click.stop="$emit('select', fieldKey)"
            >
              <span class="truncate">{{ fieldLabel(fieldKey) }}</span>
              <span
                v-if="badgeFor(fieldKey)"
                :class="badgeClass(badgeFor(fieldKey).type)"
                class="px-1.5 py-0.5 text-xs font-medium rounded shrink-0"
              >
                {{ badgeFor(fieldKey).label }}
              </span>
            </button>
            <span class="text-xs text-gray-500 dark:text-gray-400 shrink-0">{{ fieldDataType(fieldKey) }}</span>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { PlusIcon } from '@heroicons/vue/24/outline';
import {
  groupFieldsByLayout,
  resolveSectionDisplayLabel
} from '@/platform/fields/fieldLayout';

const props = defineProps({
  fields: { type: Array, required: true },
  layout: { type: Object, required: true },
  search: { type: String, default: '' },
  selectedFieldKey: { type: String, default: '' },
  resolveBadge: { type: Function, required: true },
  resolveLabel: { type: Function, required: true },
  resolveDataType: { type: Function, required: true },
  isSystemFieldKey: { type: Function, required: true },
  canDragFieldKey: { type: Function, default: null },
  includeField: { type: Function, default: null },
  allowAddField: { type: Boolean, default: false }
});

const emit = defineEmits(['select', 'reorder', 'add-field']);

const { t } = useI18n();
const dragStartKey = ref(null);
const dragOverKey = ref(null);
const dragOverSectionId = ref(null);

const groups = computed(() =>
  groupFieldsByLayout(props.fields, props.layout, {
    search: props.search,
    includeField: props.includeField || undefined
  })
);

function sectionLabel(section) {
  return resolveSectionDisplayLabel(section, t);
}

function isSelected(fieldKey) {
  return props.selectedFieldKey === fieldKey;
}

function isSystem(fieldKey) {
  return !!props.isSystemFieldKey(fieldKey);
}

function isFieldDraggable(fieldKey) {
  if (typeof props.canDragFieldKey === 'function') {
    return props.canDragFieldKey(fieldKey);
  }
  return !isSystem(fieldKey);
}

function fieldLabel(fieldKey) {
  return props.resolveLabel(fieldKey);
}

function fieldDataType(fieldKey) {
  return props.resolveDataType(fieldKey);
}

function badgeFor(fieldKey) {
  return props.resolveBadge(fieldKey);
}

function badgeClass(type) {
  if (type === 'custom') return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300';
  if (type === 'participation') return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300';
  if (type === 'system') return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
  return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300';
}

function onDragStart(fieldKey) {
  if (!isFieldDraggable(fieldKey)) return;
  dragStartKey.value = fieldKey;
}

function onDragOver(fieldKey) {
  dragOverKey.value = fieldKey;
  dragOverSectionId.value = null;
}

function onSectionDragOver(sectionId) {
  dragOverSectionId.value = sectionId;
  dragOverKey.value = null;
}

function onDrop(toKey) {
  const fromKey = dragStartKey.value;
  dragStartKey.value = null;
  dragOverKey.value = null;
  dragOverSectionId.value = null;
  if (!fromKey || !toKey || fromKey === toKey) return;
  emit('reorder', { type: 'field', fromKey, toKey });
}

function onSectionDrop(sectionId) {
  const fromKey = dragStartKey.value;
  dragStartKey.value = null;
  dragOverKey.value = null;
  dragOverSectionId.value = null;
  if (!fromKey || !sectionId) return;
  emit('reorder', { type: 'section', fromKey, sectionId });
}

function onDragEnd() {
  dragStartKey.value = null;
  dragOverKey.value = null;
  dragOverSectionId.value = null;
}
</script>
