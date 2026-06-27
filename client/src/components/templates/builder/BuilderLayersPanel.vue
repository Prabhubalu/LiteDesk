<template>
  <div>
    <div
      class="mb-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium"
      :class="[ui.textSubtle, selectedIds.includes(root.id) ? ui.selectedBg : '']"
    >
      <button type="button" class="flex-1 text-left" @click="emit('select', root.id, $event)">
        {{ root.type }}
        <span v-if="root.name" class="ml-2 text-meta" :class="ui.textMuted">{{ root.name }}</span>
      </button>
    </div>

    <BuilderLayersTree
      :parent-id="root.id"
      :nodes="root.children || []"
      :selected-ids="selectedIds"
      :depth="0"
      @select="(id, event) => emit('select', id, event)"
      @reorder="emit('reorder', $event)"
      @duplicate="emit('duplicate', $event)"
      @toggle-hidden="emit('toggle-hidden', $event)"
      @toggle-locked="emit('toggle-locked', $event)"
    />
  </div>
</template>

<script setup>
import BuilderLayersTree from '@/components/templates/builder/BuilderLayersTree.vue';
import { useBuilderUi } from '@/composables/useBuilderUi';

defineProps({
  root: { type: Object, required: true },
  selectedIds: { type: Array, default: () => [] }
});

const emit = defineEmits(['select', 'reorder', 'duplicate', 'toggle-hidden', 'toggle-locked']);

const ui = useBuilderUi();
</script>
