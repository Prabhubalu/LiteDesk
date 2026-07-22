<template>
  <img
    src="/assets/logo/Ai%20Logo.svg"
    alt=""
    :class="imgClass"
    decoding="async"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    size?: 'sm' | 'md' | 'lg' | 'hero';
  }>(),
  { size: 'md' },
);

const imgClass = computed(() => {
  if (props.size === 'sm') return 'h-5 w-5 object-contain';
  if (props.size === 'lg') return 'h-10 w-10 object-contain';
  if (props.size === 'hero') return 'h-16 w-16 object-contain drop-shadow-sm sm:h-20 sm:w-20';
  return 'h-7 w-7 object-contain';
});
</script>
