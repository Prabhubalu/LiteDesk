<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    @click.self="close"
  >
    <div class="w-full max-w-lg rounded-lg bg-white dark:bg-gray-900 shadow-xl border border-gray-200 dark:border-gray-700">
      <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">
          {{ t('records.paymentRecordTitle') }}
        </h3>
        <button type="button" class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300" @click="close">×</button>
      </div>

      <div class="p-4 space-y-3">
        <label class="block text-sm">
          <span class="text-gray-700 dark:text-gray-200">{{ t('records.paymentAmount') }}</span>
          <input v-model.number="form.amount" type="number" min="0.01" step="0.01" class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1.5" />
        </label>
        <label class="block text-sm">
          <span class="text-gray-700 dark:text-gray-200">{{ t('records.paymentCurrency') }}</span>
          <input v-model="form.paymentCurrency" type="text" class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1.5" />
        </label>
        <label class="block text-sm">
          <span class="text-gray-700 dark:text-gray-200">{{ t('records.paymentDate') }}</span>
          <input v-model="form.paymentDate" type="date" class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1.5" />
        </label>
        <label class="block text-sm">
          <span class="text-gray-700 dark:text-gray-200">{{ t('records.paymentPurpose') }}</span>
          <select v-model="form.paymentPurpose" class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1.5">
            <option value="invoice_payment">{{ t('records.paymentPurpose_invoice_payment') }}</option>
            <option value="deposit">{{ t('records.paymentPurpose_deposit') }}</option>
            <option value="retainer">{{ t('records.paymentPurpose_retainer') }}</option>
            <option value="on_account">{{ t('records.paymentPurpose_on_account') }}</option>
          </select>
        </label>
        <label class="block text-sm">
          <span class="text-gray-700 dark:text-gray-200">{{ t('records.paymentMethod') }}</span>
          <select v-model="form.method" class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1.5">
            <option value="cash">Cash</option>
            <option value="check">Check</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="card">Card</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label class="block text-sm">
          <span class="text-gray-700 dark:text-gray-200">{{ t('records.paymentReferenceNumber') }}</span>
          <input v-model="form.referenceNumber" type="text" class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1.5" />
        </label>
        <label class="inline-flex items-center gap-2 text-sm">
          <input v-model="form.autoApply" type="checkbox" class="rounded border-gray-300 dark:border-gray-600" />
          {{ t('records.paymentAutoApply') }}
        </label>
      </div>

      <div class="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
        <button type="button" class="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm" :disabled="busy" @click="close">
          {{ t('records.cancelAction') }}
        </button>
        <button type="button" class="rounded-md bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 text-sm disabled:opacity-50" :disabled="busy" @click="submit">
          {{ t('records.paymentRecordSubmit') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import apiClient from '@/utils/apiClient';
import { useNotifications } from '@/composables/useNotifications';

const props = defineProps({
  open: { type: Boolean, default: false },
  organizationRefId: { type: String, default: null }
});

const emit = defineEmits(['close', 'created']);

const { t } = useI18n();
const router = useRouter();
const notifications = useNotifications();
const busy = ref(false);

const form = reactive({
  amount: null,
  paymentCurrency: 'USD',
  paymentDate: new Date().toISOString().slice(0, 10),
  paymentPurpose: 'invoice_payment',
  method: 'other',
  referenceNumber: '',
  autoApply: true
});

function close() {
  if (busy.value) return;
  emit('close');
}

async function submit() {
  if (!props.organizationRefId) {
    notifications.error(t('records.paymentRecordAccountRequired'));
    return;
  }
  if (!(Number(form.amount) > 0)) {
    notifications.error(t('records.paymentRecordAmountRequired'));
    return;
  }
  busy.value = true;
  try {
    const res = await apiClient.post('/payments', {
      organizationRefId: props.organizationRefId,
      amount: form.amount,
      paymentCurrency: form.paymentCurrency,
      paymentDate: form.paymentDate,
      paymentPurpose: form.paymentPurpose,
      autoApply: form.autoApply,
      paymentInstrumentSnapshot: {
        method: form.method,
        referenceNumber: form.referenceNumber || null,
        provider: 'manual'
      }
    });
    if (!res?.success) throw new Error(res?.message || 'Failed');
    notifications.success(t('records.paymentRecordSuccess'));
    emit('created', res.data);
    close();
    const mongoId = res.data?.payment?._id;
    if (mongoId) router.push(`/payments/${mongoId}`);
  } catch (err) {
    notifications.error(err?.message || t('records.paymentRecordFailed'));
  } finally {
    busy.value = false;
  }
}

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return;
    form.amount = null;
    form.paymentDate = new Date().toISOString().slice(0, 10);
    form.autoApply = form.paymentPurpose === 'invoice_payment';
  }
);

watch(
  () => form.paymentPurpose,
  (purpose) => {
    form.autoApply = purpose === 'invoice_payment';
  }
);
</script>
