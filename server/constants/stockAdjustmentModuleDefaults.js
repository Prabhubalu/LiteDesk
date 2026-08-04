const INITIAL_STOCK_ADJUSTMENT_QUICK_CREATE = [];

const INITIAL_STOCK_ADJUSTMENT_REQUIRED_FIELDS = [];

const STOCK_ADJUSTMENT_FORM_EXCLUDED_KEYS = new Set([
  'inventoryadjustmentid',
  'status',
  'lines',
  'inventorytransactionid',
  'postedat',
  'postedby',
  'modifiedby',
  'organizationid',
  'createdby',
  'createdat',
  'updatedat',
  'deletedat',
  'deletedby',
  'deletionreason',
  'externalreferenceid',
  'syncstatus',
  'lastsyncat'
]);

function applyStockAdjustmentModuleFieldDefaults(fields) {
  if (!Array.isArray(fields)) return fields;
  return fields
    .filter((field) => {
      const key = String(field?.key || '')
        .toLowerCase()
        .replace(/[_\s-]/g, '');
      return !STOCK_ADJUSTMENT_FORM_EXCLUDED_KEYS.has(key);
    });
}

function isInitialStockAdjustmentRequiredField() {
  return false;
}

module.exports = {
  INITIAL_STOCK_ADJUSTMENT_QUICK_CREATE,
  INITIAL_STOCK_ADJUSTMENT_REQUIRED_FIELDS,
  applyStockAdjustmentModuleFieldDefaults,
  isInitialStockAdjustmentRequiredField
};
