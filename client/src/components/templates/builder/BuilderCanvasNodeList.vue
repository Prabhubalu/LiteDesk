<template>
  <draggable
    v-model="localItems"
    item-key="id"
    handle=".builder-drag-handle"
    :group="BUILDER_CANVAS_DRAG_GROUP"
    :class="listClass"
    :style="listStyle"
    ghost-class="builder-drag-ghost"
    :move="canMove"
    @start="onDragStart"
    @end="onDragEnd"
    @add="onLibraryAdd"
  >
    <template #header>
      <slot v-if="!localItems.length" name="empty" />
    </template>

    <template #item="{ element }">
      <div
        class="group relative min-w-0"
        :class="itemWrapperClass(element)"
        :style="itemWrapperStyle(element)"
      >
        <BuilderTextFormatToolbar
          v-if="isTextBlock(element) && element.id === selectedId && !isNodeLocked(element)"
          :node-id="element.id"
          :node-type="String(element.type)"
          :heading-level="Number(element.bindings?.level || 1)"
          :text-align="String(element.style?.typography?.textAlign || 'left')"
          :active-formats="textFormatState"
          @format="onTextFormat"
          @duplicate="onDuplicate(element.id)"
        />

        <BuilderSelectionToolbar
          v-else-if="element.id === selectedId && !isNodeLocked(element) && element.type !== 'Table'"
          :node-id="element.id"
          :is-selected="true"
          :locked="false"
          @duplicate="onDuplicate(element.id)"
        />

        <div class="relative" @click.self="onSelectBlock(element.id, $event)">
          <BuilderCanvasBlock
            :node="element"
            :selected-id="selectedId"
            :selected-ids="selectedIds"
            @select="emit('select', $event)"
            @remove="onRemove"
            @duplicate="emit('duplicate', $event)"
            @reorder="emit('reorder', $event)"
            @patch="emit('patch', $event)"
            @format-state="onFormatState"
            @continue-after="emit('continue-after', $event)"
            @library-add="emit('library-add', $event)"
          />
        </div>
      </div>
    </template>
  </draggable>
</template>

<script setup>
import { computed, inject, nextTick, ref, watch } from 'vue';
import draggable from 'vuedraggable';
import BuilderCanvasBlock from '@/components/templates/builder/BuilderCanvasBlock.vue';
import BuilderSelectionToolbar from '@/components/templates/builder/BuilderSelectionToolbar.vue';
import BuilderTextFormatToolbar from '@/components/templates/builder/BuilderTextFormatToolbar.vue';
import { CONTENT_COMPONENT_TYPES } from '@/constants/contentComponentRegistry';
import { BUILDER_ACTIVE_TEXT_EDITOR_KEY, BUILDER_DELETE_NODE_KEY } from '@/constants/builderInjectKeys';
import { BUILDER_CANVAS_DRAG_GROUP } from '@/constants/builderDragTypes';
import {
  resolveColumnCanvasStyle,
  resolveRowCanvasStyle
} from '@/utils/builderRowColumnLayout';
import { isNodeHidden, isNodeLocked } from '@/utils/templateBuilderTree';

const props = defineProps({
  parentId: { type: String, required: true },
  parentType: { type: String, default: '' },
  parentBindings: { type: Object, default: () => ({}) },
  nodes: { type: Array, default: () => [] },
  selectedId: { type: String, default: null },
  selectedIds: { type: Array, default: () => [] },
  depth: { type: Number, default: 0 }
});

const emit = defineEmits([
  'select',
  'remove',
  'duplicate',
  'reorder',
  'patch',
  'continue-after',
  'library-add'
]);

const localItems = ref([]);
const isDragging = ref(false);
const isLibraryAdding = ref(false);
const textFormatState = ref({ bold: false, italic: false });
const activeTextEditor = inject(BUILDER_ACTIVE_TEXT_EDITOR_KEY, null);
const deleteNode = inject(BUILDER_DELETE_NODE_KEY, null);

const listClass = computed(() => {
  if (props.parentType === CONTENT_COMPONENT_TYPES.ROW) {
    return localItems.value.length
      ? 'grid w-full grid-cols-12'
      : 'w-full';
  }
  if (props.parentType === CONTENT_COMPONENT_TYPES.COLUMN) return 'flex w-full min-w-0 flex-col gap-3';
  return 'space-y-4';
});

const listStyle = computed(() => {
  if (props.parentType !== CONTENT_COMPONENT_TYPES.ROW || !localItems.value.length) return undefined;
  return resolveRowCanvasStyle(props.parentBindings || {});
});

function itemWrapperClass(element) {
  const classes = ['pt-11'];
  if (isNodeHidden(element)) classes.push('opacity-50');
  return classes;
}

function itemWrapperStyle(element) {
  if (props.parentType !== CONTENT_COMPONENT_TYPES.ROW) return undefined;
  if (element?.type === CONTENT_COMPONENT_TYPES.COLUMN) {
    return resolveColumnCanvasStyle(element.bindings || {});
  }
  return { gridColumn: 'span 12 / span 12' };
}

function isTextBlock(node) {
  return node?.type === 'Heading' || node?.type === 'Paragraph';
}

function canMove(event) {
  return !isNodeLocked(event.draggedContext.element);
}

function syncLocalItems() {
  localItems.value = Array.isArray(props.nodes) ? [...props.nodes] : [];
}

function onRemove(nodeId) {
  const id = String(nodeId || '').trim();
  if (!id) return;
  if (typeof deleteNode === 'function') {
    deleteNode(id);
  } else {
    emit('remove', id);
  }
}

function onSelectBlock(nodeId, event) {
  emit('select', { id: nodeId, additive: Boolean(event?.shiftKey) });
}

function onDuplicate(nodeId) {
  emit('duplicate', nodeId);
}

function onFormatState(state) {
  textFormatState.value = {
    bold: Boolean(state?.bold),
    italic: Boolean(state?.italic)
  };
}

function onTextFormat(action, value) {
  activeTextEditor?.value?.applyFormat?.(action, value);
}

watch(
  () => props.nodes,
  () => {
    if (isDragging.value || isLibraryAdding.value) return;
    syncLocalItems();
  },
  { immediate: true, deep: true }
);

function onDragStart() {
  isDragging.value = true;
}

function onDragEnd() {
  isDragging.value = false;

  const orderedIds = localItems.value.map((node) => node.id);
  const currentIds = props.nodes.map((node) => node.id);
  if (orderedIds.join('|') === currentIds.join('|')) return;

  emit('reorder', {
    parentId: props.parentId,
    orderedIds
  });
}

function onLibraryAdd(event) {
  const node = localItems.value[event.newIndex];
  if (!node?.id) return;

  isLibraryAdding.value = true;
  emit('library-add', {
    parentId: props.parentId,
    index: event.newIndex,
    node
  });
  void nextTick(() => {
    isLibraryAdding.value = false;
  });
}
</script>

<style scoped>
.builder-drag-ghost {
  opacity: 0.35;
}
</style>
