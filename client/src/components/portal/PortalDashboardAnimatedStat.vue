<template>
  <span>{{ animated }}</span>
</template>

<script setup>
import { toRef } from 'vue';
import { useAnimatedCount } from '@/composables/useAnimatedCount';

const props = defineProps({
  value: {
    type: Number,
    default: 0
  }
});

const animated = useAnimatedCount(toRef(props, 'value'));
</script>
