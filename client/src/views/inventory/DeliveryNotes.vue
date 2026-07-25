<template>
  <div>
    <InventoryTxnList
      title="Delivery Notes"
      subtitle="Dispatch goods against sales orders"
      :columns="columns"
      :rows="rows"
      :loading="loading"
      :error="error"
      create-label="New DN"
      empty-label="No delivery notes yet."
      @create="showCreate = true"
    >
      <template #actions="{ row }">
        <button
          v-if="['draft', 'ready_for_dispatch'].includes(row.status)"
          type="button"
          class="text-sm text-indigo-600 hover:underline"
          @click="confirm(row)"
        >
          Confirm
        </button>
      </template>
    </InventoryTxnList>

    <Teleport to="body">
      <div v-if="showCreate" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click.self="showCreate = false">
        <form class="w-full max-w-lg space-y-3 rounded-xl bg-white p-5 shadow-xl dark:bg-gray-800" @submit.prevent="create">
          <h3 class="text-base font-semibold text-gray-900 dark:text-white">New Delivery Note</h3>
          <label class="block text-sm">
            <span>Sales Order ID</span>
            <input v-model="form.salesOrderId" required class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
          </label>
          <label class="block text-sm">
            <span>Stockroom</span>
            <select v-model="form.inventoryLocationId" required class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white">
              <option disabled value="">Select</option>
              <option v-for="loc in locations" :key="loc.inventoryLocationId" :value="loc.inventoryLocationId">{{ loc.name }}</option>
            </select>
          </label>
          <p v-if="formError" class="text-sm text-red-600">{{ formError }}</p>
          <div class="flex justify-end gap-2">
            <button type="button" class="px-3 py-2 text-sm" @click="showCreate = false">Cancel</button>
            <button type="submit" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white" :disabled="saving">Save</button>
          </div>
        </form>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { Teleport } from 'vue';
import apiClient from '@/utils/apiClient';
import InventoryTxnList from './InventoryTxnList.vue';

function unwrapList(res) {
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res)) return res;
  return [];
}

const rows = ref([]);
const locations = ref([]);
const loading = ref(false);
const saving = ref(false);
const error = ref('');
const formError = ref('');
const showCreate = ref(false);
const form = reactive({ salesOrderId: '', inventoryLocationId: '' });
const columns = [
  { key: 'deliveryNoteNumber', label: 'DN #' },
  { key: 'status', label: 'Status' },
  { key: 'deliveryDate', label: 'Date', format: 'date' },
  { key: 'updatedAt', label: 'Updated', format: 'date' }
];

async function load() {
  loading.value = true;
  try {
    const [dn, locs] = await Promise.all([
      apiClient.get('/inventory/delivery-notes'),
      apiClient.get('/inventory/locations')
    ]);
    rows.value = unwrapList(dn);
    locations.value = unwrapList(locs);
    if (!form.inventoryLocationId && locations.value[0]) {
      form.inventoryLocationId = locations.value[0].inventoryLocationId;
    }
  } catch (err) {
    error.value = err?.message || 'Failed to load';
  } finally {
    loading.value = false;
  }
}

async function create() {
  saving.value = true;
  formError.value = '';
  try {
    await apiClient.post('/inventory/delivery-notes', {
      salesOrderId: form.salesOrderId,
      inventoryLocationId: form.inventoryLocationId
    });
    showCreate.value = false;
    await load();
  } catch (err) {
    formError.value = err?.message || 'Create failed';
  } finally {
    saving.value = false;
  }
}

async function confirm(row) {
  try {
    await apiClient.post(`/inventory/delivery-notes/${row._id}/confirm`);
    await load();
  } catch (err) {
    error.value = err?.message || 'Confirm failed';
  }
}

onMounted(load);
</script>
