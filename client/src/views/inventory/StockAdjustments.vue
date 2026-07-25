<template>
  <div>
    <InventoryTxnList
      :title="t('navigation.inventoryAdjustments')"
      :subtitle="t('navigation.inventoryAdjustmentsDesc')"
      :columns="columns"
      :rows="rows"
      :loading="loading"
      :error="error"
      :create-label="t('navigation.inventoryAdjustmentCreate')"
      :empty-label="t('navigation.inventoryAdjustmentsEmpty')"
      @create="showCreate = true"
    >
      <template #actions="{ row }">
        <button
          v-if="row.status === 'draft'"
          type="button"
          class="text-sm text-indigo-600 hover:underline"
          @click="post(row)"
        >
          Post
        </button>
      </template>
    </InventoryTxnList>

    <Teleport to="body">
      <div v-if="showCreate" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click.self="showCreate = false">
        <form class="w-full max-w-lg space-y-3 rounded-xl bg-white p-5 shadow-xl dark:bg-gray-800" @submit.prevent="create">
          <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('navigation.inventoryAdjustmentCreate') }}</h3>
          <label class="block text-sm">
            <span class="text-gray-700 dark:text-gray-300">{{ t('navigation.inventoryStockroom') }}</span>
            <select v-model="form.inventoryLocationId" required class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white">
              <option disabled value="">{{ t('actions.select') }}</option>
              <option v-for="loc in locations" :key="loc.inventoryLocationId" :value="loc.inventoryLocationId">{{ loc.name }}</option>
            </select>
          </label>
          <label class="block text-sm">
            <span class="text-gray-700 dark:text-gray-300">{{ t('navigation.inventoryReason') }}</span>
            <input v-model="form.reasonCode" required class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
          </label>
          <label class="block text-sm">
            <span class="text-gray-700 dark:text-gray-300">{{ t('navigation.inventoryVariantId') }}</span>
            <input v-model="form.variantId" required class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
          </label>
          <label class="block text-sm">
            <span class="text-gray-700 dark:text-gray-300">{{ t('navigation.inventoryQtyDelta') }}</span>
            <input v-model.number="form.quantityDelta" type="number" step="any" required class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
          </label>
          <p v-if="formError" class="text-sm text-red-600">{{ formError }}</p>
          <div class="flex justify-end gap-2">
            <button type="button" class="px-3 py-2 text-sm" @click="showCreate = false">{{ t('actions.cancel') }}</button>
            <button type="submit" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white" :disabled="saving">{{ t('actions.save') }}</button>
          </div>
        </form>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Teleport } from 'vue';
import apiClient from '@/utils/apiClient';
import InventoryTxnList from './InventoryTxnList.vue';

function unwrapList(res) {
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res)) return res;
  return [];
}

const { t } = useI18n();
const rows = ref([]);
const locations = ref([]);
const loading = ref(false);
const saving = ref(false);
const error = ref('');
const formError = ref('');
const showCreate = ref(false);
const form = reactive({
  inventoryLocationId: '',
  reasonCode: 'Physical Stock Count',
  variantId: '',
  quantityDelta: 0
});
const columns = [
  { key: 'inventoryAdjustmentId', label: 'ID' },
  { key: 'status', label: 'Status' },
  { key: 'reasonCode', label: 'Reason' },
  { key: 'updatedAt', label: 'Updated', format: 'date' }
];

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const [adj, locs] = await Promise.all([
      apiClient.get('/inventory/adjustments'),
      apiClient.get('/inventory/locations')
    ]);
    rows.value = unwrapList(adj);
    locations.value = unwrapList(locs);
    if (!form.inventoryLocationId && locations.value[0]) {
      form.inventoryLocationId = locations.value[0].inventoryLocationId;
    }
  } catch (err) {
    error.value = err?.message || t('states.saving');
  } finally {
    loading.value = false;
  }
}

async function create() {
  saving.value = true;
  formError.value = '';
  try {
    await apiClient.post('/inventory/adjustments', {
      inventoryLocationId: form.inventoryLocationId,
      reasonCode: form.reasonCode,
      lines: [{ variantId: form.variantId, quantityDelta: form.quantityDelta }]
    });
    showCreate.value = false;
    await load();
  } catch (err) {
    formError.value = err?.message || t('states.genericFailure');
  } finally {
    saving.value = false;
  }
}

async function post(row) {
  try {
    await apiClient.post(`/inventory/adjustments/${row.inventoryAdjustmentId}/post`);
    await load();
  } catch (err) {
    error.value = err?.message || t('states.saving');
  }
}

onMounted(load);
</script>
