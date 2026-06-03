<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    @click.self="close"
  >
    <div class="w-full max-w-4xl rounded-lg bg-white dark:bg-gray-900 shadow-xl border border-gray-200 dark:border-gray-700">
      <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div>
          <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">
            {{ t('records.invoiceMultiSoTitle') }}
          </h3>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ t('records.invoiceMultiSoHint') }}</p>
        </div>
        <button type="button" class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300" @click="close">×</button>
      </div>

      <div class="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
        <div v-if="loading" class="py-8 text-center text-sm text-gray-500">Loading…</div>
        <div v-else-if="loadError" class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {{ loadError }}
        </div>
        <template v-else>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="so in summary?.salesOrders || []"
              :key="so.salesOrderId"
              class="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-1 text-xs font-medium"
            >
              {{ so.salesOrderNumber }}
            </span>
          </div>

          <div
            v-for="so in summary?.salesOrders || []"
            :key="so.salesOrderId"
            class="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            <div class="px-3 py-2 bg-gray-50 dark:bg-gray-800/60 font-medium text-sm">
              {{ so.salesOrderNumber }}
              <span v-if="so.orderTitle" class="text-gray-500 font-normal">— {{ so.orderTitle }}</span>
            </div>
            <table class="min-w-full text-sm">
              <thead class="text-xs uppercase text-gray-500 bg-white dark:bg-gray-900">
                <tr>
                  <th class="px-3 py-2 text-left">{{ t('records.linesName') }}</th>
                  <th class="px-3 py-2 text-right">{{ t('records.salesOrderQtyRemainingInvoice') }}</th>
                  <th class="px-3 py-2 text-right">{{ t('records.salesOrderCreateInvoiceQty') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in editableLinesBySo[so.salesOrderId] || []"
                  :key="row.salesOrderLineId"
                  class="border-t border-gray-100 dark:border-gray-800"
                >
                  <td class="px-3 py-2">{{ row.itemNameSnapshot || row.salesOrderLineId }}</td>
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
        </template>
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
          :disabled="busy || loading || !hasSelectedLines"
          @click="submit"
        >
          {{ postAfterCreate ? t('records.invoiceMultiSoCreateAndPost') : t('records.invoiceMultiSoCreateDraft') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { useNotifications } from '@/composables/useNotifications';

const props = defineProps({
  open: { type: Boolean, default: false },
  salesOrders: { type: Array, default: () => [] }
});

const emit = defineEmits(['close', 'created']);

const { t } = useI18n();
const notifications = useNotifications();
const busy = ref(false);
const loading = ref(false);
const loadError = ref('');
const postAfterCreate = ref(true);
const summary = ref(null);
const editableLinesBySo = reactive({});

const salesOrderIds = computed(() =>
  (props.salesOrders || [])
    .map((row) => row.salesOrderId || row._id || row.id)
    .filter(Boolean)
);

const hasSelectedLines = computed(() =>
  Object.values(editableLinesBySo).some((rows) =>
    (rows || []).some((row) => Number(row.invoiceQty) > 0)
  )
);

function close() {
  if (busy.value) return;
  emit('close');
}

function syncEditableLines() {
  for (const key of Object.keys(editableLinesBySo)) {
    delete editableLinesBySo[key];
  }
  for (const so of summary.value?.salesOrders || []) {
    editableLinesBySo[so.salesOrderId] = (so.lines || [])
      .filter((line) => Number(line.quantityRemainingToInvoice) > 0)
      .map((line) => ({
        ...line,
        salesOrderId: so.salesOrderId,
        invoiceQty: Number(line.quantityRemainingToInvoice) || 0
      }));
  }
}

async function loadSummary() {
  if (salesOrderIds.value.length < 2) {
    loadError.value = t('records.invoiceMultiSoMinSelection');
    return;
  }
  loading.value = true;
  loadError.value = '';
  try {
    const res = await apiClient.post('/invoices/multi-so-readiness', {
      salesOrderIds: salesOrderIds.value
    });
    if (res?.success) {
      summary.value = res.data;
      syncEditableLines();
      return;
    }
    loadError.value = res?.message || t('records.invoiceMultiSoLoadFailed');
  } catch (e) {
    loadError.value = e?.message || t('records.invoiceMultiSoLoadFailed');
  } finally {
    loading.value = false;
  }
}

async function submit() {
  if (!hasSelectedLines.value) return;
  const lines = [];
  for (const rows of Object.values(editableLinesBySo)) {
    for (const row of rows || []) {
      if (Number(row.invoiceQty) <= 0) continue;
      lines.push({
        salesOrderId: row.salesOrderId,
        salesOrderLineId: row.salesOrderLineId,
        quantity: Number(row.invoiceQty)
      });
    }
  }

  busy.value = true;
  try {
    const res = await apiClient.post('/invoices/from-sales-orders', {
      salesOrderIds: salesOrderIds.value,
      lines,
      post: postAfterCreate.value === true,
      sourceContext: 'multi_so_wizard'
    });
    if (res?.success) {
      notifications.success(
        t('records.invoiceMultiSoSuccess', { number: res.data?.invoiceNumber || '' })
      );
      emit('created', res.data);
      emit('close');
      return;
    }
    notifications.error(res?.message || t('records.invoiceMultiSoFailed'));
  } catch (e) {
    notifications.error(e?.message || t('records.invoiceMultiSoFailed'));
  } finally {
    busy.value = false;
  }
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      postAfterCreate.value = true;
      summary.value = null;
      loadSummary();
    }
  }
);
</script>
