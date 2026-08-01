/**
 * Inventory commercial/ops workbench links shared by app sidebar and Settings → Applications → Inventory.
 * These map to app-owned system modules (appKey: inventory) for fields settings,
 * parallel to Sales deals / Helpdesk cases.
 */
export type InventoryWorkbenchItem = {
  key: string;
  route: string;
  labelKey: string;
  label: string;
  icon: string;
};

export const INVENTORY_WORKBENCH_MODULES: InventoryWorkbenchItem[] = [
  { key: 'purchase_orders', route: '/inventory/purchase-orders', labelKey: 'navigation.inventoryPurchaseOrders', label: 'Purchase Orders', icon: 'document-text' },
  { key: 'receipt_notes', route: '/inventory/receipt-notes', labelKey: 'navigation.inventoryReceiptNotes', label: 'Receipt Notes', icon: 'inbox-arrow-down' },
  { key: 'purchase_returns', route: '/inventory/purchase-returns', labelKey: 'navigation.inventoryPurchaseReturns', label: 'Purchase Returns', icon: 'arrow-uturn-left' },
  { key: 'delivery_notes', route: '/inventory/delivery-notes', labelKey: 'navigation.inventoryDeliveryNotes', label: 'Delivery Notes', icon: 'truck' },
  { key: 'delivery_returns', route: '/inventory/delivery-returns', labelKey: 'navigation.inventoryDeliveryReturns', label: 'Delivery Returns', icon: 'arrow-uturn-right' },
  { key: 'sales_returns', route: '/inventory/sales-returns', labelKey: 'navigation.inventorySalesReturns', label: 'Sales Returns', icon: 'receipt-refund' },
  { key: 'stockrooms', route: '/inventory/stockrooms', labelKey: 'navigation.inventoryStockrooms', label: 'Stockrooms', icon: 'building-storefront' },
  { key: 'stock_adjustments', route: '/inventory/adjustments', labelKey: 'navigation.inventoryAdjustments', label: 'Stock Adjustments', icon: 'adjustments-horizontal' },
  { key: 'stock_transfers', route: '/inventory/transfers', labelKey: 'navigation.inventoryTransfers', label: 'Stock Transfers', icon: 'arrows-right-left' },
];

export const INVENTORY_WORKBENCH_MODULE_KEYS = new Set(
  INVENTORY_WORKBENCH_MODULES.map((m) => m.key)
);

export function isInventorySchemaModuleKey(key: string | null | undefined): boolean {
  const k = String(key || '').toLowerCase();
  return k === 'inventory' || INVENTORY_WORKBENCH_MODULE_KEYS.has(k);
}
