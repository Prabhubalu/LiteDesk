<template>
  <div class="mx-auto w-full">
    <!-- Registry-Driven ModuleList -->
    <ModuleList
      ref="moduleListRef"
      module-key="items"
      app-key="PLATFORM"
      @create="openCreateModal"
      @import="showImportModal = true"
      @export="exportItems"
      @row-click="handleRowClick"
      @delete="handleInlineDelete"
      @bulk-action="handleBulkAction"
    >
      <!-- Custom Item Name Cell -->
      <template #cell-item_name="{ row }">
        <div class="flex items-center gap-3">
          <div v-if="row.product_image" class="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0">
            <img :src="row.product_image" :alt="row.item_name" class="w-full h-full object-cover" />
          </div>
          <div v-else class="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
            <span class="text-white font-semibold text-sm">{{ getInitials(row.item_name) }}</span>
          </div>
          <div class="min-w-0 flex-1">
            <div class="min-w-0 font-semibold text-gray-900 dark:text-white truncate">
              {{ row.item_name }}
            </div>
            <div v-if="row.item_code" class="min-w-0 text-xs text-gray-500 dark:text-gray-400 truncate">
              {{ row.item_code }}
            </div>
          </div>
        </div>
      </template>

      <!-- Custom Item Type Cell with Badge -->
      <template #cell-item_type="{ value }">
        <BadgeCell 
          :value="value" 
          :variant-map="{
            'Product': 'primary',
            'Service': 'info',
            'Serialized Product': 'warning',
            'Non-Stock Product': 'default'
          }"
        />
      </template>

      <!-- Custom Status Cell with Badge -->
      <template #cell-status="{ value }">
        <BadgeCell 
          :value="value" 
          :variant-map="{
            'Active': 'success',
            'Inactive': 'default'
          }"
        />
      </template>

      <!-- Custom Category Cell -->
      <template #cell-category="{ value }">
        <span v-if="value" class="text-sm text-gray-700 dark:text-gray-300">{{ value }}</span>
        <span v-else class="text-sm text-gray-500 dark:text-gray-400">-</span>
      </template>

      <!-- Custom Stock Quantity Cell with low stock warning -->
      <template #cell-stock_quantity="{ row }">
        <div v-if="row.item_type === 'Service' || row.item_type === 'Non-Stock Product'" class="text-sm text-gray-500 dark:text-gray-400">{{ t('forms.rbpMetricNa') }}</div>
        <div v-else class="flex items-center gap-2">
          <span :class="[
            'text-sm font-medium',
            row.stock_quantity === 0 ? 'text-red-600 dark:text-red-400' :
            (row.reorder_level > 0 && row.stock_quantity <= row.reorder_level) ? 'text-yellow-600 dark:text-yellow-400' :
            'text-gray-700 dark:text-gray-300'
          ]">
            {{ row.stock_quantity || 0 }} {{ row.unit_of_measure || 'pcs' }}
          </span>
          <svg 
            v-if="row.stock_quantity === 0" 
            class="w-4 h-4 text-red-600 dark:text-red-400" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <svg 
            v-else-if="row.reorder_level > 0 && row.stock_quantity <= row.reorder_level" 
            class="w-4 h-4 text-yellow-600 dark:text-yellow-400" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
      </template>

      <!-- Custom Selling Price Cell -->
      <template #cell-selling_price="{ value, row }">
        <span v-if="value" class="text-sm font-medium text-gray-900 dark:text-white">
          {{ formatCurrency(value, row?.currencyCode || row?.currency) }}
        </span>
        <span v-else class="text-sm text-gray-500 dark:text-gray-400">-</span>
      </template>

      <!-- Custom Vendor Cell -->
      <template #cell-vendor="{ row }">
        <span v-if="row.vendor" class="text-sm text-gray-700 dark:text-gray-300">
          {{ typeof row.vendor === 'object' ? row.vendor.name : row.vendor }}
        </span>
        <span v-else class="text-sm text-gray-500 dark:text-gray-400">-</span>
      </template>

      <!-- Custom Tags Cell -->
      <template #cell-tags="{ value }">
        <div v-if="value && value.length > 0" class="flex flex-wrap gap-1">
          <span 
            v-for="tag in value.slice(0, 2)" 
            :key="tag"
            class="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs"
          >
            {{ tag }}
          </span>
          <span v-if="value.length > 2" class="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs">
            +{{ value.length - 2 }}
          </span>
        </div>
        <span v-else class="text-sm text-gray-500 dark:text-gray-400">-</span>
      </template>

      <!-- Custom Created Date Cell -->
      <template #cell-createdAt="{ value }">
        <DateCell :value="value" format="short" />
      </template>

    </ModuleList>

    <!-- Item Form Modal -->
    <CreateRecordDrawer 
      :isOpen="showFormModal"
      moduleKey="items"
      :record="editingItem"
      @close="closeFormModal"
      @saved="handleItemSave"
    />

    <!-- CSV Import Modal -->
    <CSVImportModal 
      v-if="showImportModal"
      entity-type="Items"
      @close="showImportModal = false"
      @import-complete="handleImportComplete"
    />
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
import { ref, onActivated } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authRegistry';
import { useTabs } from '@/composables/useTabs';
import apiClient from '@/utils/apiClient';
import ModuleList from '@/components/module-list/ModuleList.vue';
import BadgeCell from '@/components/common/table/BadgeCell.vue';
import DateCell from '@/components/common/table/DateCell.vue';
import CreateRecordDrawer from '@/components/common/CreateRecordDrawer.vue';
import CSVImportModal from '@/components/import/CSVImportModal.vue';
import { DEFAULT_CURRENCY_CODE, formatCurrencyValue } from '@/utils/currencyOptions';

const router = useRouter();
const authStore = useAuthStore();
const { openTab } = useTabs();

// State
const moduleListRef = ref(null);
const showFormModal = ref(false);
const showImportModal = ref(false);
const editingItem = ref(null);

const refreshList = () => {
  moduleListRef.value?.refresh?.();
};

// When switching back to this tab (keep-alive), refetch so data is current
onActivated(() => {
  refreshList();
});

// Modal handlers
const openCreateModal = () => {
  editingItem.value = null;
  showFormModal.value = true;
};

const handleRowClick = (row) => {
  // Navigate to item detail if route exists
  openTab(`/items/${row._id}`, {
    title: row.item_name || 'Item Detail',
    icon: 'cube',
    background: false,
    insertAdjacent: true
  });
};

const handleBulkAction = async (actionId, selectedRows) => {
  const itemIds = selectedRows.map(item => item._id);
  
  try {
    if (actionId === 'delete' || actionId === 'bulk-delete') {
      await Promise.all(itemIds.map(id => 
        apiClient(`/items/${id}`, { method: 'DELETE' })
      ));
      refreshList();
    } else if (actionId === 'export' || actionId === 'bulk-export') {
      exportItemsToCSV(selectedRows);
    }
  } catch (error) {
    console.error('Error performing bulk action:', error);
    alert('Error performing bulk action. Please try again.');
  }
};

const handleInlineDelete = async (row) => {
  if (!row) return;
  await handleBulkAction('delete', [row]);
};

// Export items
const exportItems = async () => {
  try {
    const response = await fetch('/api/csv/export/items', {
      headers: {
        'Authorization': `Bearer ${authStore.user?.token}`
      }
    });
    
    if (!response.ok) throw new Error('Export failed');
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `items_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error exporting items:', error);
    alert('Error exporting items. Please try again.');
  }
};

const exportItemsToCSV = (itemsToExport) => {
  const csv = [
    ['Item Name', 'Item Code', 'Item Type', 'Category', 'Status', 'Stock Quantity', 'Selling Price', 'Cost Price', 'Vendor'].join(','),
    ...itemsToExport.map(item => [
      `"${item.item_name || ''}"`,
      item.item_code || '',
      item.item_type || '',
      item.category || '',
      item.status || '',
      item.stock_quantity || 0,
      item.selling_price || 0,
      item.cost_price || 0,
      typeof item.vendor === 'object' ? item.vendor?.name || '' : item.vendor || ''
    ].join(','))
  ].join('\n');
  
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `items-export-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
};

const handleImportComplete = () => {
  showImportModal.value = false;
  refreshList();
};

const handleItemSave = () => {
  showFormModal.value = false;
  editingItem.value = null;
  refreshList();
};

const closeFormModal = () => {
  showFormModal.value = false;
  editingItem.value = null;
};

// Utility functions
const formatCurrency = (amount, currencyCode = DEFAULT_CURRENCY_CODE) => {
  return (
    formatCurrencyValue(amount, {
      currencyCode: String(currencyCode || DEFAULT_CURRENCY_CODE).toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) || '—'
  );
};

const getInitials = (name) => {
  if (!name) return '?';
  const words = name.split(' ');
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};
</script>

