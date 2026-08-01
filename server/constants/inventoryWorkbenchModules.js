/**
 * Inventory app workbench modules — commercial/ops documents shown in app nav
 * and Settings → Applications → Inventory fields configuration.
 *
 * These are app-owned system modules (appKey: inventory), parallel to
 * Helpdesk cases / Sales deals — not platform Core Modules.
 */

const INVENTORY_WORKBENCH_MODULES = [
  { key: 'purchase_orders', name: 'Purchase Orders' },
  { key: 'receipt_notes', name: 'Receipt Notes' },
  { key: 'purchase_returns', name: 'Purchase Returns' },
  { key: 'delivery_notes', name: 'Delivery Notes' },
  { key: 'delivery_returns', name: 'Delivery Returns' },
  { key: 'sales_returns', name: 'Sales Returns' },
  { key: 'stockrooms', name: 'Stockrooms' },
  { key: 'stock_adjustments', name: 'Stock Adjustments' },
  { key: 'stock_transfers', name: 'Stock Transfers' },
];

const INVENTORY_WORKBENCH_KEYS = INVENTORY_WORKBENCH_MODULES.map((m) => m.key);

const INVENTORY_SCHEMA_MODULE_KEYS = new Set(['inventory', ...INVENTORY_WORKBENCH_KEYS]);

/**
 * Resolve the primary Mongoose model for Inventory workbench / ledger modules.
 * @param {string} key
 * @returns {object|null} Mongoose model (may be tenant proxy)
 */
function resolveInventoryModuleModel(key) {
  const k = String(key || '').toLowerCase();
  switch (k) {
    case 'purchase_orders':
      return require('../models/PurchaseOrder').PurchaseOrder;
    case 'receipt_notes':
      return require('../models/ReceiptNote').ReceiptNote;
    case 'purchase_returns':
      return require('../models/PurchaseReturn').PurchaseReturn;
    case 'delivery_notes':
      return require('../services/fulfillmentDocsService').DeliveryNote;
    case 'delivery_returns':
      return require('../services/fulfillmentDocsService').DeliveryReturn;
    case 'sales_returns':
      return require('../services/fulfillmentDocsService').SalesReturn;
    case 'stockrooms':
      return require('../models/InventoryLocation');
    case 'stock_adjustments':
      return require('../models/InventoryAdjustment');
    case 'stock_transfers':
      return require('../models/InventoryTransfer');
    default:
      return null;
  }
}

function isInventorySchemaModuleKey(key) {
  return INVENTORY_SCHEMA_MODULE_KEYS.has(String(key || '').toLowerCase());
}

module.exports = {
  INVENTORY_WORKBENCH_MODULES,
  INVENTORY_WORKBENCH_KEYS,
  INVENTORY_SCHEMA_MODULE_KEYS,
  resolveInventoryModuleModel,
  isInventorySchemaModuleKey,
};
