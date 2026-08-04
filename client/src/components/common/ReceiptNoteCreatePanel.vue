<template>
  <div class="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">
    <div>
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
        {{ t('records.rnCreateSourceTitle') }}
      </h3>
      <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
        {{ t('records.rnCreateSourceHint') }}
      </p>
    </div>

    <p v-if="loading" class="text-sm text-gray-500">{{ t('records.rnCreateSourceLoading') }}</p>
    <p v-else-if="loadError" class="text-sm text-red-600 dark:text-red-400">{{ loadError }}</p>

    <template v-else>
      <label class="block text-sm text-gray-800 dark:text-gray-200">
        <span>{{ t('records.rnSysFieldPurchaseOrder') }}</span>
        <select
          v-model="purchaseOrderId"
          required
          class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
          <option disabled value="">{{ t('records.rnSelectPurchaseOrder') }}</option>
          <option v-for="po in purchaseOrders" :key="po._id" :value="String(po._id)">
            {{ po.poNumber || po._id }}
            <template v-if="po.subject"> — {{ po.subject }}</template>
          </option>
        </select>
      </label>
      <p v-if="!purchaseOrders.length" class="text-sm text-gray-500 dark:text-gray-400">
        {{ t('records.rnCreateSourceEmpty') }}
      </p>

      <label class="block text-sm text-gray-800 dark:text-gray-200">
        <span>{{ t('records.rnSysFieldLocation') }}</span>
        <select
          v-model="receiptLocationId"
          required
          class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
          <option disabled value="">{{ t('records.rnSelectLocation') }}</option>
          <option v-for="loc in locations" :key="locKey(loc)" :value="locKey(loc)">
            {{ loc.name || loc.locationCode || locKey(loc) }}
          </option>
        </select>
      </label>
    </template>
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';

const props = defineProps({
  /** Prefill from ?poId= or parent */
  prefillPurchaseOrderId: { type: String, default: '' },
  prefillLocationId: { type: String, default: '' }
});

const { t } = useI18n();
const loading = ref(false);
const loadError = ref('');
const purchaseOrders = ref([]);
const locations = ref([]);
const purchaseOrderId = ref('');
const receiptLocationId = ref('');

function locKey(loc) {
  return String(loc?.inventoryLocationId || loc?._id || '');
}

function unwrapList(res) {
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res)) return res;
  return [];
}

async function load() {
  loading.value = true;
  loadError.value = '';
  try {
    const [pos, locs] = await Promise.all([
      apiClient.get('/inventory/purchase-orders', {
        params: {
          status: 'approved,ordered,partially_received',
          limit: 100,
          sortBy: 'updatedAt',
          sortOrder: 'desc'
        }
      }),
      apiClient.get('/inventory/locations')
    ]);
    purchaseOrders.value = unwrapList(pos);
    locations.value = unwrapList(locs);

    if (props.prefillPurchaseOrderId) {
      purchaseOrderId.value = String(props.prefillPurchaseOrderId);
    } else if (purchaseOrders.value[0]?._id) {
      purchaseOrderId.value = String(purchaseOrders.value[0]._id);
    }

    if (props.prefillLocationId) {
      receiptLocationId.value = String(props.prefillLocationId);
    } else if (locations.value[0]) {
      receiptLocationId.value = locKey(locations.value[0]);
    }
  } catch (err) {
    loadError.value = err?.message || t('records.rnCreateSourceLoadFailed');
  } finally {
    loading.value = false;
  }
}

watch(
  () => [props.prefillPurchaseOrderId, props.prefillLocationId],
  ([poId, locId]) => {
    if (poId) purchaseOrderId.value = String(poId);
    if (locId) receiptLocationId.value = String(locId);
  }
);

onMounted(load);

defineExpose({
  getPayload() {
    const po = String(purchaseOrderId.value || '').trim();
    const loc = String(receiptLocationId.value || '').trim();
    if (!po || !loc) return null;
    return { purchaseOrderId: po, receiptLocationId: loc };
  }
});
</script>
