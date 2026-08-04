const INITIAL_PURCHASE_RETURN_QUICK_CREATE = [
  'subject',
  'vendorId',
  'returnDate',
  'ownerId',
  'returnType',
  'returnReason',
  'currency'
];

const INITIAL_PURCHASE_RETURN_REQUIRED_FIELDS = ['subject', 'vendorId'];

const INITIAL_PURCHASE_RETURN_REQUIRED_SET = new Set(
  INITIAL_PURCHASE_RETURN_REQUIRED_FIELDS.map((k) => String(k).toLowerCase())
);

const PURCHASE_RETURN_FORM_EXCLUDED_KEYS = new Set([
  'purchasereturnnumber',
  'subtotal',
  'taxtotal',
  'chargestotal',
  'grandtotal',
  'inventorypostedat',
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

function applyPurchaseReturnModuleFieldDefaults(fields) {
  if (!Array.isArray(fields)) return fields;
  return fields
    .filter((field) => {
      const key = String(field?.key || '').toLowerCase().replace(/[_\s]/g, '');
      return !PURCHASE_RETURN_FORM_EXCLUDED_KEYS.has(key);
    })
    .map((field) => {
      const key = String(field?.key || '').toLowerCase();
      if (!INITIAL_PURCHASE_RETURN_REQUIRED_SET.has(key)) return field;
      if (field.required === false) return field;
      return { ...field, required: true };
    });
}

function isInitialPurchaseReturnRequiredField(fieldKey) {
  return INITIAL_PURCHASE_RETURN_REQUIRED_SET.has(String(fieldKey || '').toLowerCase());
}

module.exports = {
  INITIAL_PURCHASE_RETURN_QUICK_CREATE,
  INITIAL_PURCHASE_RETURN_REQUIRED_FIELDS,
  applyPurchaseReturnModuleFieldDefaults,
  isInitialPurchaseReturnRequiredField
};
