<template>
  <div>
    <InventoryTxnList
      title="Purchase Returns"
      subtitle="Return goods to vendors from verified receipts"
      :columns="columns"
      :rows="rows"
      :loading="loading"
      :error="error"
      create-label="New Return"
      empty-label="No purchase returns yet."
      @create="showCreate = true"
    >
      <template #actions="{ row }">
        <button
          v-if="['draft', 'pending_approval'].includes(row.status)"
          type="button"
          class="text-sm text-indigo-600 hover:underline"
          @click="approve(row)"
        >
          Approve
        </button>
      </template>
    </InventoryTxnList>

    <Teleport to="body">
      <div v-if="showCreate" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click.self="showCreate = false">
        <form class="w-full max-w-lg space-y-3 rounded-xl bg-white p-5 shadow-xl dark:bg-gray-800" @submit.prevent="create">
          <h3 class="text-base font-semibold text-gray-900 dark:text-white">New Purchase Return</h3>
          <label class="block text-sm">
            <span>Receipt Note ID</span>
            <input v-model="form.receiptNoteId" required class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
          </label>
          <label class="block text-sm">
            <span>Return reason</span>
            <input v-model="form.returnReason" required class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
          </label>
          <p class="text-xs text-gray-500">Lines are built from accepted receipt quantities.</p>
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
const form = reactive({ receiptNoteId: '', returnReason: 'Damaged / Excess' });
const columns = [
  { key: 'purchaseReturnNumber', label: 'PR #' },
  { key: 'status', label: 'Status' },
  { key: 'grandTotal', label: 'Total' },
  { key: 'updatedAt', label: 'Updated', format: 'date' }
];

async function load() {
  loading.value = true;
  try {
    rows.value = unwrapList(await apiClient.get('/inventory/purchase-returns'));
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
    const detail = await apiClient.get(`/inventory/receipt-notes/${form.receiptNoteId}`);
    const rnLines = Array.isArray(detail?.data?.lines)
      ? detail.data.lines
      : Array.isArray(detail?.lines)
        ? detail.lines
        : [];
    if (!rnLines.length) throw new Error('Receipt note has no lines');
    await apiClient.post('/inventory/purchase-returns', {
      receiptNoteId: form.receiptNoteId,
      returnReason: form.returnReason,
      lines: rnLines
        .filter((l) => Number(l.quantityAccepted || 0) - Number(l.quantityReturned || 0) > 0)
        .map((l) => ({
          receiptNoteLineId: l._id,
          quantityReturned: Number(l.quantityAccepted || 0) - Number(l.quantityReturned || 0),
          returnReason: form.returnReason
        }))
    });
    showCreate.value = false;
    await load();
  } catch (err) {
    formError.value = err?.message || 'Create failed';
  } finally {
    saving.value = false;
  }
}

async function approve(row) {
  try {
    await apiClient.post(`/inventory/purchase-returns/${row._id}/approve`);
    await load();
  } catch (err) {
    error.value = err?.message || 'Approve failed';
  }
}

onMounted(load);
</script>
