<template>
  <div
    class="pointer-events-auto z-40 flex max-w-none flex-nowrap items-center gap-0.5 rounded-lg border border-neutral-200 bg-white p-0.5 shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
    :class="dock === 'above' ? 'relative' : 'absolute top-0 left-0 max-w-[calc(100vw-2rem)]'"
  >
    <button
      type="button"
      :class="[ui.btnIcon, activeFormats.bold ? ui.selectedBg : '']"
      :title="t('templates.builderFormatBold')"
      @mousedown.prevent
      @click.stop="emit('format', 'bold')"
    >
      <span class="text-sm font-bold">B</span>
    </button>
    <button
      type="button"
      :class="[ui.btnIcon, activeFormats.italic ? ui.selectedBg : '']"
      :title="t('templates.builderFormatItalic')"
      @mousedown.prevent
      @click.stop="emit('format', 'italic')"
    >
      <span class="text-sm italic">I</span>
    </button>

    <span class="mx-0.5 h-5 w-px bg-neutral-200 dark:bg-neutral-700" />

    <button
      v-for="item in alignments"
      :key="item.value"
      type="button"
      :class="[ui.btnIcon, textAlign === item.value ? ui.selectedBg : '']"
      :title="item.label"
      @mousedown.prevent
      @click.stop="emit('format', 'align', item.value)"
    >
      <component :is="item.icon" class="h-4 w-4" />
    </button>

    <template v-if="nodeType === 'Heading'">
      <span class="mx-0.5 h-5 w-px bg-neutral-200 dark:bg-neutral-700" />
      <button
        v-for="level in headingLevels"
        :key="level"
        type="button"
        :class="[ui.btnIcon, headingLevel === level ? ui.selectedBg : '']"
        :title="t(`templates.builderFormatHeading${level}`)"
        @mousedown.prevent
        @click.stop="emit('format', 'headingLevel', level)"
      >
        <span class="text-xs font-semibold">H{{ level }}</span>
      </button>
    </template>

    <span class="mx-0.5 h-5 w-px bg-neutral-200 dark:bg-neutral-700" />

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
import { computed, inject } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Bars3Icon,
  DocumentDuplicateIcon,
  TrashIcon,
  Bars3BottomLeftIcon,
  Bars3CenterLeftIcon,
  Bars3BottomRightIcon
} from '@heroicons/vue/24/outline';
import { BUILDER_DELETE_NODE_KEY } from '@/constants/builderInjectKeys';
import { useBuilderUi } from '@/composables/useBuilderUi';

const props = defineProps({
  nodeId: { type: String, required: true },
  nodeType: { type: String, default: 'Paragraph' },
  headingLevel: { type: Number, default: 1 },
  textAlign: { type: String, default: 'left' },
  dock: { type: String, default: 'inline' },
  showDragHandle: { type: Boolean, default: true },
  activeFormats: {
    type: Object,
    default: () => ({ bold: false, italic: false })
  }
});

const emit = defineEmits(['format', 'duplicate']);

const { t } = useI18n();
const ui = useBuilderUi();
const deleteNode = inject(BUILDER_DELETE_NODE_KEY, null);

const headingLevels = [1, 2, 3, 4];

const alignments = computed(() => [
  { value: 'left', label: t('templates.builderFormatAlignLeft'), icon: Bars3BottomLeftIcon },
  { value: 'center', label: t('templates.builderFormatAlignCenter'), icon: Bars3CenterLeftIcon },
  { value: 'right', label: t('templates.builderFormatAlignRight'), icon: Bars3BottomRightIcon }
]);

function onDelete() {
  if (typeof deleteNode === 'function') {
    deleteNode(props.nodeId);
  }
}

function onDuplicate() {
  emit('duplicate');
}
</script>
