<template>
  <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
    <div>
      <h4 class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ t('records.bankTransferSectionTitle') }}</h4>
      <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('records.bankTransferSectionHint') }}</p>
    </div>

    <div v-if="loading" class="text-sm text-gray-500">{{ t('records.bankTransferLoading') }}</div>
    <div v-else-if="!instructions.length" class="text-sm text-gray-500">{{ t('records.bankTransferEmpty') }}</div>

    <div
      v-for="row in instructions"
      :key="row.bankTransferInstructionId"
      class="rounded-md border border-gray-200 dark:border-gray-700 p-3 text-sm space-y-1"
    >
      <div class="flex justify-between gap-2">
        <span class="text-gray-500">{{ t('records.bankTransferReference') }}</span>
        <span class="font-mono font-medium">{{ row.referenceCode }}</span>
      </div>
      <div class="flex justify-between gap-2">
        <span class="text-gray-500">{{ t('records.status') }}</span>
        <span>{{ row.status }}</span>
      </div>
      <div class="flex justify-between gap-2">
        <span class="text-gray-500">{{ t('records.paymentLinkAmount') }}</span>
        <span class="tabular-nums">{{ formatMoney(row.amount, row.currency) }}</span>
      </div>
      <p v-if="row.status === 'pending'" class="text-xs text-amber-600 pt-1">
        {{ t('records.bankTransferRecordHint') }}
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';

const props = defineProps({
  record: { type: Object, default: null }
});

const { t } = useI18n();
const loading = ref(false);
const instructions = ref([]);

function formatMoney(amount, currency = 'USD') {
  return (Number(amount) || 0).toLocaleString(undefined, {
    style: 'currency',
    currency: currency || 'USD'
  });
}

async function loadInstructions() {
  if (!props.record?._id) return;
  loading.value = true;
  try {
    const res = await apiClient.get('/bank-transfer-instructions', {
      params: { invoiceMongoId: props.record._id }
    });
    instructions.value = res?.data || [];
  } catch {
    instructions.value = [];
  } finally {
    loading.value = false;
  }
}

watch(() => props.record?._id, loadInstructions, { immediate: true });
</script>
