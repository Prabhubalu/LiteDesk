<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
    <div class="max-w-md w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 text-center space-y-3">
      <h1 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
        {{ t('records.paymentLinkReturnTitle') }}
      </h1>
      <p class="text-sm text-gray-500">{{ statusMessage }}</p>
      <p
        v-if="session?.status === 'succeeded'"
        class="text-sm text-green-600 dark:text-green-400"
      >
        {{ t('records.paymentLinkReturnSuccess') }}
      </p>
      <p
        v-if="session?.status === 'failed'"
        class="text-sm text-red-600 dark:text-red-400"
      >
        {{ session.failureMessage || t('records.paymentLinkReturnFailed') }}
      </p>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';

const route = useRoute();
const { t } = useI18n();
const session = ref(null);

const statusMessage = computed(() => {
  const s = session.value?.status;
  if (s === 'succeeded') return t('records.paymentLinkStatusSucceeded');
  if (s === 'failed') return t('records.paymentLinkStatusFailed');
  if (s === 'pending' || s === 'processing') return t('records.paymentLinkStatusPending');
  return t('records.paymentLinkStatusPending');
});

onMounted(() => {
  // Public return page — payment confirmation is via webhook; show pending message only.
  session.value = { status: route.query.cancelled ? 'canceled' : 'pending' };
});
</script>
