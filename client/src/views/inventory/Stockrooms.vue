<template>
  <div>
    <InventoryTxnList
      title="Stockrooms"
      subtitle="Inventory locations (warehouses, stores, branches)"
      :columns="columns"
      :rows="rows"
      :loading="loading"
      :error="error"
      :create-label="addonActivated ? 'Refresh' : 'Activate add-on'"
      empty-label="No stockrooms yet. Activate the add-on to create the primary stockroom."
      @create="onPrimaryAction"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import apiClient from '@/utils/apiClient';
import InventoryTxnList from './InventoryTxnList.vue';

function unwrapList(res) {
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res)) return res;
  return [];
}

const rows = ref([]);
const loading = ref(false);
const error = ref('');
const activatedAt = ref(null);
const columns = [
  { key: 'name', label: 'Name' },
  { key: 'locationCode', label: 'Code' },
  { key: 'locationType', label: 'Type' },
  { key: 'status', label: 'Status' },
  { key: 'isDefault', label: 'Default' }
];

const addonActivated = computed(() => Boolean(activatedAt.value) || rows.value.length > 0);

async function load() {
  loading.value = true;
  error.value = '';
  try {
    rows.value = unwrapList(await apiClient.get('/inventory/locations'));
  } catch (err) {
    error.value = err?.message || 'Failed to load';
  } finally {
    loading.value = false;
  }
}

async function activate() {
  error.value = '';
  try {
    const res = await apiClient.post('/inventory/stockrooms/activate', {
      primaryName: 'Primary Stockroom'
    });
    activatedAt.value = res?.data?.activatedAt || new Date().toISOString();
    await load();
  } catch (err) {
    error.value = err?.message || 'Activation failed';
  }
}

async function onPrimaryAction() {
  if (addonActivated.value) {
    await load();
    return;
  }
  await activate();
}

onMounted(load);
</script>
