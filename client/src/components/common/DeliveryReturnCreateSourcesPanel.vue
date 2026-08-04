<template>
  <div class="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">
    <div>
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
        {{ t('records.drCreateSourcesTitle') }}
      </h3>
      <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
        {{ t('records.drCreateSourcesHint') }}
      </p>
    </div>

    <p v-if="!customerId" class="text-sm text-gray-500 dark:text-gray-400">
      {{ t('records.drCreateSourcesNeedCustomer') }}
    </p>

    <template v-else>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="opt in sourceTypeOptions"
          :key="opt.value"
          type="button"
          class="rounded-md px-3 py-1.5 text-xs font-medium"
          :class="
            sourceType === opt.value
              ? 'bg-indigo-600 text-white'
              : 'border border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-200'
          "
          @click="sourceType = opt.value"
        >
          {{ opt.label }}
        </button>
      </div>

      <p v-if="loading" class="text-sm text-gray-500">{{ t('records.drCreateSourcesLoading') }}</p>
      <p v-else-if="loadError" class="text-sm text-red-600 dark:text-red-400">{{ loadError }}</p>
      <p
        v-else-if="!deliveryNotes.length && !invoices.length"
        class="text-sm text-gray-500 dark:text-gray-400"
      >
        {{ t('records.drCreateSourcesEmpty') }}
      </p>

      <div v-else class="space-y-4">
        <div v-if="sourceType === 'delivery_note' && deliveryNotes.length">
          <div class="mb-1.5 flex items-center justify-between gap-2">
            <span class="text-xs font-medium uppercase tracking-wide text-gray-500">
              {{ t('records.drCreateSourcesDeliveryNotes') }}
            </span>
            <button
              type="button"
              class="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
              @click="toggleAllNotes"
            >
              {{ allNotesSelected ? t('records.drCreateSourcesClear') : t('records.drCreateSourcesSelectAll') }}
            </button>
          </div>
          <ul class="max-h-40 space-y-1 overflow-y-auto rounded-md border border-gray-200 bg-white p-2 dark:border-gray-600 dark:bg-gray-800">
            <li v-for="dn in deliveryNotes" :key="dn._id">
              <label class="flex cursor-pointer items-start gap-2 rounded px-1.5 py-1 text-sm hover:bg-gray-50 dark:hover:bg-gray-700/60">
                <input
                  v-model="selectedDeliveryNoteIds"
                  type="checkbox"
                  class="mt-0.5 rounded"
                  :value="String(dn._id)"
                />
                <span class="min-w-0 flex-1">
                  <span class="font-medium text-gray-900 dark:text-gray-100">
                    {{ dn.deliveryNoteNumber || dn._id }}
                  </span>
                  <span class="mt-0.5 block text-xs text-gray-500">
                    {{
                      t('records.drCreateSourcesReturnableSummary', {
                        lines: dn.returnableLineCount || 0,
                        qty: dn.returnableQuantityTotal || 0
                      })
                    }}
                  </span>
                </span>
              </label>
            </li>
          </ul>
        </div>

        <div v-if="sourceType === 'invoice' && invoices.length">
          <div class="mb-1.5 flex items-center justify-between gap-2">
            <span class="text-xs font-medium uppercase tracking-wide text-gray-500">
              {{ t('records.drCreateSourcesInvoices') }}
            </span>
            <button
              type="button"
              class="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
              @click="toggleAllInvoices"
            >
              {{ allInvoicesSelected ? t('records.drCreateSourcesClear') : t('records.drCreateSourcesSelectAll') }}
            </button>
          </div>
          <ul class="max-h-40 space-y-1 overflow-y-auto rounded-md border border-gray-200 bg-white p-2 dark:border-gray-600 dark:bg-gray-800">
            <li v-for="inv in invoices" :key="inv._id">
              <label class="flex cursor-pointer items-start gap-2 rounded px-1.5 py-1 text-sm hover:bg-gray-50 dark:hover:bg-gray-700/60">
                <input
                  v-model="selectedInvoiceIds"
                  type="checkbox"
                  class="mt-0.5 rounded"
                  :value="String(inv._id)"
                />
                <span class="min-w-0 flex-1">
                  <span class="font-medium text-gray-900 dark:text-gray-100">
                    {{ inv.invoiceNumber || inv._id }}
                    <template v-if="inv.subject"> — {{ inv.subject }}</template>
                  </span>
                  <span class="mt-0.5 block text-xs text-gray-500">
                    {{
                      t('records.drCreateSourcesReturnableSummary', {
                        lines: inv.returnableLineCount || 0,
                        qty: inv.returnableQuantityTotal || 0
                      })
                    }}
                  </span>
                </span>
              </label>
            </li>
          </ul>
        </div>

        <p v-if="selectionSummary" class="text-xs text-gray-600 dark:text-gray-300">
          {{ selectionSummary }}
        </p>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';

const props = defineProps({
  customerId: { type: [String, Object], default: null }
});

const { t } = useI18n();

const loading = ref(false);
const loadError = ref('');
const deliveryNotes = ref([]);
const invoices = ref([]);
const selectedDeliveryNoteIds = ref([]);
const selectedInvoiceIds = ref([]);
const sourceType = ref('delivery_note');

const sourceTypeOptions = computed(() => [
  { value: 'delivery_note', label: t('records.drSourceTypeDeliveryNote') },
  { value: 'invoice', label: t('records.drSourceTypeInvoice') }
]);

function normalizeCustomerId(raw) {
  if (!raw) return '';
  if (typeof raw === 'object') return String(raw._id || raw.id || '').trim();
  return String(raw).trim();
}

const customerId = computed(() => normalizeCustomerId(props.customerId));

const allNotesSelected = computed(
  () =>
    deliveryNotes.value.length > 0 &&
    selectedDeliveryNoteIds.value.length === deliveryNotes.value.length
);

const allInvoicesSelected = computed(
  () =>
    invoices.value.length > 0 && selectedInvoiceIds.value.length === invoices.value.length
);

const selectionSummary = computed(() => {
  if (sourceType.value === 'invoice') {
    const n = selectedInvoiceIds.value.length;
    if (!n) return '';
    return t('records.drCreateSourcesSelected', { count: n });
  }
  const n = selectedDeliveryNoteIds.value.length;
  if (!n) return '';
  return t('records.drCreateSourcesSelected', { count: n });
});

function toggleAllNotes() {
  if (allNotesSelected.value) {
    selectedDeliveryNoteIds.value = [];
  } else {
    selectedDeliveryNoteIds.value = deliveryNotes.value.map((d) => String(d._id));
  }
}

function toggleAllInvoices() {
  if (allInvoicesSelected.value) {
    selectedInvoiceIds.value = [];
  } else {
    selectedInvoiceIds.value = invoices.value.map((i) => String(i._id));
  }
}

async function loadSources() {
  const cid = customerId.value;
  selectedDeliveryNoteIds.value = [];
  selectedInvoiceIds.value = [];
  deliveryNotes.value = [];
  invoices.value = [];
  loadError.value = '';
  if (!cid) return;
  loading.value = true;
  try {
    const res = await apiClient.get('/inventory/delivery-returns/eligible-sources', {
      params: { customerId: cid }
    });
    const data = res?.data ?? res;
    deliveryNotes.value = Array.isArray(data?.deliveryNotes) ? data.deliveryNotes : [];
    invoices.value = Array.isArray(data?.invoices) ? data.invoices : [];
  } catch (err) {
    loadError.value = err?.message || t('records.drCreateSourcesLoadFailed');
  } finally {
    loading.value = false;
  }
}

watch(customerId, () => loadSources(), { immediate: true });

function getSelectedSources() {
  return {
    sourceType: sourceType.value,
    deliveryNoteIds:
      sourceType.value === 'delivery_note' ? [...selectedDeliveryNoteIds.value] : [],
    invoiceIds: sourceType.value === 'invoice' ? [...selectedInvoiceIds.value] : []
  };
}

defineExpose({ getSelectedSources });
</script>
