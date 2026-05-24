<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <RouterView />
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
// Platform Landing Layout
// This layout is minimal - no sidebar, no app switcher, no execution buttons
// Just a clean container for the Platform Home page
</script>

