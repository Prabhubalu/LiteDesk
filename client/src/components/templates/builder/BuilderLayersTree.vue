<template>
  <draggable
    v-model="localNodes"
    item-key="id"
    handle=".layer-drag-handle"
    :group="`layers-${parentId}`"
    class="space-y-0.5"
    ghost-class="opacity-40"
    @start="isDragging = true"
    @end="onDragEnd"
  >
    <template #item="{ element }">
      <div>
        <div
          class="group flex items-center gap-1 rounded-md pr-1 text-sm transition-colors"
          :class="isSelected(element.id)
            ? [ui.selectedBg, 'text-primary-700 dark:text-primary-300']
            : [ui.textSubtle, ui.hoverRow, isNodeHidden(element) ? 'opacity-50' : '']"
          :style="{ paddingLeft: `${8 + depth * 12}px` }"
        >
          <button
            type="button"
            class="layer-drag-handle shrink-0 cursor-grab rounded p-0.5 text-neutral-400 opacity-0 group-hover:opacity-100 active:cursor-grabbing"
            :class="isSelected(element.id) ? 'opacity-100' : ''"
            :title="t('templates.builderDragHandle')"
            @click.stop
          >
            <Bars3Icon class="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            class="min-w-0 flex-1 truncate py-1.5 text-left"
            @click="emit('select', element.id, $event)"
          >
            <span class="font-medium">{{ element.type }}</span>
            <span v-if="element.name" class="ml-2 text-meta" :class="ui.textMuted">{{ element.name }}</span>
          </button>

          <div
            class="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100"
            :class="isSelected(element.id) ? 'opacity-100' : ''"
          >
            <button
              type="button"
              :class="ui.btnIcon"
              :title="t('templates.builderDuplicate')"
              @click.stop="emit('duplicate', element.id)"
            >
              <DocumentDuplicateIcon class="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              :class="ui.btnIcon"
              :title="isNodeHidden(element) ? t('templates.builderShowLayer') : t('templates.builderHideLayer')"
              @click.stop="emit('toggle-hidden', element.id)"
            >
              <EyeIcon v-if="!isNodeHidden(element)" class="h-3.5 w-3.5" />
              <EyeSlashIcon v-else class="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              :class="ui.btnIcon"
              :title="isNodeLocked(element) ? t('templates.builderUnlockLayer') : t('templates.builderLockLayer')"
              @click.stop="emit('toggle-locked', element.id)"
            >
              <LockOpenIcon v-if="!isNodeLocked(element)" class="h-3.5 w-3.5" />
              <LockClosedIcon v-else class="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <BuilderLayersTree
          v-if="element.children?.length"
          :parent-id="element.id"
          :nodes="element.children"
          :selected-ids="selectedIds"
          :depth="depth + 1"
          @select="(id, event) => emit('select', id, event)"
          @reorder="emit('reorder', $event)"
          @duplicate="emit('duplicate', $event)"
          @toggle-hidden="emit('toggle-hidden', $event)"
          @toggle-locked="emit('toggle-locked', $event)"
        />
      </div>
    </template>
  </draggable>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import draggable from 'vuedraggable';
import {
  Bars3Icon,
  DocumentDuplicateIcon,
  EyeIcon,
  EyeSlashIcon,
  LockClosedIcon,
  LockOpenIcon
} from '@heroicons/vue/24/outline';
import { isNodeHidden, isNodeLocked } from '@/utils/templateBuilderTree';
import { useBuilderUi } from '@/composables/useBuilderUi';

const props = defineProps({
  parentId: { type: String, required: true },
  nodes: { type: Array, default: () => [] },
  selectedIds: { type: Array, default: () => [] },
  depth: { type: Number, default: 0 }
});

const emit = defineEmits(['select', 'reorder', 'duplicate', 'toggle-hidden', 'toggle-locked']);

const { t } = useI18n();
const ui = useBuilderUi();
const localNodes = ref([]);
const isDragging = ref(false);

function isSelected(nodeId) {
  return props.selectedIds.includes(nodeId);
}

watch(
  () => props.nodes,
  () => {
    if (isDragging.value) return;
    localNodes.value = Array.isArray(props.nodes) ? [...props.nodes] : [];
  },
  { immediate: true, deep: true }
);

function onDragEnd() {
  isDragging.value = false;
  const orderedIds = localNodes.value.map((node) => node.id);
  const currentIds = props.nodes.map((node) => node.id);
  if (orderedIds.join('|') === currentIds.join('|')) return;
  emit('reorder', { parentId: props.parentId, orderedIds });
}
</script>
