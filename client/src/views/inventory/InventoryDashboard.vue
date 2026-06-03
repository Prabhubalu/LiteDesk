<template>
  <div class="mx-auto max-w-3xl px-6 py-10">
    <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">
      {{ t('navigation.appInventory') }}
    </h1>
    <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
      {{ t('navigation.inventoryDashboardBlurb') }}
    </p>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>
