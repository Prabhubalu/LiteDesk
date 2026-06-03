<template>
  <section v-if="record?._id" class="space-y-3 text-sm">
    <div v-if="loading" class="text-gray-500 dark:text-gray-400">{{ t('states.loading') }}</div>
    <template v-else-if="coverage">
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
        <div class="rounded-md border border-gray-200 dark:border-gray-700 px-3 py-2">
          <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('records.salesOrderTotalBilled') }}</div>
          <div class="font-medium tabular-nums">{{ formatMoney(coverage.totalBilled) }}</div>
        </div>
        <div class="rounded-md border border-gray-200 dark:border-gray-700 px-3 py-2">
          <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('records.salesOrderRemainingToBill') }}</div>
          <div class="font-medium tabular-nums">{{ formatMoney(coverage.remainingToBill) }}</div>
        </div>
        <div class="rounded-md border border-gray-200 dark:border-gray-700 px-3 py-2">
          <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('records.salesOrderInvoiceStatus') }}</div>
          <div class="font-medium capitalize">{{ formatInvoiceStatus(coverage.invoiceStatus) }}</div>
        </div>
        <div class="rounded-md border border-gray-200 dark:border-gray-700 px-3 py-2">
          <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('records.salesOrderLinkedInvoicesCount') }}</div>
          <div class="font-medium tabular-nums">{{ (coverage.linkedInvoices || []).length }}</div>
        </div>
      </div>

      <div v-if="(coverage.linkedInvoices || []).length" class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table class="min-w-full text-sm">
          <thead class="text-xs uppercase text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/60">
            <tr>
              <th class="px-3 py-2 text-left">{{ t('records.salesOrderLinkedInvoiceNumber') }}</th>
              <th class="px-3 py-2 text-left">{{ t('records.salesOrderLinkedInvoiceStatus') }}</th>
              <th class="px-3 py-2 text-right">{{ t('records.salesOrderLinkedInvoiceTotal') }}</th>
              <th class="px-3 py-2 text-right">{{ t('records.salesOrderLinkedInvoiceDue') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="invoice in coverage.linkedInvoices"
              :key="invoice.invoiceId"
              class="border-t border-gray-100 dark:border-gray-800"
            >
              <td class="px-3 py-2 font-medium">
                <router-link
                  v-if="invoice.invoiceMongoId"
                  :to="`/invoices/${invoice.invoiceMongoId}`"
                  class="text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  {{ invoice.invoiceNumber }}
                </router-link>
                <span v-else>{{ invoice.invoiceNumber }}</span>
              </td>
              <td class="px-3 py-2 capitalize">{{ invoice.status }}</td>
              <td class="px-3 py-2 text-right tabular-nums">{{ formatMoney(invoice.grandTotal) }}</td>
              <td class="px-3 py-2 text-right tabular-nums">{{ formatMoney(invoice.amountDue) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="text-xs text-gray-500 dark:text-gray-400">{{ t('records.salesOrderNoLinkedInvoices') }}</p>
    </template>
  </section>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { formatQuoteMoney } from '@/utils/quoteMoney';

const props = defineProps({
  record: { type: Object, default: null },
  context: { type: Object, default: () => ({}) }
});

const { t } = useI18n();
const loading = ref(false);
const coverage = ref(null);

function formatMoney(value) {
  return formatQuoteMoney(value, coverage.value?.currency || props.record?.currency || 'USD');
}

function formatInvoiceStatus(value) {
  return String(value || 'not_invoiced').replace(/_/g, ' ');
}

async function loadCoverage() {
  if (!props.record?._id) return;
  loading.value = true;
  try {
    const res = await apiClient.get(`/sales-orders/${props.record._id}/billing-coverage`);
    coverage.value = res?.success ? res.data : null;
  } catch {
    coverage.value = null;
  } finally {
    loading.value = false;
  }
}

onMounted(loadCoverage);
watch(() => String(props.record?._id || ''), loadCoverage);
watch(
  () => props.context?.billingRefreshToken,
  () => loadCoverage()
);
</script>
