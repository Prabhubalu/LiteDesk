<template>
  <li>
    <button
      type="button"
      class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors"
      :class="[
        ui.hoverRow,
        selectedId === node.id ? ui.selectedBg : '',
        depth > 0 ? 'ml-3' : ''
      ]"
      :style="{ paddingLeft: `${8 + depth * 12}px` }"
      @click="emit('select', node.id)"
    >
      <span class="font-mono uppercase text-neutral-400">{{ node.tag }}</span>
      <span class="truncate">{{ node.label }}</span>
    </button>
    <ul v-if="node.children?.length" class="space-y-1">
      <LayersTreeNode
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :depth="depth + 1"
        :selected-id="selectedId"
        @select="emit('select', $event)"
      />
    </ul>
  </li>
</template>

<script setup>
import { useBuilderUi } from '@/composables/useBuilderUi';

defineProps({
  node: { type: Object, required: true },
  depth: { type: Number, default: 0 },
  selectedId: { type: String, default: '' }
});

const emit = defineEmits(['select']);
const ui = useBuilderUi();
</script>

<script>
export default {
  name: 'LayersTreeNode'
};
</script>
