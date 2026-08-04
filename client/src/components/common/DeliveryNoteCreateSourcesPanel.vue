<template>
  <div class="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">
    <div>
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
        {{ t('records.dnCreateSourcesTitle') }}
      </h3>
      <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
        {{ t('records.dnCreateSourcesHint') }}
      </p>
    </div>

    <p v-if="!customerId" class="text-sm text-gray-500 dark:text-gray-400">
      {{ t('records.dnCreateSourcesNeedCustomer') }}
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

      <template v-if="sourceType === 'sales_order'">
        <p v-if="loading" class="text-sm text-gray-500">{{ t('records.dnCreateSourcesLoading') }}</p>
        <p v-else-if="loadError" class="text-sm text-red-600 dark:text-red-400">{{ loadError }}</p>
        <p
          v-else-if="!salesOrders.length"
          class="text-sm text-gray-500 dark:text-gray-400"
        >
          {{ t('records.dnCreateSourcesEmpty') }}
        </p>

        <div v-else class="space-y-2">
          <div class="mb-1.5 flex items-center justify-between gap-2">
            <span class="text-xs font-medium uppercase tracking-wide text-gray-500">
              {{ t('records.dnCreateSourcesSalesOrders') }}
            </span>
            <button
              type="button"
              class="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
              @click="toggleAllOrders"
            >
              {{
                allOrdersSelected
                  ? t('records.dnCreateSourcesClear')
                  : t('records.dnCreateSourcesSelectAll')
              }}
            </button>
          </div>
          <ul
            class="max-h-40 space-y-1 overflow-y-auto rounded-md border border-gray-200 bg-white p-2 dark:border-gray-600 dark:bg-gray-800"
          >
            <li v-for="so in salesOrders" :key="so._id">
              <label
                class="flex cursor-pointer items-start gap-2 rounded px-1.5 py-1 text-sm hover:bg-gray-50 dark:hover:bg-gray-700/60"
              >
                <input
                  v-model="selectedSalesOrderIds"
                  type="checkbox"
                  class="mt-0.5 rounded"
                  :value="String(so._id)"
                />
                <span class="min-w-0 flex-1">
                  <span class="font-medium text-gray-900 dark:text-gray-100">
                    {{ so.salesOrderNumber || so._id }}
                    <template v-if="so.subject || so.orderTitle">
                      — {{ so.subject || so.orderTitle }}
                    </template>
                  </span>
                  <span class="mt-0.5 block text-xs text-gray-500">
                    {{
                      t('records.dnCreateSourcesDeliverableSummary', {
                        lines: so.deliverableLineCount || 0,
                        qty: so.deliverableQuantityTotal || 0
                      })
                    }}
                  </span>
                </span>
              </label>
            </li>
          </ul>
          <p v-if="selectionSummary" class="text-xs text-gray-600 dark:text-gray-300">
            {{ selectionSummary }}
          </p>
        </div>
      </template>

      <p v-else class="text-sm text-gray-500 dark:text-gray-400">
        {{ t('records.dnCreateSourcesDirectHint') }}
      </p>
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
const salesOrders = ref([]);
const selectedSalesOrderIds = ref([]);
const sourceType = ref('sales_order');

const sourceTypeOptions = computed(() => [
  { value: 'direct', label: t('records.dnSourceTypeDirect') },
  { value: 'sales_order', label: t('records.dnSourceTypeSalesOrder') }
]);

function normalizeCustomerId(raw) {
  if (!raw) return '';
  if (typeof raw === 'object') return String(raw._id || raw.id || '').trim();
  return String(raw).trim();
}

const customerId = computed(() => normalizeCustomerId(props.customerId));

const allOrdersSelected = computed(
  () =>
    salesOrders.value.length > 0 &&
    selectedSalesOrderIds.value.length === salesOrders.value.length
);

const selectionSummary = computed(() => {
  const n = selectedSalesOrderIds.value.length;
  if (!n) return '';
  return t('records.dnCreateSourcesSelected', { count: n });
});

function toggleAllOrders() {
  if (allOrdersSelected.value) {
    selectedSalesOrderIds.value = [];
  } else {
    selectedSalesOrderIds.value = salesOrders.value.map((s) => String(s._id));
  }
}

async function loadSources() {
  const cid = customerId.value;
  selectedSalesOrderIds.value = [];
  salesOrders.value = [];
  loadError.value = '';
  if (!cid || sourceType.value !== 'sales_order') return;
  loading.value = true;
  try {
    const res = await apiClient.get('/inventory/delivery-notes/eligible-sources', {
      params: { customerId: cid }
    });
    const data = res?.data ?? res;
    salesOrders.value = Array.isArray(data?.salesOrders) ? data.salesOrders : [];
  } catch (err) {
    loadError.value = err?.message || t('records.dnCreateSourcesLoadFailed');
  } finally {
    loading.value = false;
  }
}

watch(customerId, () => loadSources(), { immediate: true });
watch(sourceType, () => loadSources());

function getSelectedSources() {
  return {
    sourceType: sourceType.value,
    salesOrderIds:
      sourceType.value === 'sales_order' ? [...selectedSalesOrderIds.value] : []
  };
}

defineExpose({ getSelectedSources });
</script>
