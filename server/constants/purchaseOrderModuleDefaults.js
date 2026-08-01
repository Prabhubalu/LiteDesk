const INITIAL_PURCHASE_ORDER_QUICK_CREATE = [
  'vendorId',
  'poDate',
  'expectedDeliveryDate',
  'currency',
  'paymentTerms',
  'buyerId',
  'vendorReferenceNumber'
];

const INITIAL_PURCHASE_ORDER_REQUIRED_FIELDS = ['vendorId'];

const INITIAL_PURCHASE_ORDER_REQUIRED_SET = new Set(
  INITIAL_PURCHASE_ORDER_REQUIRED_FIELDS.map((k) => String(k).toLowerCase())
);

function applyPurchaseOrderModuleFieldDefaults(fields) {
  if (!Array.isArray(fields)) return fields;
  return fields.map((field) => {
    const key = String(field?.key || '').toLowerCase();
    if (!INITIAL_PURCHASE_ORDER_REQUIRED_SET.has(key)) return field;
    if (field.required === false) return field;
    return { ...field, required: true };
  });
}

function isInitialPurchaseOrderRequiredField(fieldKey) {
  return INITIAL_PURCHASE_ORDER_REQUIRED_SET.has(String(fieldKey || '').toLowerCase());
}

module.exports = {
  INITIAL_PURCHASE_ORDER_QUICK_CREATE,
  INITIAL_PURCHASE_ORDER_REQUIRED_FIELDS,
  applyPurchaseOrderModuleFieldDefaults,
  isInitialPurchaseOrderRequiredField
};
