const INITIAL_DELIVERY_RETURN_QUICK_CREATE = [
  'subject',
  'customerId',
  'returnDate',
  'ownerId',
  'sourceType',
  'returnType',
  'returnReason',
  'currency'
];

const INITIAL_DELIVERY_RETURN_REQUIRED_FIELDS = ['subject', 'customerId'];

const INITIAL_DELIVERY_RETURN_REQUIRED_SET = new Set(
  INITIAL_DELIVERY_RETURN_REQUIRED_FIELDS.map((k) => String(k).toLowerCase())
);

const DELIVERY_RETURN_FORM_EXCLUDED_KEYS = new Set([
  'deliveryreturnnumber',
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

function applyDeliveryReturnModuleFieldDefaults(fields) {
  if (!Array.isArray(fields)) return fields;
  return fields
    .filter((field) => {
      const key = String(field?.key || '')
        .toLowerCase()
        .replace(/[_\s]/g, '');
      return !DELIVERY_RETURN_FORM_EXCLUDED_KEYS.has(key);
    })
    .map((field) => {
      const key = String(field?.key || '').toLowerCase();
      if (!INITIAL_DELIVERY_RETURN_REQUIRED_SET.has(key)) return field;
      if (field.required === false) return field;
      return { ...field, required: true };
    });
}

function isInitialDeliveryReturnRequiredField(fieldKey) {
  return INITIAL_DELIVERY_RETURN_REQUIRED_SET.has(String(fieldKey || '').toLowerCase());
}

module.exports = {
  INITIAL_DELIVERY_RETURN_QUICK_CREATE,
  INITIAL_DELIVERY_RETURN_REQUIRED_FIELDS,
  applyDeliveryReturnModuleFieldDefaults,
  isInitialDeliveryReturnRequiredField
};
