<template>
  <div class="mx-auto max-w-4xl space-y-6 px-6 py-10">
    <div>
      <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">
        {{ t('navigation.appInventory') }}
      </h1>
      <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
        {{ t('navigation.inventoryDashboardBlurb') }}
      </p>
    </div>
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <RouterLink
        v-for="link in links"
        :key="link.to"
        :to="link.to"
        class="rounded-xl border border-gray-200 bg-white p-4 text-sm font-medium text-gray-900 shadow-sm hover:border-indigo-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
      >
        {{ t(link.labelKey) }}
      </RouterLink>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';
import { useAuthStore } from '@/stores/authRegistry';
import { isCpqAddonEntitled, isStockroomAddonEntitled } from '@/utils/addonEntitlement';

const { t } = useI18n();
const authStore = useAuthStore();

const ALL_LINKS = [
  { to: '/inventory/purchase-orders', labelKey: 'navigation.inventoryPurchaseOrders' },
  { to: '/inventory/receipt-notes', labelKey: 'navigation.inventoryReceiptNotes' },
  { to: '/inventory/purchase-returns', labelKey: 'navigation.inventoryPurchaseReturns' },
  { to: '/inventory/delivery-notes', labelKey: 'navigation.inventoryDeliveryNotes' },
  { to: '/inventory/delivery-returns', labelKey: 'navigation.inventoryDeliveryReturns' },
  { to: '/inventory/sales-returns', labelKey: 'navigation.inventorySalesReturns' },
  {
    to: '/inventory/stockrooms',
    labelKey: 'navigation.inventoryStockrooms',
    requiresStockroom: true,
  },
  {
    to: '/inventory/adjustments',
    labelKey: 'navigation.inventoryAdjustments',
    requiresStockroom: true,
  },
  {
    to: '/inventory/transfers',
    labelKey: 'navigation.inventoryTransfers',
    requiresStockroom: true,
  },
  { to: '/settings?tab=inventory', labelKey: 'navigation.inventorySettings' },
  { to: '/settings?tab=inventory&inventoryView=taxes', labelKey: 'navigation.inventoryTaxes' },
  { to: '/settings?tab=inventory&inventoryView=charges', labelKey: 'navigation.inventoryCharges' },
  {
    to: '/settings?tab=catalog&catalogView=item-groups',
    labelKey: 'navigation.inventoryItemGroups',
    requiresCpq: true,
  },
  {
    to: '/settings?tab=catalog&catalogView=product-configurations',
    labelKey: 'navigation.inventoryProductConfigs',
    requiresCpq: true,
  },
];

const links = computed(() => {
  const stockroom = isStockroomAddonEntitled(authStore.user);
  const cpq = isCpqAddonEntitled(authStore.user);
  return ALL_LINKS.filter((link) => {
    if (link.requiresStockroom && !stockroom) return false;
    if (link.requiresCpq && !cpq) return false;
    return true;
  });
});
</script>
