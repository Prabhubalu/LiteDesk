<template>
  <PortalPageShell
    :title="t('records.portalInvoicesTitle')"
    :subtitle="t('records.portalInvoicesHint')"
  >
    <div v-if="loading" class="space-y-3">
      <div v-for="i in 3" :key="i" class="h-24" :class="PLATFORM_HOME_SKELETON_CLASS" />
    </div>

    <div
      v-else-if="!invoices.length"
      :class="['p-10 text-center sm:p-12', PLATFORM_HOME_CARD_CLASS]"
    >
      <h3 class="text-lg font-medium text-neutral-900 dark:text-white">{{ t('records.portalInvoicesEmpty') }}</h3>
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="row in invoices"
        :key="row._id"
        class="flex flex-col gap-4 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between"
        :class="PLATFORM_HOME_CARD_CLASS"
      >
        <div class="min-w-0">
          <p class="text-xs font-mono text-neutral-500 dark:text-neutral-400">{{ row.invoiceNumber }}</p>
          <p class="mt-1 text-lg font-semibold tabular-nums text-neutral-900 dark:text-white">
            {{ formatMoney(row.amountDue, row.currency) }}
          </p>
          <p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            {{ t('cases.portalDashboardDueDate', { date: formatDate(row.dueDate) }) }}
          </p>
        </div>
        <button
          type="button"
          class="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          :disabled="busyId === row._id"
          @click="payNow(row)"
        >
          {{ t('records.portalPayNow') }}
        </button>
      </div>
    </div>
  </PortalPageShell>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import portalApiClient from '@/utils/portalApiClient';
import { useNotifications } from '@/composables/useNotifications';
import PortalPageShell from '@/components/portal/PortalPageShell.vue';
import { PLATFORM_HOME_CARD_CLASS, PLATFORM_HOME_SKELETON_CLASS } from '@/utils/platformHomeLayout';
import { formatUserDate } from '@/utils/localeFormat';
import { formatCurrencyValue } from '@/utils/currencyOptions';

const { t } = useI18n();
const notifications = useNotifications();
const loading = ref(true);
const invoices = ref([]);
const busyId = ref('');

function formatDate(v) {
  if (!v) return '—';
  return formatUserDate(v) || '—';
}

function formatMoney(amount, currency = 'USD') {
  return formatCurrencyValue(amount, { currencyCode: currency || undefined }) ?? '—';
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
