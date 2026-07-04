<template>
  <div class="mb-5">
    <h2 :class="rbTitle">{{ title }}</h2>
    <p v-if="subtitle" :class="rbSubtitle">{{ subtitle }}</p>
  </div>
</template>

<script setup lang="ts">
import { rbSubtitle, rbTitle } from '@/components/analytics/report-builder/reportBuilderUi';

defineProps<{
  title: string;
  subtitle?: string;
}>();
</script>
