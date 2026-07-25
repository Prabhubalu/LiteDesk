<template>
  <div>
    <InventoryTxnList
      title="Purchase Orders"
      subtitle="Create and approve vendor purchase orders"
      :columns="columns"
      :rows="rows"
      :loading="loading"
      :error="error"
      create-label="New PO"
      empty-label="No purchase orders yet."
      @create="showCreate = true"
    >
      <template #actions="{ row }">
        <button
          v-if="['draft', 'pending_approval'].includes(row.status)"
          type="button"
          class="mr-2 text-sm text-indigo-600 hover:underline"
          @click="approve(row)"
        >
          Approve
        </button>
        <button
          v-if="row.status === 'draft'"
          type="button"
          class="text-sm text-gray-600 hover:underline"
          @click="submit(row)"
        >
          Submit
        </button>
      </template>
    </InventoryTxnList>

    <Teleport to="body">
      <div v-if="showCreate" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click.self="showCreate = false">
        <form class="w-full max-w-lg space-y-3 rounded-xl bg-white p-5 shadow-xl dark:bg-gray-800" @submit.prevent="create">
          <h3 class="text-base font-semibold text-gray-900 dark:text-white">New Purchase Order</h3>
          <label class="block text-sm">
            <span class="text-gray-700 dark:text-gray-300">Vendor ID</span>
            <input v-model="form.vendorId" required class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
          </label>
          <label class="block text-sm">
            <span class="text-gray-700 dark:text-gray-300">Variant ID</span>
            <input v-model="form.variantId" required class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
          </label>
          <div class="grid grid-cols-2 gap-3">
            <label class="block text-sm">
              <span class="text-gray-700 dark:text-gray-300">Qty</span>
              <input v-model.number="form.quantity" type="number" min="0.0001" step="any" required class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
            </label>
            <label class="block text-sm">
              <span class="text-gray-700 dark:text-gray-300">Unit price</span>
              <input v-model.number="form.unitPrice" type="number" min="0" step="any" class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
            </label>
          </div>
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
const loading = ref(false);
const saving = ref(false);
const error = ref('');
const formError = ref('');
const showCreate = ref(false);
const form = reactive({ vendorId: '', variantId: '', quantity: 1, unitPrice: 0 });
const columns = [
  { key: 'poNumber', label: 'PO #' },
  { key: 'status', label: 'Status' },
  { key: 'currency', label: 'Currency' },
  { key: 'grandTotal', label: 'Total' },
  { key: 'updatedAt', label: 'Updated', format: 'date' }
];

async function load() {
  loading.value = true;
  error.value = '';
  try {
    rows.value = unwrapList(await apiClient.get('/inventory/purchase-orders'));
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
    await apiClient.post('/inventory/purchase-orders', {
      vendorId: form.vendorId,
      lines: [{ variantId: form.variantId, quantityOrdered: form.quantity, unitPrice: form.unitPrice }]
    });
    showCreate.value = false;
    await load();
  } catch (err) {
    formError.value = err?.message || 'Create failed';
  } finally {
    saving.value = false;
  }
}

async function submit(row) {
  try {
    await apiClient.post(`/inventory/purchase-orders/${row._id}/submit`);
    await load();
  } catch (err) {
    error.value = err?.message || 'Submit failed';
  }
}

async function approve(row) {
  try {
    await apiClient.post(`/inventory/purchase-orders/${row._id}/approve`);
    await load();
  } catch (err) {
    error.value = err?.message || 'Approve failed';
  }
}

onMounted(load);
</script>
