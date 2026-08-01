<template>
  <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
    <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
      <div>
        <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ t('records.invoicePaymentsTitle') }}</h3>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ t('records.invoicePaymentsHint') }}</p>
      </div>
      <button
        v-if="canApplyCredit"
        type="button"
        class="rounded-md bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 text-sm"
        @click="showCreditModal = true"
      >
        {{ t('records.customerCreditApplySubmit') }}
      </button>
    </div>

    <div v-if="summary" class="px-4 py-3 grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm border-b border-gray-200 dark:border-gray-700">
      <div>
        <div class="text-xs text-gray-500">{{ t('records.invoiceAmountPaid') }}</div>
        <div class="font-medium tabular-nums">{{ formatMoney(summary.amountPaid) }}</div>
      </div>
      <div>
        <div class="text-xs text-gray-500">{{ t('records.customerCreditApplied') }}</div>
        <div class="font-medium tabular-nums">{{ formatMoney(summary.creditAppliedTotal) }}</div>
      </div>
      <div>
        <div class="text-xs text-gray-500">{{ t('records.invoiceAmountDue') }}</div>
        <div class="font-medium tabular-nums">{{ formatMoney(summary.amountDue) }}</div>
      </div>
      <div>
        <div class="text-xs text-gray-500">{{ t('records.invoiceTotalRefunded') }}</div>
        <div class="font-medium tabular-nums">{{ formatMoney(summary.totalRefunded) }}</div>
      </div>
      <div>
        <div class="text-xs text-gray-500">{{ t('records.status') }}</div>
        <div class="font-medium">{{ summary.paymentStatus || '—' }}</div>
      </div>
    </div>

    <div v-if="summary?.allocations?.length" class="overflow-x-auto border-b border-gray-200 dark:border-gray-700">
      <div class="px-4 py-2 text-xs font-semibold uppercase text-gray-500">{{ t('records.paymentAllocationsTitle') }}</div>
      <table class="min-w-full text-sm">
        <thead class="text-xs uppercase text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/60">
          <tr>
            <th class="px-3 py-2 text-left">{{ t('records.paymentNumber') }}</th>
            <th class="px-3 py-2 text-right">{{ t('records.paymentAllocationAmount') }}</th>
            <th class="px-3 py-2 text-left">{{ t('records.status') }}</th>
            <th class="px-3 py-2 text-left">{{ t('records.paymentAllocationAppliedAt') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in summary.allocations"
            :key="row.paymentAllocationId"
            class="border-t border-gray-100 dark:border-gray-800"
          >
            <td class="px-3 py-2">
              <router-link
                v-if="row.paymentMongoId"
                :to="`/payments/${row.paymentMongoId}`"
                class="text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                {{ row.paymentNumber || row.paymentId }}
              </router-link>
              <span v-else>{{ row.paymentId }}</span>
            </td>
            <td class="px-3 py-2 text-right tabular-nums">{{ formatMoney(row.amountApplied) }}</td>
            <td class="px-3 py-2">{{ row.status }}</td>
            <td class="px-3 py-2">{{ formatDate(row.appliedAt) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="summary?.creditApplications?.length" class="overflow-x-auto border-b border-gray-200 dark:border-gray-700">
      <div class="px-4 py-2 text-xs font-semibold uppercase text-gray-500">{{ t('records.customerCreditApplicationsTitle') }}</div>
      <table class="min-w-full text-sm">
        <thead class="text-xs uppercase text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/60">
          <tr>
            <th class="px-3 py-2 text-left">{{ t('records.customerCreditApplicationId') }}</th>
            <th class="px-3 py-2 text-right">{{ t('records.customerCreditApplyAmount') }}</th>
            <th class="px-3 py-2 text-left">{{ t('records.status') }}</th>
            <th class="px-3 py-2 text-left">{{ t('records.paymentAllocationAppliedAt') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in summary.creditApplications"
            :key="row.customerCreditApplicationId"
            class="border-t border-gray-100 dark:border-gray-800"
          >
            <td class="px-3 py-2 font-mono text-xs">{{ row.customerCreditApplicationId.slice(0, 8) }}…</td>
            <td class="px-3 py-2 text-right tabular-nums">{{ formatMoney(row.amountApplied) }}</td>
            <td class="px-3 py-2">{{ row.status }}</td>
            <td class="px-3 py-2">{{ formatDate(row.appliedAt) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="!summary?.allocations?.length && !summary?.creditApplications?.length" class="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">
      {{ t('records.invoicePaymentsEmpty') }}
    </div>

    <div v-if="summary?.refunds?.length" class="border-t border-gray-200 dark:border-gray-700">
      <div class="px-4 py-2 text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
        {{ t('records.invoicePaymentRefundsTitle') }}
      </div>
      <table class="min-w-full text-sm">
        <thead class="text-xs uppercase text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/60">
          <tr>
            <th class="px-3 py-2 text-left">{{ t('records.paymentRefundNumber') }}</th>
            <th class="px-3 py-2 text-left">{{ t('records.paymentRefundReason') }}</th>
            <th class="px-3 py-2 text-right">{{ t('records.paymentRefundAmount') }}</th>
            <th class="px-3 py-2 text-left">{{ t('records.paymentRefundDate') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in summary.refunds"
            :key="row.refundAllocationId"
            class="border-t border-gray-100 dark:border-gray-800"
          >
            <td class="px-3 py-2 font-medium">{{ row.refundNumber || row.refundId }}</td>
            <td class="px-3 py-2">{{ formatReason(row.reason) }}</td>
            <td class="px-3 py-2 text-right tabular-nums">{{ formatMoney(row.amountReversed) }}</td>
            <td class="px-3 py-2">{{ formatDate(row.refundDate) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <CustomerCreditApplyModal
      :open="showCreditModal"
      :record="record"
      :summary="summary"
      @close="showCreditModal = false"
      @applied="handleCreditApplied"
    />
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import apiClient from '@/utils/apiClient';
import CustomerCreditApplyModal from '@/components/payments/CustomerCreditApplyModal.vue';
import { formatUserDate } from '@/utils/localeFormat';
import { formatCurrencyValue } from '@/utils/currencyOptions';

const props = defineProps({
  record: { type: Object, default: null },
  context: { type: Object, default: () => ({}) }
});

const { t } = useI18n();
const auth = useAuthStore();
const summary = ref(null);
const showCreditModal = ref(false);

const canApplyCredit = computed(() => {
  if (!summary.value?.canApplyCredit) return false;
  if (auth.isOwner) return true;
  return auth.can('payments', 'applyCredit');
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

async function loadSummary() {
  if (!props.record?._id) return;
  if (String(props.record?.invoiceType || 'standard') === 'credit_note') return;
  try {
    const res = await apiClient.get(`/invoices/${props.record._id}/payment-summary`);
    if (res?.success) summary.value = res.data;
  } catch {
    summary.value = null;
  }
}

function handleCreditApplied() {
  showCreditModal.value = false;
  loadSummary();
  props.context?.onSectionUpdated?.({ sectionKey: 'payments', payload: { type: 'credit-applied' } });
}

watch(() => props.record?._id, loadSummary, { immediate: true });

watch(
  () => props.context?.lastSectionUpdate,
  () => loadSummary()
);
</script>
