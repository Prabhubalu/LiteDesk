<template>
  <div
    v-if="isSelected && !locked"
    class="pointer-events-auto z-40 flex flex-nowrap items-center gap-0.5 rounded-lg border border-neutral-200 bg-white p-0.5 shadow-md dark:border-neutral-700 dark:bg-neutral-900"
    :class="dock === 'above' ? 'relative' : 'absolute top-0 left-0'"
  >
    <button
      v-if="showDragHandle"
      type="button"
      class="builder-drag-handle cursor-grab"
      :class="ui.btnIcon"
      :title="t('templates.builderDragHandle')"
    >
      <Bars3Icon class="h-4 w-4" />
    </button>
    <button type="button" :class="ui.btnIcon" :title="t('templates.builderDuplicate')" @click.stop="onDuplicate">
      <DocumentDuplicateIcon class="h-4 w-4" />
    </button>
    <button type="button" :class="ui.btnIcon" :title="t('actions.delete')" @click.stop="onDelete">
      <TrashIcon class="h-4 w-4 text-danger-600" />
    </button>
  </div>
</template>

<script setup>
import { inject } from 'vue';
import { useI18n } from 'vue-i18n';
import { Bars3Icon, DocumentDuplicateIcon, TrashIcon } from '@heroicons/vue/24/outline';
import { BUILDER_DELETE_NODE_KEY } from '@/constants/builderInjectKeys';
import { useBuilderUi } from '@/composables/useBuilderUi';

const props = defineProps({
  nodeId: { type: String, required: true },
  isSelected: { type: Boolean, default: false },
  locked: { type: Boolean, default: false },
  dock: { type: String, default: 'inline' },
  showDragHandle: { type: Boolean, default: true }
});

const emit = defineEmits(['duplicate']);

const { t } = useI18n();
const ui = useBuilderUi();
const deleteNode = inject(BUILDER_DELETE_NODE_KEY, null);

function onDelete() {
  if (typeof deleteNode === 'function') {
    deleteNode(props.nodeId);
    return;
  }
}

function onDuplicate() {
  emit('duplicate');
}
</script>
