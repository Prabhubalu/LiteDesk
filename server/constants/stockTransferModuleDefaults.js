const INITIAL_STOCK_TRANSFER_QUICK_CREATE = [];

const STOCK_TRANSFER_FORM_EXCLUDED_KEYS = new Set([
  'inventorytransferid',
  'status',
  'lines',
  'inventorytransactionid',
  'shippedat',
  'receivedat',
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

function applyStockTransferModuleFieldDefaults(fields) {
  if (!Array.isArray(fields)) return fields;
  return fields.filter((field) => {
    const key = String(field?.key || '')
      .toLowerCase()
      .replace(/[_\s-]/g, '');
    return !STOCK_TRANSFER_FORM_EXCLUDED_KEYS.has(key);
  });
}

module.exports = {
  INITIAL_STOCK_TRANSFER_QUICK_CREATE,
  applyStockTransferModuleFieldDefaults
};
