<template>
  <div
    class="relative inline-block max-w-full"
    :style="{ width: `${width}px`, height: `${height}px` }"
    @click.stop="emit('select', nodeId)"
  >
    <img
      v-if="src"
      :src="src"
      :alt="alt"
      class="h-full w-full rounded-md object-cover"
      draggable="false"
    />
    <div
      v-else
      class="flex h-full w-full flex-col items-center justify-center rounded-md border border-dashed border-neutral-300 bg-neutral-50 text-xs text-neutral-500"
    >
      <PhotoIcon class="mb-1 h-8 w-8 opacity-50" />
      <span>{{ t('templates.builderImageDropHint') }}</span>
    </div>

    <div
      v-if="isSelected"
      class="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize rounded-tl-md bg-primary-600"
      @mousedown.stop="startResize"
    />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { PhotoIcon } from '@heroicons/vue/24/outline';

const props = defineProps({
  nodeId: { type: String, required: true },
  node: { type: Object, required: true },
  isSelected: { type: Boolean, default: false }
});

const emit = defineEmits(['select', 'patch']);

const { t } = useI18n();

const width = computed(() => Number(props.node?.layout?.width || 240));
const height = computed(() => Number(props.node?.layout?.height || 160));
const src = computed(() => String(props.node?.bindings?.src || ''));
const alt = computed(() => String(props.node?.bindings?.alt || ''));

const resizing = ref(false);
let startX = 0;
let startY = 0;
let startWidth = 0;
let startHeight = 0;

function startResize(event) {
  resizing.value = true;
  startX = event.clientX;
  startY = event.clientY;
  startWidth = width.value;
  startHeight = height.value;
  window.addEventListener('mousemove', onResizeMove);
  window.addEventListener('mouseup', onResizeEnd);
}

function onResizeMove(event) {
  if (!resizing.value) return;
  const nextWidth = Math.max(80, startWidth + (event.clientX - startX));
  const nextHeight = Math.max(60, startHeight + (event.clientY - startY));
  emit('patch', {
    nodeId: props.nodeId,
    patch: {
      layout: {
        ...(props.node.layout || {}),
        width: Math.round(nextWidth),
        height: Math.round(nextHeight)
      }
    }
  });
}

function onResizeEnd() {
  resizing.value = false;
  window.removeEventListener('mousemove', onResizeMove);
  window.removeEventListener('mouseup', onResizeEnd);
}

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', onResizeMove);
  window.removeEventListener('mouseup', onResizeEnd);
});
</script>
