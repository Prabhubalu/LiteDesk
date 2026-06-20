<template>
  <component
    :is="iconMeta.icon"
    :class="[sizeClass, 'shrink-0', iconMeta.className]"
    aria-hidden="true"
  />
</template>

<script setup>
import { computed } from 'vue';
import { resolveDocumentTypeIcon } from '@/utils/documentTypeIcon';

const props = defineProps({
  doc: {
    type: Object,
    required: true
  },
  size: {
    type: String,
    default: 'md'
  }
});

const sizeClass = computed(() => {
  if (props.size === 'lg') return 'h-10 w-10';
  if (props.size === 'sm') return 'h-4 w-4';
  return 'h-5 w-5';
});

const iconMeta = computed(() => resolveDocumentTypeIcon(props.doc));
</script>
