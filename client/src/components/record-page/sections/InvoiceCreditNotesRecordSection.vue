<template>
  <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
    <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
      <div>
        <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ t('records.invoiceCreditNotesTitle') }}</h3>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ t('records.invoiceCreditNotesHint') }}</p>
      </div>
      <button
        v-if="canCreateCreditNote"
        type="button"
        class="rounded-md bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 text-sm"
        @click="showModal = true"
      >
        {{ t('records.invoiceCreateCreditNote') }}
      </button>
    </div>

    <div v-if="summary?.linkedCreditNotes?.length" class="overflow-x-auto">
      <table class="min-w-full text-sm">
        <thead class="text-xs uppercase text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/60">
          <tr>
            <th class="px-3 py-2 text-left">{{ t('records.invoiceCreditNoteNumber') }}</th>
            <th class="px-3 py-2 text-left">{{ t('records.status') }}</th>
            <th class="px-3 py-2 text-left">{{ t('records.invoiceCreditReason') }}</th>
            <th class="px-3 py-2 text-right">{{ t('records.invoiceCreditAmount') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="note in summary.linkedCreditNotes"
            :key="note.invoiceId"
            class="border-t border-gray-100 dark:border-gray-800"
          >
            <td class="px-3 py-2 font-medium">
              <router-link
                v-if="note.invoiceMongoId"
                :to="`/invoices/${note.invoiceMongoId}`"
                class="text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                {{ note.invoiceNumber }}
              </router-link>
              <span v-else>{{ note.invoiceNumber }}</span>
            </td>
            <td class="px-3 py-2">{{ note.status }}</td>
            <td class="px-3 py-2">{{ formatReason(note.creditReason) }}</td>
            <td class="px-3 py-2 text-right tabular-nums">{{ formatMoney(Math.abs(note.grandTotal || 0)) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else class="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">
      {{ t('records.invoiceCreditNotesEmpty') }}
    </div>

    <div v-if="summary" class="px-4 py-3 border-t border-gray-200 dark:border-gray-700 grid grid-cols-2 gap-3 text-sm">
      <div>
        <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('records.invoiceTotalCredited') }}</div>
        <div class="font-medium tabular-nums">{{ formatMoney(summary.totalCredited || 0) }}</div>
      </div>
      <div>
        <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('records.invoiceAmountDue') }}</div>
        <div class="font-medium tabular-nums">{{ formatMoney(summary.amountDue || 0) }}</div>
      </div>
    </div>

    <InvoiceCreateCreditNoteModal
      :open="showModal"
      :record="record"
      :summary="summary"
      @close="showModal = false"
      @created="handleCreated"
    />
  </div>
</template>

<script setup>
import { computed, ref, watch, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import apiClient from '@/utils/apiClient';
import InvoiceCreateCreditNoteModal from '@/components/record-page/sections/InvoiceCreateCreditNoteModal.vue';

const props = defineProps({
  record: { type: Object, default: null },
  context: { type: Object, default: () => ({}) }
});

const { t } = useI18n();
const auth = useAuthStore();
const showModal = ref(false);
const summary = ref(null);

const canCreateCreditNote = computed(() => {
  if (String(props.record?.invoiceType || 'standard') === 'credit_note') return false;
  const status = String(props.record?.status || '');
  if (!['Posted', 'Partially Paid', 'Paid'].includes(status)) return false;
  if (auth.isOwner) return true;
  return auth.can('invoices', 'createCreditNote');
});

function formatMoney(value) {
  const n = Number(value) || 0;
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatReason(reason) {
  if (!reason) return '—';
  const key = `records.invoiceCreditReason_${reason}`;
  const translated = t(key);
  return translated !== key ? translated : reason;
}

async function loadSummary() {
  if (!props.record?._id) return;
  if (String(props.record?.invoiceType || 'standard') === 'credit_note') return;
  try {
    const res = await apiClient.get(`/invoices/${props.record._id}/credit-summary`);
    if (res?.success) summary.value = res.data;
    else summary.value = props.record?.creditSummary || null;
  } catch {
    summary.value = props.record?.creditSummary || null;
  }
}

function handleCreated() {
  showModal.value = false;
  props.context?.onSectionUpdated?.({
    sectionKey: 'credits',
    payload: { type: 'credit-note-created' }
  });
}

watch(
  () => props.record?._id,
  () => {
    summary.value = props.record?.creditSummary || null;
    loadSummary();
  },
  { immediate: true }
);

function onOpenCreditNoteModal(event) {
  if (String(event?.detail?.invoiceMongoId || '') === String(props.record?._id || '')) {
    showModal.value = true;
  }
}

onMounted(() => {
  window.addEventListener('litedesk:invoice-open-credit-note', onOpenCreditNoteModal);
});

onUnmounted(() => {
  window.removeEventListener('litedesk:invoice-open-credit-note', onOpenCreditNoteModal);
});
</script>
