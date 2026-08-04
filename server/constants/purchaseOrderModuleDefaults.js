const INITIAL_PURCHASE_ORDER_QUICK_CREATE = [
  'subject',
  'vendorId',
  'poDate',
  'expectedDeliveryDate',
  'buyerId',
  'deliveryWarehouseId',
  'deliveryMethod',
  'currency'
];

const INITIAL_PURCHASE_ORDER_REQUIRED_FIELDS = ['subject', 'vendorId'];

const INITIAL_PURCHASE_ORDER_REQUIRED_SET = new Set(
  INITIAL_PURCHASE_ORDER_REQUIRED_FIELDS.map((k) => String(k).toLowerCase())
);

/** Engine-owned / auto fields — strip from module field lists used in forms & settings. */
const PURCHASE_ORDER_FORM_EXCLUDED_KEYS = new Set([
  'ponumber',
  'subtotal',
  'overalldiscounttype',
  'overalldiscountvalue',
  'overalldiscounttotal',
  'pretaxtotal',
  'taxtotal',
  'chargestotal',
  'adjustmenttotal',
  'grandtotal',
  'transactiontaxsnapshot',
  'taxdocumentsnapshot',
  'chargedocumentsnapshot',
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

function applyPurchaseOrderModuleFieldDefaults(fields) {
  if (!Array.isArray(fields)) return fields;
  return fields
    .filter((field) => {
      const key = String(field?.key || '').toLowerCase().replace(/[_\s]/g, '');
      return !PURCHASE_ORDER_FORM_EXCLUDED_KEYS.has(key);
    })
    .map((field) => {
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
