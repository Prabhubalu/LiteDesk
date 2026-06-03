<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    @click.self="close"
  >
    <div class="w-full max-w-3xl rounded-lg bg-white dark:bg-gray-900 shadow-xl border border-gray-200 dark:border-gray-700">
      <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">
          {{ t('records.salesOrderCreateInvoiceTitle') }}
        </h3>
        <button type="button" class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300" @click="close">×</button>
      </div>

      <div class="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
        <p class="text-sm text-gray-600 dark:text-gray-300">{{ t('records.salesOrderCreateInvoiceHint') }}</p>

        <div class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table class="min-w-full text-sm">
            <thead class="text-xs uppercase text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/60">
              <tr>
                <th class="px-3 py-2 text-left">{{ t('records.linesName') }}</th>
                <th class="px-3 py-2 text-right">{{ t('records.salesOrderQtyRemainingInvoice') }}</th>
                <th class="px-3 py-2 text-right">{{ t('records.salesOrderCreateInvoiceQty') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in editableLines"
                :key="row.salesOrderLineId"
                class="border-t border-gray-100 dark:border-gray-800"
              >
                <td class="px-3 py-2">
                  <div class="font-medium">{{ row.itemNameSnapshot || row.salesOrderLineId }}</div>
                  <div class="text-xs text-gray-500 dark:text-gray-400">{{ row.salesOrderLineId }}</div>
                </td>
                <td class="px-3 py-2 text-right tabular-nums">{{ row.quantityRemainingToInvoice }}</td>
                <td class="px-3 py-2 text-right">
                  <input
                    v-model.number="row.invoiceQty"
                    type="number"
                    min="0"
                    :max="row.quantityRemainingToInvoice"
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
          {{ t('records.salesOrderCreateInvoicePostNow') }}
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
          {{ postAfterCreate ? t('records.salesOrderCreateInvoiceAndPost') : t('records.salesOrderCreateInvoiceDraft') }}
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
const editableLines = ref([]);

const hasSelectedLines = computed(() =>
  editableLines.value.some((row) => Number(row.invoiceQty) > 0)
);

function close() {
  if (busy.value) return;
  emit('close');
}

function syncLinesFromSummary() {
  editableLines.value = (props.summary?.lines || [])
    .filter((line) => Number(line.quantityRemainingToInvoice) > 0)
    .map((line) => ({
      ...line,
      invoiceQty: Number(line.quantityRemainingToInvoice) || 0
    }));
}

async function submit() {
  if (!props.record?._id || !hasSelectedLines.value) return;

  const lines = editableLines.value
    .filter((row) => Number(row.invoiceQty) > 0)
    .map((row) => ({
      salesOrderLineId: row.salesOrderLineId,
      quantity: Number(row.invoiceQty)
    }));

  busy.value = true;
  try {
    const res = await apiClient.post(`/invoices/from-sales-order/${props.record._id}`, {
      lines,
      post: postAfterCreate.value === true,
      sourceContext: 'sales_order_record'
    });

    if (res?.success) {
      notifications.success(
        t('records.salesOrderCreateInvoiceSuccess', {
          number: res.data?.invoiceNumber || ''
        })
      );
      emit('created', res.data);
      emit('close');
      return;
    }
    notifications.error(res?.message || t('records.salesOrderCreateInvoiceFailed'));
  } catch (e) {
    notifications.error(e?.message || t('records.salesOrderCreateInvoiceFailed'));
  } finally {
    busy.value = false;
  }
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) syncLinesFromSummary();
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
