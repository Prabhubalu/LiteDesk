<template>
  <div class="pointer-events-none absolute inset-0">
    <button
      v-for="handle in handles"
      :key="handle.id"
      type="button"
      class="pointer-events-auto absolute z-20 h-2.5 w-2.5 rounded-sm border border-white bg-primary-500 shadow-sm"
      :class="handle.className"
      :aria-label="handle.id"
      @mousedown.stop.prevent="emit('start', handle.id, $event)"
    />
  </div>
</template>

<script setup>
const emit = defineEmits(['start']);

const handles = [
  { id: 'nw', className: '-left-1.5 -top-1.5 cursor-nwse-resize' },
  { id: 'n', className: 'left-1/2 -top-1.5 -translate-x-1/2 cursor-ns-resize' },
  { id: 'ne', className: '-right-1.5 -top-1.5 cursor-nesw-resize' },
  { id: 'e', className: '-right-1.5 top-1/2 -translate-y-1/2 cursor-ew-resize' },
  { id: 'se', className: '-bottom-1.5 -right-1.5 cursor-nwse-resize' },
  { id: 's', className: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 cursor-ns-resize' },
  { id: 'sw', className: '-bottom-1.5 -left-1.5 cursor-nesw-resize' },
  { id: 'w', className: '-left-1.5 top-1/2 -translate-y-1/2 cursor-ew-resize' }
];
</script>
