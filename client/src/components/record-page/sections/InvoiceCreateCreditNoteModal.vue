<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    @click.self="close"
  >
    <div class="w-full max-w-3xl rounded-lg bg-white dark:bg-gray-900 shadow-xl border border-gray-200 dark:border-gray-700">
      <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">
          {{ t('records.invoiceCreateCreditNoteTitle') }}
        </h3>
        <button type="button" class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300" @click="close">×</button>
      </div>

      <div class="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label class="block text-sm">
            <span class="text-gray-700 dark:text-gray-200">{{ t('records.invoiceCreditReason') }}</span>
            <select
              v-model="creditReason"
              class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1.5"
            >
              <option value="">{{ t('records.invoiceCreditReasonSelect') }}</option>
              <option v-for="reason in creditReasons" :key="reason" :value="reason">
                {{ t(`records.invoiceCreditReason_${reason}`) }}
              </option>
            </select>
          </label>
          <label class="block text-sm sm:col-span-2">
            <span class="text-gray-700 dark:text-gray-200">{{ t('records.invoiceCreditReasonNote') }}</span>
            <input
              v-model="creditReasonNote"
              type="text"
              class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1.5"
            />
          </label>
        </div>

        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="rounded-md border px-2.5 py-1 text-xs"
            :class="creditMode === 'full' ? 'border-indigo-500 text-indigo-700 dark:text-indigo-300' : 'border-gray-300 dark:border-gray-600'"
            @click="applyFullCredit"
          >
            {{ t('records.invoiceCreditModeFull') }}
          </button>
        </div>

        <div class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table class="min-w-full text-sm">
            <thead class="text-xs uppercase text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/60">
              <tr>
                <th class="px-3 py-2 text-left">{{ t('records.linesName') }}</th>
                <th class="px-3 py-2 text-right">{{ t('records.invoiceQtyRemainingCredit') }}</th>
                <th class="px-3 py-2 text-right">{{ t('records.invoiceCreditQty') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in editableLines"
                :key="row.invoiceLineId"
                class="border-t border-gray-100 dark:border-gray-800"
              >
                <td class="px-3 py-2">
                  <div class="font-medium">{{ row.itemNameSnapshot || row.invoiceLineId }}</div>
                </td>
                <td class="px-3 py-2 text-right tabular-nums">{{ row.quantityRemainingToCredit }}</td>
                <td class="px-3 py-2 text-right">
                  <input
                    v-model.number="row.creditQty"
                    type="number"
                    min="0"
                    :max="row.quantityRemainingToCredit"
                    step="any"
                    class="w-24 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1 text-right tabular-nums"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <label class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
          <input v-model="postAfterCreate" type="checkbox" class="rounded border-gray-300 dark:border-gray-600" />
          {{ t('records.invoiceCreditPostNow') }}
        </label>
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
          :disabled="busy || !hasSelectedLines"
          @click="submit"
        >
          {{ postAfterCreate ? t('records.invoiceCreateCreditNoteAndPost') : t('records.invoiceCreateCreditNoteDraft') }}
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
  record: { type: Object, default: null },
  summary: { type: Object, default: null }
});

const emit = defineEmits(['close', 'created']);

const { t } = useI18n();
const notifications = useNotifications();
const busy = ref(false);
const postAfterCreate = ref(true);
const creditReason = ref('');
const creditReasonNote = ref('');
const creditMode = ref('partial');
const editableLines = ref([]);

const creditReasons = ['duplicate', 'return', 'pricing_error', 'goodwill', 'other'];

const hasSelectedLines = computed(() =>
  editableLines.value.some((row) => Number(row.creditQty) > 0)
);

function close() {
  if (busy.value) return;
  emit('close');
}

function syncLinesFromSummary() {
  editableLines.value = (props.summary?.lines || [])
    .filter((line) => Number(line.quantityRemainingToCredit) > 0)
    .map((line) => ({
      ...line,
      creditQty: Number(line.quantityRemainingToCredit) || 0
    }));
}

function applyFullCredit() {
  creditMode.value = 'full';
  syncLinesFromSummary();
}

async function submit() {
  if (!props.record?._id || !hasSelectedLines.value) return;

  const lines = editableLines.value
    .filter((row) => Number(row.creditQty) > 0)
    .map((row) => ({
      invoiceLineId: row.invoiceLineId,
      quantity: Number(row.creditQty)
    }));

  busy.value = true;
  try {
    const res = await apiClient.post(`/invoices/from-invoice/${props.record._id}/credit-note`, {
      lines,
      creditMode: creditMode.value,
      creditReason: creditReason.value || undefined,
      creditReasonNote: creditReasonNote.value || undefined,
      post: postAfterCreate.value === true,
      sourceContext: 'invoice_record'
    });

    if (res?.success) {
      notifications.success(
        t('records.invoiceCreateCreditNoteSuccess', {
          number: res.data?.creditNoteNumber || ''
        })
      );
      emit('created', res.data);
      emit('close');
      return;
    }
    notifications.error(res?.message || t('records.invoiceCreateCreditNoteFailed'));
  } catch (e) {
    notifications.error(e?.message || t('records.invoiceCreateCreditNoteFailed'));
  } finally {
    busy.value = false;
  }
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      creditReason.value = '';
      creditReasonNote.value = '';
      creditMode.value = 'partial';
      syncLinesFromSummary();
    }
  }
);
watch(
  () => props.summary,
  () => {
    if (props.open) syncLinesFromSummary();
  },
  { deep: true }
);
</script>
