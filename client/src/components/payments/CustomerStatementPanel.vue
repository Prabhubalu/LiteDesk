<template>
  <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
    <div>
      <h4 class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ t('records.customerStatementTitle') }}</h4>
      <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ t('records.customerStatementHint') }}</p>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
      <label class="block">
        <span class="text-xs text-gray-500">{{ t('records.customerStatementFrom') }}</span>
        <input v-model="fromDate" type="date" class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1.5" />
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">{{ t('records.customerStatementTo') }}</span>
        <input v-model="toDate" type="date" class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1.5" />
      </label>
      <label class="block">
        <span class="text-xs text-gray-500">{{ t('records.paymentCurrency') }}</span>
        <input v-model="currency" type="text" class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1.5" />
      </label>
    </div>

    <div class="flex flex-wrap gap-2">
      <button
        type="button"
        class="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
        :disabled="busy || !organizationRefId"
        @click="previewStatement"
      >
        {{ t('records.customerStatementPreview') }}
      </button>
      <button
        type="button"
        class="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm"
        :disabled="busy || !organizationRefId"
        @click="exportCsv"
      >
        {{ t('records.customerStatementExportCsv') }}
      </button>
      <button
        type="button"
        class="rounded-md bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 text-sm disabled:opacity-50"
        :disabled="busy || !organizationRefId"
        @click="exportPdf"
      >
        {{ t('records.customerStatementExportPdf') }}
      </button>
    </div>

    <div v-if="preview" class="overflow-x-auto text-xs border border-gray-200 dark:border-gray-700 rounded-lg">
      <table class="min-w-full">
        <thead class="bg-gray-50 dark:bg-gray-800/60 uppercase text-gray-500">
          <tr>
            <th class="px-2 py-1 text-left">{{ t('records.paymentDate') }}</th>
            <th class="px-2 py-1 text-left">{{ t('records.status') }}</th>
            <th class="px-2 py-1 text-right">{{ t('records.paymentAllocationAmount') }}</th>
            <th class="px-2 py-1 text-right">{{ t('records.customerStatementBalance') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(line, idx) in preview.lines" :key="idx" class="border-t border-gray-100 dark:border-gray-800">
            <td class="px-2 py-1">{{ formatDate(line.date) }}</td>
            <td class="px-2 py-1">{{ line.type }}</td>
            <td class="px-2 py-1 text-right tabular-nums">{{ formatMoney(line.debit - line.credit) }}</td>
            <td class="px-2 py-1 text-right tabular-nums">{{ formatMoney(line.runningBalance) }}</td>
          </tr>
        </tbody>
      </table>
      <div class="px-2 py-2 text-right font-medium border-t">
        {{ t('records.customerStatementClosing') }}: {{ formatMoney(preview.closingBalance) }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { useNotifications } from '@/composables/useNotifications';

const props = defineProps({
  organizationRefId: { type: String, default: null },
  defaultCurrency: { type: String, default: 'USD' }
});

const { t } = useI18n();
const notifications = useNotifications();
const busy = ref(false);
const preview = ref(null);

const fromDate = ref(new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10));
const toDate = ref(new Date().toISOString().slice(0, 10));
const currency = ref(props.defaultCurrency || 'USD');

const organizationRefId = computed(() => props.organizationRefId);

function formatMoney(v) {
  return (Number(v) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(v) {
  if (!v) return '—';
  return new Date(v).toLocaleDateString();
}

function queryParams() {
  return new URLSearchParams({
    organizationRefId: organizationRefId.value,
    currency: currency.value,
    fromDate: fromDate.value,
    toDate: toDate.value
  }).toString();
}

async function previewStatement() {
  busy.value = true;
  try {
    const res = await apiClient.get(`/customer-statements?${queryParams()}`);
    if (res?.success) preview.value = res.data;
  } catch (err) {
    notifications.error(err?.message || t('records.customerStatementPreviewFailed'));
  } finally {
    busy.value = false;
  }
}

function downloadBlob(blob, filename, mime) {
  const url = URL.createObjectURL(new Blob([blob], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function exportCsv() {
  busy.value = true;
  try {
    const res = await fetch(`/api/customer-statements/export.csv?${queryParams()}`, {
      credentials: 'include',
      headers: { Accept: 'text/csv' }
    });
    if (!res.ok) throw new Error('Export failed');
    const text = await res.text();
    downloadBlob(text, `statement-${organizationRefId.value}.csv`, 'text/csv');
    notifications.success(t('records.customerStatementExportSuccess'));
  } catch (err) {
    notifications.error(err?.message || t('records.customerStatementExportFailed'));
  } finally {
    busy.value = false;
  }
}

async function exportPdf() {
  busy.value = true;
  try {
    const res = await fetch(`/api/customer-statements/export.pdf?${queryParams()}`, {
      credentials: 'include',
      headers: { Accept: 'application/pdf' }
    });
    if (!res.ok) throw new Error('Export failed');
    const blob = await res.blob();
    downloadBlob(blob, `statement-${organizationRefId.value}.pdf`, 'application/pdf');
    notifications.success(t('records.customerStatementExportSuccess'));
  } catch (err) {
    notifications.error(err?.message || t('records.customerStatementExportFailed'));
  } finally {
    busy.value = false;
  }
}
</script>
