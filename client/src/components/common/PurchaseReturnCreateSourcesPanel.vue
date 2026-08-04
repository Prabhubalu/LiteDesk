<template>
  <div class="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">
    <div>
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
        {{ t('records.prCreateSourcesTitle') }}
      </h3>
      <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
        {{ t('records.prCreateSourcesHint') }}
      </p>
    </div>

    <p v-if="!vendorId" class="text-sm text-gray-500 dark:text-gray-400">
      {{ t('records.prCreateSourcesNeedVendor') }}
    </p>

    <template v-else>
      <p v-if="loading" class="text-sm text-gray-500">{{ t('records.prCreateSourcesLoading') }}</p>
      <p v-else-if="loadError" class="text-sm text-red-600 dark:text-red-400">{{ loadError }}</p>
      <p
        v-else-if="!receiptNotes.length && !purchaseOrders.length"
        class="text-sm text-gray-500 dark:text-gray-400"
      >
        {{ t('records.prCreateSourcesEmpty') }}
      </p>

      <div v-else class="space-y-4">
        <div v-if="receiptNotes.length">
          <div class="mb-1.5 flex items-center justify-between gap-2">
            <span class="text-xs font-medium uppercase tracking-wide text-gray-500">
              {{ t('records.prCreateSourcesReceiptNotes') }}
            </span>
            <button
              type="button"
              class="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
              @click="toggleAllNotes"
            >
              {{ allNotesSelected ? t('records.prCreateSourcesClear') : t('records.prCreateSourcesSelectAll') }}
            </button>
          </div>
          <ul class="max-h-40 space-y-1 overflow-y-auto rounded-md border border-gray-200 bg-white p-2 dark:border-gray-600 dark:bg-gray-800">
            <li v-for="rn in receiptNotes" :key="rn._id">
              <label class="flex cursor-pointer items-start gap-2 rounded px-1.5 py-1 text-sm hover:bg-gray-50 dark:hover:bg-gray-700/60">
                <input
                  v-model="selectedReceiptNoteIds"
                  type="checkbox"
                  class="mt-0.5 rounded"
                  :value="String(rn._id)"
                />
                <span class="min-w-0 flex-1">
                  <span class="font-medium text-gray-900 dark:text-gray-100">
                    {{ rn.receiptNoteNumber || rn._id }}
                  </span>
                  <span class="mt-0.5 block text-xs text-gray-500">
                    {{ t('records.prCreateSourcesReturnableSummary', {
                      lines: rn.returnableLineCount || 0,
                      qty: rn.returnableQuantityTotal || 0
                    }) }}
                  </span>
                </span>
              </label>
            </li>
          </ul>
        </div>

        <div v-if="purchaseOrders.length">
          <div class="mb-1.5 flex items-center justify-between gap-2">
            <span class="text-xs font-medium uppercase tracking-wide text-gray-500">
              {{ t('records.prCreateSourcesPurchaseOrders') }}
            </span>
            <button
              type="button"
              class="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
              @click="toggleAllPos"
            >
              {{ allPosSelected ? t('records.prCreateSourcesClear') : t('records.prCreateSourcesSelectAll') }}
            </button>
          </div>
          <ul class="max-h-40 space-y-1 overflow-y-auto rounded-md border border-gray-200 bg-white p-2 dark:border-gray-600 dark:bg-gray-800">
            <li v-for="po in purchaseOrders" :key="po._id">
              <label class="flex cursor-pointer items-start gap-2 rounded px-1.5 py-1 text-sm hover:bg-gray-50 dark:hover:bg-gray-700/60">
                <input
                  v-model="selectedPurchaseOrderIds"
                  type="checkbox"
                  class="mt-0.5 rounded"
                  :value="String(po._id)"
                />
                <span class="min-w-0 flex-1">
                  <span class="font-medium text-gray-900 dark:text-gray-100">
                    {{ po.poNumber || po._id }}
                    <template v-if="po.subject"> — {{ po.subject }}</template>
                  </span>
                  <span class="mt-0.5 block text-xs text-gray-500">
                    {{ t('records.prCreateSourcesReturnableSummary', {
                      lines: po.returnableLineCount || 0,
                      qty: po.returnableQuantityTotal || 0
                    }) }}
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
  vendorId: { type: [String, Object], default: null }
});

const { t } = useI18n();

const loading = ref(false);
const loadError = ref('');
const receiptNotes = ref([]);
const purchaseOrders = ref([]);
const selectedReceiptNoteIds = ref([]);
const selectedPurchaseOrderIds = ref([]);

function normalizeVendorId(raw) {
  if (!raw) return '';
  if (typeof raw === 'object') return String(raw._id || raw.id || '').trim();
  return String(raw).trim();
}

const vendorId = computed(() => normalizeVendorId(props.vendorId));

const allNotesSelected = computed(
  () =>
    receiptNotes.value.length > 0 &&
    selectedReceiptNoteIds.value.length === receiptNotes.value.length
);

const allPosSelected = computed(
  () =>
    purchaseOrders.value.length > 0 &&
    selectedPurchaseOrderIds.value.length === purchaseOrders.value.length
);

const selectionSummary = computed(() => {
  const n = selectedReceiptNoteIds.value.length;
  const p = selectedPurchaseOrderIds.value.length;
  if (!n && !p) return '';
  return t('records.prCreateSourcesSelected', { notes: n, pos: p });
});

function toggleAllNotes() {
  if (allNotesSelected.value) {
    selectedReceiptNoteIds.value = [];
  } else {
    selectedReceiptNoteIds.value = receiptNotes.value.map((r) => String(r._id));
  }
}

function toggleAllPos() {
  if (allPosSelected.value) {
    selectedPurchaseOrderIds.value = [];
  } else {
    selectedPurchaseOrderIds.value = purchaseOrders.value.map((r) => String(r._id));
  }
}

async function loadSources() {
  const vid = vendorId.value;
  selectedReceiptNoteIds.value = [];
  selectedPurchaseOrderIds.value = [];
  receiptNotes.value = [];
  purchaseOrders.value = [];
  loadError.value = '';
  if (!vid) return;
  loading.value = true;
  try {
    const res = await apiClient.get('/inventory/purchase-returns/eligible-sources', {
      params: { vendorId: vid }
    });
    const data = res?.data ?? res;
    receiptNotes.value = Array.isArray(data?.receiptNotes) ? data.receiptNotes : [];
    purchaseOrders.value = Array.isArray(data?.purchaseOrders) ? data.purchaseOrders : [];
  } catch (err) {
    loadError.value = err?.message || t('records.prCreateSourcesLoadFailed');
  } finally {
    loading.value = false;
  }
}

watch(vendorId, () => {
  loadSources();
}, { immediate: true });

function getSelectedSources() {
  return {
    receiptNoteIds: [...selectedReceiptNoteIds.value],
    purchaseOrderIds: [...selectedPurchaseOrderIds.value]
  };
}

defineExpose({ getSelectedSources });
</script>
