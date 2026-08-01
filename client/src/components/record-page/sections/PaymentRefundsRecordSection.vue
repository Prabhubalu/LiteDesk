<template>
  <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
    <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
      <div>
        <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ t('records.paymentRefundsTitle') }}</h3>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ t('records.paymentRefundsHint') }}</p>
      </div>
      <button
        v-if="canRefund"
        type="button"
        class="rounded-md bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 text-sm"
        @click="showWizard = true"
      >
        {{ t('records.paymentIssueRefund') }}
      </button>
    </div>

    <div v-if="refunds.length" class="overflow-x-auto">
      <table class="min-w-full text-sm">
        <thead class="text-xs uppercase text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/60">
          <tr>
            <th class="px-3 py-2 text-left">{{ t('records.paymentRefundNumber') }}</th>
            <th class="px-3 py-2 text-left">{{ t('records.paymentRefundReason') }}</th>
            <th class="px-3 py-2 text-right">{{ t('records.paymentRefundAmount') }}</th>
            <th class="px-3 py-2 text-left">{{ t('records.status') }}</th>
            <th class="px-3 py-2 text-left">{{ t('records.paymentRefundDate') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in refunds"
            :key="row.refundId"
            class="border-t border-gray-100 dark:border-gray-800"
          >
            <td class="px-3 py-2 font-medium">{{ row.refundNumber }}</td>
            <td class="px-3 py-2">{{ formatReason(row.reason) }}</td>
            <td class="px-3 py-2 text-right tabular-nums">{{ formatMoney(row.amount) }}</td>
            <td class="px-3 py-2">{{ row.status }}</td>
            <td class="px-3 py-2">{{ formatDate(row.refundDate) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else class="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">
      {{ t('records.paymentRefundsEmpty') }}
    </div>

    <PaymentRefundWizardModal
      :open="showWizard"
      :payment-mongo-id="record?._id"
      @close="showWizard = false"
      @completed="handleRefundCompleted"
    />
  </div>
</template>

<script setup>
import { computed, ref, watch, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import apiClient from '@/utils/apiClient';
import PaymentRefundWizardModal from '@/components/payments/PaymentRefundWizardModal.vue';
import { formatUserDate } from '@/utils/localeFormat';
import { formatCurrencyValue } from '@/utils/currencyOptions';

const props = defineProps({
  record: { type: Object, default: null },
  context: { type: Object, default: () => ({}) }
});

const { t } = useI18n();
const auth = useAuthStore();
const showWizard = ref(false);
const refunds = ref([]);

const canRefund = computed(() => {
  if (auth.isOwner) return true;
  return auth.can('payments', 'refund');
});

function formatMoney(value) {
  return formatCurrencyValue(value, { currencyCode: props.record?.currency }) ?? '—';
}

function formatDate(value) {
  if (!value) return '—';
  return formatUserDate(value) || '—';
}

function formatReason(reason) {
  if (!reason) return '—';
  const key = `records.paymentRefundReason_${reason}`;
  const translated = t(key);
  return translated !== key ? translated : reason;
}

async function loadRefunds() {
  if (!props.record?._id) return;
  try {
    const res = await apiClient.get(`/payments/${props.record._id}/refunds`);
    if (res?.success) refunds.value = res.data || [];
  } catch {
    refunds.value = [];
  }
}

function handleRefundCompleted() {
  showWizard.value = false;
  loadRefunds();
  props.context?.onSectionUpdated?.({ sectionKey: 'refunds', payload: { type: 'refund-completed' } });
  props.context?.onSectionUpdated?.({ sectionKey: 'allocations', payload: { type: 'refund-completed' } });
}

function onOpenRefund(event) {
  if (String(event?.detail?.paymentMongoId || '') === String(props.record?._id || '')) {
    showWizard.value = true;
  }
}

watch(() => props.record?._id, loadRefunds, { immediate: true });

onMounted(() => {
  window.addEventListener('litedesk:payment-open-refund', onOpenRefund);
});

onUnmounted(() => {
  window.removeEventListener('litedesk:payment-open-refund', onOpenRefund);
});
</script>
