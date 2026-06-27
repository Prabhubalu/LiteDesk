<template>
  <span>
    <template v-for="(segment, index) in segments" :key="index">
      <span v-if="segment.kind === 'text'">{{ segment.value }}</span>
      <span v-else :class="ui.mergePill">{{ segment.value }}</span>
    </template>
  </span>
</template>

<script setup>
import { computed } from 'vue';
import { useBuilderUi } from '@/composables/useBuilderUi';
import { parsePreviewSegments } from '@/utils/builderPreviewText';

const props = defineProps({
  text: { type: String, default: '' }
});

const ui = useBuilderUi();
const segments = computed(() => parsePreviewSegments(props.text));
</script>
