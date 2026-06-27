<template>
  <div
    ref="canvasOuterRef"
    :class="[ui.canvasOuter, isPanning ? 'cursor-grabbing select-none' : '']"
    @mousedown="onPanStart"
  >
    <div
      class="origin-top transition-transform duration-150"
      :style="{ transform: `scale(${zoom})` }"
    >
      <div
        :class="[ui.canvasPaper, ui.canvasDoc, !isFreeform && dropHighlight]"
        :style="pageStyle"
        @dragover.prevent="!isFreeform ? onDragOver : undefined"
        @dragleave="!isFreeform ? onDragLeave : undefined"
        @drop.prevent="!isFreeform ? onDrop : undefined"
        @click.self="onCanvasBackgroundClick"
      >
        <BuilderFreeformCanvas
          v-if="isFreeform"
          :root-id="rootId"
          :nodes="nodes"
          :selected-id="selectedId"
          :selected-ids="selectedIds"
          :zoom="zoom"
          :page-width-px="pageWidthPx"
          :page-height-px="pageHeightPx"
          @select="emit('select', $event)"
          @remove="emit('remove', $event)"
          @duplicate="emit('duplicate', $event)"
          @reorder="onReorder"
          @patch="emit('patch', $event)"
          @start-typing="onStartTyping"
          @continue-after="emit('continue-after', $event)"
          @library-add="emit('library-add', $event)"
          @layout-change="emit('layout-change', $event)"
          @component-drop="emit('component-drop', $event)"
        />

        <div
          v-else
          class="px-12 md:px-16"
          :class="nodes.length ? 'py-14 md:py-16' : 'flex min-h-[480px] flex-col justify-center py-16'"
        >
          <BuilderCanvasNodeList
            :parent-id="rootId"
            :nodes="nodes"
            :selected-id="selectedId"
            :selected-ids="selectedIds"
            @select="emit('select', $event)"
            @remove="emit('remove', $event)"
            @duplicate="emit('duplicate', $event)"
            @reorder="onReorder"
            @patch="emit('patch', $event)"
            @continue-after="emit('continue-after', $event)"
            @library-add="emit('library-add', $event)"
          >
            <template #empty>
              <BuilderDocStarter ref="docStarterRef" @start-typing="onStartTyping" />
            </template>
          </BuilderCanvasNodeList>

          <button
            v-if="showContinueHint"
            type="button"
            class="mt-6 block w-full min-h-[1.75rem] cursor-text border-0 bg-transparent p-0 text-left text-base leading-relaxed text-neutral-400 outline-none hover:text-neutral-500 dark:text-neutral-500 dark:hover:text-neutral-400"
            @mousedown.prevent="onContinueClick"
            @click.prevent="onContinueClick"
          >
            {{ t('templates.builderDocContinueTyping') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import BuilderCanvasNodeList from '@/components/templates/builder/BuilderCanvasNodeList.vue';
import BuilderDocStarter from '@/components/templates/builder/BuilderDocStarter.vue';
import BuilderFreeformCanvas from '@/components/templates/builder/BuilderFreeformCanvas.vue';
import { useBuilderUi } from '@/composables/useBuilderUi';
import { useBuilderDropHighlightClass, useBuilderDropTarget } from '@/composables/useBuilderDragDrop';
import { BUILDER_LAYOUT_MODES } from '@/utils/builderLayout';

const props = defineProps({
  rootId: { type: String, default: 'root' },
  nodes: { type: Array, default: () => [] },
  selectedId: { type: String, default: null },
  selectedIds: { type: Array, default: () => [] },
  zoom: { type: Number, default: 1 },
  pageWidthPx: { type: Number, default: 794 },
  pageHeightPx: { type: Number, default: 1123 },
  layoutMode: { type: String, default: BUILDER_LAYOUT_MODES.FLOW },
  focusOnMount: { type: Boolean, default: false }
});

const emit = defineEmits([
  'select',
  'remove',
  'duplicate',
  'reorder',
  'patch',
  'start-typing',
  'continue-typing',
  'continue-after',
  'library-add',
  'layout-change',
  'component-drop'
]);

const { t } = useI18n();
const ui = useBuilderUi();
const docStarterRef = ref(null);
const canvasOuterRef = ref(null);
const isPanning = ref(false);
const spacePressed = ref(false);
let panOrigin = { x: 0, y: 0, scrollLeft: 0, scrollTop: 0 };

const isFreeform = computed(() => props.layoutMode === BUILDER_LAYOUT_MODES.ABSOLUTE);

const { isDragOver, onDragOver, onDragLeave, onDrop } = useBuilderDropTarget(props.rootId);
const dropHighlight = useBuilderDropHighlightClass(isDragOver);

const pageStyle = computed(() => ({
  width: `${props.pageWidthPx}px`,
  minHeight: `${props.pageHeightPx}px`,
  maxWidth: 'none'
}));

const showContinueHint = computed(() => {
  if (isFreeform.value) return false;
  const last = props.nodes[props.nodes.length - 1];
  if (!last) return false;
  return last.type !== 'Paragraph' && last.type !== 'Heading';
});

function onContinueClick() {
  emit('continue-typing');
}

function onReorder(payload) {
  emit('reorder', payload);
}

function onCanvasBackgroundClick() {
  emit('select', { id: null, additive: false });
}

function onPanStart(event) {
  if (!spacePressed.value && event.button !== 1) return;
  const el = canvasOuterRef.value;
  if (!el) return;
  isPanning.value = true;
  panOrigin = {
    x: event.clientX,
    y: event.clientY,
    scrollLeft: el.scrollLeft,
    scrollTop: el.scrollTop
  };
  event.preventDefault();
}

function onPanMove(event) {
  if (!isPanning.value) return;
  const el = canvasOuterRef.value;
  if (!el) return;
  el.scrollLeft = panOrigin.scrollLeft - (event.clientX - panOrigin.x);
  el.scrollTop = panOrigin.scrollTop - (event.clientY - panOrigin.y);
}

function onPanEnd() {
  isPanning.value = false;
}

function onKeyDown(event) {
  if (event.code === 'Space' && !event.target?.matches('input, textarea, select, [contenteditable="true"]')) {
    spacePressed.value = true;
  }
}

function onKeyUp(event) {
  if (event.code === 'Space') {
    spacePressed.value = false;
    onPanEnd();
  }
}

function onStartTyping(initialText) {
  emit('start-typing', initialText);
}

async function focusEmptyDoc() {
  if (props.nodes.length || isFreeform.value) return;
  await nextTick();
  docStarterRef.value?.focus();
}

watch(
  () => props.focusOnMount,
  (shouldFocus) => {
    if (shouldFocus) void focusEmptyDoc();
  },
  { immediate: true }
);

watch(
  () => props.nodes.length,
  (length) => {
    if (length === 0 && props.focusOnMount && !isFreeform.value) void focusEmptyDoc();
  }
);

onMounted(() => {
  if (props.focusOnMount && !props.nodes.length && !isFreeform.value) {
    void focusEmptyDoc();
  }
  window.addEventListener('mousemove', onPanMove);
  window.addEventListener('mouseup', onPanEnd);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
});

onUnmounted(() => {
  window.removeEventListener('mousemove', onPanMove);
  window.removeEventListener('mouseup', onPanEnd);
  window.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('keyup', onKeyUp);
});

defineExpose({ focusEmptyDoc });
</script>
