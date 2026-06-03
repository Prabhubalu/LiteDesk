<template>
  <div class="space-y-4">
    <div>
      <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">{{ t('records.portalInvoicesTitle') }}</h2>
      <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('records.portalInvoicesHint') }}</p>
    </div>

    <div v-if="loading" class="text-sm text-gray-500">{{ t('records.portalInvoicesLoading') }}</div>

    <div v-else-if="!invoices.length" class="text-sm text-gray-500">{{ t('records.portalInvoicesEmpty') }}</div>

    <div v-else class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
      <table class="min-w-full text-sm">
        <thead class="bg-gray-50 dark:bg-gray-800/60 text-xs uppercase text-gray-500">
          <tr>
            <th class="px-3 py-2 text-left">{{ t('records.portalInvoiceNumber') }}</th>
            <th class="px-3 py-2 text-left">{{ t('records.portalInvoiceDue') }}</th>
            <th class="px-3 py-2 text-right">{{ t('records.invoiceAmountDue') }}</th>
            <th class="px-3 py-2 text-right">{{ t('records.portalPayNow') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in invoices"
            :key="row._id"
            class="border-t border-gray-100 dark:border-gray-800"
          >
            <td class="px-3 py-2 font-medium">{{ row.invoiceNumber }}</td>
            <td class="px-3 py-2">{{ formatDate(row.dueDate) }}</td>
            <td class="px-3 py-2 text-right tabular-nums">{{ formatMoney(row.amountDue, row.currency) }}</td>
            <td class="px-3 py-2 text-right">
              <button
                type="button"
                class="rounded-md bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 text-xs disabled:opacity-50"
                :disabled="busyId === row._id"
                @click="payNow(row)"
              >
                {{ t('records.portalPayNow') }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import portalApiClient from '@/utils/portalApiClient';
import { useNotifications } from '@/composables/useNotifications';

const { t } = useI18n();
const notifications = useNotifications();
const loading = ref(true);
const invoices = ref([]);
const busyId = ref('');

function formatDate(v) {
  if (!v) return '—';
  return new Date(v).toLocaleDateString();
}

function formatMoney(amount, currency = 'USD') {
  return (Number(amount) || 0).toLocaleString(undefined, {
    style: 'currency',
    currency: currency || 'USD'
  });
}

async function loadInvoices() {
  loading.value = true;
  try {
    const res = await portalApiClient.get('/invoices');
    invoices.value = res?.data || [];
  } catch (err) {
    notifications.error(err?.message || t('records.portalInvoicesLoadFailed'));
    invoices.value = [];
  } finally {
    loading.value = false;
  }
}

async function payNow(invoice) {
  busyId.value = invoice._id;
  try {
    const origin = window.location.origin;
    const res = await portalApiClient.post(`/invoices/${invoice._id}/pay`, {
      successUrl: `${origin}/portal/invoices/return?invoiceId=${invoice._id}`,
      cancelUrl: `${origin}/portal/invoices`
    });
    if (!res?.success || !res.data?.checkoutUrl) {
      throw new Error(res?.message || t('records.portalPayFailed'));
    }
    window.location.href = res.data.checkoutUrl;
  } catch (err) {
    notifications.error(err?.message || t('records.portalPayFailed'));
    busyId.value = '';
  }
}

onMounted(loadInvoices);
</script>
