<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    @click.self="close"
  >
    <div class="w-full max-w-md rounded-lg bg-white dark:bg-gray-900 shadow-xl border border-gray-200 dark:border-gray-700">
      <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">
          {{ t('records.customerCreditApplyTitle') }}
        </h3>
        <button type="button" class="text-gray-500" @click="close">×</button>
      </div>

      <div class="p-4 space-y-3 text-sm">
        <div>
          <div class="text-xs text-gray-500">{{ t('records.invoiceAmountDue') }}</div>
          <div class="font-medium tabular-nums">{{ formatMoney(summary?.amountDue) }}</div>
        </div>
        <div>
          <div class="text-xs text-gray-500">{{ t('records.customerCreditAvailable') }}</div>
          <div class="font-medium tabular-nums">{{ formatMoney(summary?.availableCreditTotal) }}</div>
        </div>
        <label class="block">
          <span class="text-gray-700 dark:text-gray-200">{{ t('records.customerCreditApplyAmount') }}</span>
          <input
            v-model.number="amount"
            type="number"
            min="0"
            step="0.01"
            class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1.5"
          />
        </label>
        <label class="inline-flex items-center gap-2">
          <input v-model="autoApply" type="checkbox" class="rounded" />
          {{ t('records.customerCreditAutoApply') }}
        </label>
      </div>

      <div class="px-4 py-3 border-t flex justify-end gap-2">
        <button type="button" class="rounded-md border px-3 py-1.5 text-sm" @click="close">{{ t('records.cancelAction') }}</button>
        <button type="button" class="rounded-md bg-indigo-600 text-white px-3 py-1.5 text-sm disabled:opacity-50" :disabled="busy" @click="submit">
          {{ t('records.customerCreditApplySubmit') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { useNotifications } from '@/composables/useNotifications';

const props = defineProps({
  open: { type: Boolean, default: false },
  record: { type: Object, default: null },
  summary: { type: Object, default: null }
});

const emit = defineEmits(['close', 'applied']);

const { t } = useI18n();
const notifications = useNotifications();
const busy = ref(false);
const amount = ref(0);
const autoApply = ref(true);

function formatMoney(value) {
  return (Number(value) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function close() {
  if (busy.value) return;
  emit('close');
}

async function submit() {
  if (!props.record?._id) return;
  busy.value = true;
  try {
    const body = {
      autoApply: autoApply.value,
      invoiceMongoId: props.record._id
    };
    if (!autoApply.value) {
      body.amountApplied = amount.value;
    }

    const res = await apiClient.post('/customer-statements/credit-applications', body);
    if (!res?.success) throw new Error(res?.message || 'Failed');
    notifications.success(t('records.customerCreditApplySuccess'));
    emit('applied', res.data);
    close();
  } catch (err) {
    notifications.error(err?.message || t('records.customerCreditApplyFailed'));
  } finally {
    busy.value = false;
  }
}

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return;
    autoApply.value = true;
    amount.value = Math.min(
      Number(props.summary?.amountDue) || 0,
      Number(props.summary?.availableCreditTotal) || 0
    );
  }
);
</script>
