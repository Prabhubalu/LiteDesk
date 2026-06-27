<template>
  <li>
    <button
      type="button"
      class="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors"
      :class="hasChildren ? ui.hoverRow : 'hover:bg-primary-50 dark:hover:bg-primary-950/30 cursor-grab active:cursor-grabbing'"
      :style="{ paddingLeft: `${8 + depth * 12}px` }"
      :draggable="!hasChildren"
      @click="onClick"
      @mousedown="onMouseDown"
      @dragstart="onDragStart"
    >
      <ChevronRightIcon
        v-if="hasChildren"
        class="h-3.5 w-3.5 shrink-0 text-neutral-400 transition-transform"
        :class="expanded ? 'rotate-90' : ''"
      />
      <span v-else class="w-3.5" />
      <span class="truncate" :class="hasChildren ? 'font-medium text-neutral-800 dark:text-neutral-100' : 'font-mono text-xs text-neutral-600 dark:text-neutral-300'">
        {{ label }}
      </span>
    </button>

    <ul v-if="hasChildren && expanded" class="mt-0.5">
      <BuilderDataTreeNode
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :depth="depth + 1"
        @insert="emit('insert', $event)"
      />
    </ul>
  </li>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ChevronRightIcon } from '@heroicons/vue/24/outline';
import { useBuilderUi } from '@/composables/useBuilderUi';
import { startMergeTagDrag } from '@/composables/useBuilderDragDrop';

const props = defineProps({
  node: { type: Object, required: true },
  depth: { type: Number, default: 0 }
});

const emit = defineEmits(['insert']);

const { t } = useI18n();
const ui = useBuilderUi();
const expanded = ref(props.depth === 0);

const hasChildren = computed(() => Array.isArray(props.node.children) && props.node.children.length > 0);

const label = computed(() => {
  if (props.node.labelKey) return t(props.node.labelKey);
  if (props.node.label) return props.node.label;
  return props.node.path || '';
});

function onClick() {
  if (hasChildren.value) {
    expanded.value = !expanded.value;
  }
}

function onMouseDown(event) {
  if (hasChildren.value || !props.node.path) return;
  event.preventDefault();
  emit('insert', props.node.path);
}

function onDragStart(event) {
  if (hasChildren.value || !props.node.path) return;
  startMergeTagDrag(event, props.node.path);
}
</script>
