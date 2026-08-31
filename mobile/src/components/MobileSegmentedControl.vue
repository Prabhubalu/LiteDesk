<script setup lang="ts">
import { computed } from 'vue'

type SegmentOption = {
  id: string
  label: string
}

const props = defineProps<{
  modelValue: string
  options: SegmentOption[]
}>()

defineEmits<{
  'update:modelValue': [id: string]
}>()

const activeIndex = computed(() => {
  const index = props.options.findIndex((option) => option.id === props.modelValue)
  return index < 0 ? 0 : index
})
</script>

<template>
  <div
    class="segments"
    role="tablist"
    :style="{
      '--segment-count': String(options.length),
      '--segment-index': String(activeIndex)
    }"
  >
    <span class="segments__thumb" aria-hidden="true" />
    <button
      v-for="option in options"
      :key="option.id"
      type="button"
      role="tab"
      class="segments__btn"
      :class="{ 'is-active': modelValue === option.id }"
      :aria-selected="modelValue === option.id"
      @click="$emit('update:modelValue', option.id)"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<style scoped>
.segments {
  --segment-gap: 0.2rem;
  --segment-inset: 0.2rem;
  position: relative;
  display: grid;
  grid-template-columns: repeat(var(--segment-count, 2), minmax(0, 1fr));
  gap: var(--segment-gap);
  padding: var(--segment-inset);
  border-radius: 12px;
  background: var(--bg-soft);
}

.segments__thumb {
  position: absolute;
  top: var(--segment-inset);
  bottom: var(--segment-inset);
  left: var(--segment-inset);
  width: calc(
    (100% - (var(--segment-inset) * 2) - (var(--segment-gap) * (var(--segment-count) - 1))) /
      var(--segment-count)
  );
  border-radius: 10px;
  background: var(--bg-elevated);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
  transform: translateX(calc(var(--segment-index) * (100% + var(--segment-gap))));
  transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
  pointer-events: none;
}

.segments__btn {
  position: relative;
  z-index: 1;
  border: none;
  border-radius: 10px;
  padding: 0.55rem 0.7rem;
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: 0.88rem;
  font-weight: 650;
  transition: color 180ms ease;
}

.segments__btn.is-active {
  color: var(--text);
}

@media (prefers-reduced-motion: reduce) {
  .segments__thumb,
  .segments__btn {
    transition: none;
  }
}
</style>
