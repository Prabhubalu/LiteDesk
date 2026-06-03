<template>
  <div class="space-y-3 text-center py-8">
    <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">{{ t('records.portalPayReturnTitle') }}</h2>
    <p class="text-sm text-gray-500">{{ t('records.portalPayReturnHint') }}</p>
    <router-link to="/portal/invoices" class="text-indigo-600 hover:underline text-sm">
      {{ t('records.portalInvoicesBack') }}
    </router-link>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
</script>
