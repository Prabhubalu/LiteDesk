<template>
  <div class="settings-page-header">
    <h1 v-if="title" :class="SETTINGS_PAGE_TITLE_CLASS">{{ title }}</h1>
    <p v-if="subtitle" :class="SETTINGS_PAGE_SUBTITLE_CLASS">{{ subtitle }}</p>
    <slot />
  </div>
</template>

<script setup>
import {
  SETTINGS_PAGE_SUBTITLE_CLASS,
  SETTINGS_PAGE_TITLE_CLASS,
} from '@/components/settings/settingsSaveBar';

defineProps({
  title: {
    type: String,
    default: '',
  },
  subtitle: {
    type: String,
    default: '',
  },
});
</script>
