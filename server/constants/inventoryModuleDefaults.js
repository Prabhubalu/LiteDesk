/**
 * Platform inventory module field defaults (INV0).
 */

const INITIAL_INVENTORY_FIELDS = [
  { key: 'inventoryLocationId', label: 'Location ID', type: 'text', system: true, readOnly: true },
  { key: 'locationCode', label: 'Location Code', type: 'text', required: true },
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'locationType', label: 'Type', type: 'picklist', required: true },
  { key: 'status', label: 'Status', type: 'picklist', required: true }
];

const INITIAL_INVENTORY_QUICK_CREATE = ['locationCode', 'name', 'locationType'];

function applyInventoryModuleFieldDefaults(fields = []) {
  return fields.map((field) => ({
    system: false,
    readOnly: false,
    required: false,
    ...field
  }));
}

module.exports = {
  INITIAL_INVENTORY_FIELDS,
  INITIAL_INVENTORY_QUICK_CREATE,
  applyInventoryModuleFieldDefaults
};
