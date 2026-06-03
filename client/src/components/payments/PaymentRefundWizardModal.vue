<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    @click.self="close"
  >
    <div class="w-full max-w-3xl rounded-lg bg-white dark:bg-gray-900 shadow-xl border border-gray-200 dark:border-gray-700">
      <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">
          {{ t('records.paymentRefundWizardTitle') }}
        </h3>
        <button type="button" class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300" @click="close">×</button>
      </div>

      <div class="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <div class="text-xs text-gray-500">{{ t('records.paymentMaxRefundable') }}</div>
            <div class="font-medium tabular-nums">{{ formatMoney(eligibility?.maxRefundable) }}</div>
          </div>
          <div>
            <div class="text-xs text-gray-500">{{ t('records.paymentAmountUnallocated') }}</div>
            <div class="font-medium tabular-nums">{{ formatMoney(eligibility?.amountUnallocated) }}</div>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label class="block text-sm">
            <span class="text-gray-700 dark:text-gray-200">{{ t('records.paymentRefundAmount') }}</span>
            <input
              v-model.number="refundAmount"
              type="number"
              min="0"
              step="0.01"
              class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1.5"
            />
          </label>
          <label class="block text-sm">
            <span class="text-gray-700 dark:text-gray-200">{{ t('records.paymentRefundReason') }}</span>
            <select
              v-model="reason"
              class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1.5"
            >
              <option value="">{{ t('records.paymentRefundReasonSelect') }}</option>
              <option v-for="r in refundReasons" :key="r" :value="r">
                {{ t(`records.paymentRefundReason_${r}`) }}
              </option>
            </select>
          </label>
          <label class="block text-sm sm:col-span-2">
            <span class="text-gray-700 dark:text-gray-200">{{ t('records.paymentRefundReasonNote') }}</span>
            <input
              v-model="reasonNote"
              type="text"
              class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1.5"
            />
          </label>
        </div>

        <label
          v-if="Number(eligibility?.amountUnallocated) > 0"
          class="block text-sm"
        >
          <span class="text-gray-700 dark:text-gray-200">{{ t('records.paymentRefundUnallocatedPortion') }}</span>
          <input
            v-model.number="unallocatedPortion"
            type="number"
            min="0"
            :max="eligibility?.amountUnallocated"
            step="0.01"
            class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1.5"
          />
        </label>

        <div v-if="eligibility?.activeAllocations?.length" class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table class="min-w-full text-sm">
            <thead class="text-xs uppercase text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/60">
              <tr>
                <th class="px-3 py-2 text-left w-10"></th>
                <th class="px-3 py-2 text-left">{{ t('records.paymentAllocationInvoice') }}</th>
                <th class="px-3 py-2 text-right">{{ t('records.paymentAllocationAmount') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in eligibility.activeAllocations"
                :key="row.paymentAllocationId"
                class="border-t border-gray-100 dark:border-gray-800"
              >
                <td class="px-3 py-2">
                  <input
                    v-model="selectedAllocationIds"
                    type="checkbox"
                    :value="row.paymentAllocationId"
                    class="rounded border-gray-300 dark:border-gray-600"
                  />
                </td>
                <td class="px-3 py-2">{{ row.invoiceNumber || row.invoiceId }}</td>
                <td class="px-3 py-2 text-right tabular-nums">{{ formatMoney(row.amountApplied) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p v-if="amountMismatch" class="text-sm text-amber-600 dark:text-amber-400">
          {{ t('records.paymentRefundAmountMismatch') }}
        </p>
      </div>

      <div class="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
        <button
          type="button"
          class="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm"
          :disabled="busy"
          @click="close"
        >
          {{ t('records.cancelAction') }}
        </button>
        <button
          type="button"
          class="rounded-md bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 text-sm disabled:opacity-50"
          :disabled="busy || !canSubmit"
          @click="submit"
        >
          {{ t('records.paymentRefundSubmit') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { useNotifications } from '@/composables/useNotifications';

const props = defineProps({
  open: { type: Boolean, default: false },
  paymentMongoId: { type: String, default: null }
});

const emit = defineEmits(['close', 'completed']);

const { t } = useI18n();
const notifications = useNotifications();
const busy = ref(false);
const eligibility = ref(null);
const refundAmount = ref(0);
const unallocatedPortion = ref(0);
const reason = ref('');
const reasonNote = ref('');
const selectedAllocationIds = ref([]);

const refundReasons = [
  'customer_request',
  'duplicate_payment',
  'overpayment',
  'credit_note_settlement',
  'billing_error',
  'service_cancellation',
  'chargeback_resolution',
  'other'
];

const selectedAllocationTotal = computed(() => {
  const ids = new Set(selectedAllocationIds.value.map(String));
  return (eligibility.value?.activeAllocations || [])
    .filter((row) => ids.has(String(row.paymentAllocationId)))
    .reduce((sum, row) => sum + (Number(row.amountApplied) || 0), 0);
});

const amountMismatch = computed(() => {
  const total = round2(Number(unallocatedPortion.value) + selectedAllocationTotal.value);
  return Math.abs(total - round2(refundAmount.value)) > 0.001;
});

const canSubmit = computed(() => {
  if (!reason.value) return false;
  if (reason.value === 'other' && !String(reasonNote.value).trim()) return false;
  if (Number(refundAmount.value) <= 0) return false;
  if (amountMismatch.value) return false;
  return Number(refundAmount.value) <= Number(eligibility.value?.maxRefundable || 0);
});

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function formatMoney(value) {
  const n = Number(value) || 0;
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function close() {
  if (busy.value) return;
  emit('close');
}

async function loadEligibility() {
  if (!props.paymentMongoId) return;
  try {
    const res = await apiClient.get(`/payments/${props.paymentMongoId}/refund-eligibility`);
    if (res?.success) eligibility.value = res.data;
  } catch {
    eligibility.value = null;
  }
}

async function submit() {
  if (!canSubmit.value || !props.paymentMongoId) return;
  busy.value = true;
  try {
    const res = await apiClient.post(`/payments/${props.paymentMongoId}/refunds`, {
      amount: round2(refundAmount.value),
      reason: reason.value,
      reasonNote: reasonNote.value || null,
      unallocatedPortion: round2(unallocatedPortion.value),
      unwindAllocationIds: [...selectedAllocationIds.value]
    });
    if (!res?.success) throw new Error(res?.message || 'Refund failed');
    notifications.success(t('records.paymentRefundSuccess'));
    emit('completed', res.data);
    close();
  } catch (err) {
    notifications.error(err?.message || t('records.paymentRefundFailed'));
  } finally {
    busy.value = false;
  }
}

watch(
  () => [props.open, props.paymentMongoId],
  () => {
    if (!props.open) return;
    selectedAllocationIds.value = [];
    reason.value = '';
    reasonNote.value = '';
    unallocatedPortion.value = 0;
    refundAmount.value = 0;
    loadEligibility();
  },
  { immediate: true }
);

watch(selectedAllocationIds, () => {
  refundAmount.value = round2(Number(unallocatedPortion.value) + selectedAllocationTotal.value);
}, { deep: true });

watch(unallocatedPortion, () => {
  refundAmount.value = round2(Number(unallocatedPortion.value) + selectedAllocationTotal.value);
});
</script>
