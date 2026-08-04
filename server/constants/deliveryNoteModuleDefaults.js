const INITIAL_DELIVERY_NOTE_QUICK_CREATE = [
  'subject',
  'customerId',
  'deliveryDate',
  'ownerId',
  'sourceType',
  'warehouseId',
  'currency'
];

const INITIAL_DELIVERY_NOTE_REQUIRED_FIELDS = ['subject', 'customerId', 'deliveryDate'];

const INITIAL_DELIVERY_NOTE_REQUIRED_SET = new Set(
  INITIAL_DELIVERY_NOTE_REQUIRED_FIELDS.map((k) => String(k).toLowerCase())
);

const DELIVERY_NOTE_FORM_EXCLUDED_KEYS = new Set([
  'deliverynotenumber',
  'subtotal',
  'taxtotal',
  'chargestotal',
  'grandtotal',
  'inventorypostedat',
  'fulfillmenteventid',
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

function applyDeliveryNoteModuleFieldDefaults(fields) {
  if (!Array.isArray(fields)) return fields;
  return fields
    .filter((field) => {
      const key = String(field?.key || '')
        .toLowerCase()
        .replace(/[_\s]/g, '');
      return !DELIVERY_NOTE_FORM_EXCLUDED_KEYS.has(key);
    })
    .map((field) => {
      const key = String(field?.key || '').toLowerCase();
      if (!INITIAL_DELIVERY_NOTE_REQUIRED_SET.has(key)) return field;
      if (field.required === false) return field;
      return { ...field, required: true };
    });
}

function isInitialDeliveryNoteRequiredField(fieldKey) {
  return INITIAL_DELIVERY_NOTE_REQUIRED_SET.has(String(fieldKey || '').toLowerCase());
}

module.exports = {
  INITIAL_DELIVERY_NOTE_QUICK_CREATE,
  INITIAL_DELIVERY_NOTE_REQUIRED_FIELDS,
  applyDeliveryNoteModuleFieldDefaults,
  isInitialDeliveryNoteRequiredField
};
