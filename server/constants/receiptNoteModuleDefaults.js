const INITIAL_RECEIPT_NOTE_QUICK_CREATE = [
  'receiptDate',
  'vendorDeliveryChallanNo',
  'transportDetails',
  'notes'
];

const INITIAL_RECEIPT_NOTE_REQUIRED_FIELDS = [];

const INITIAL_RECEIPT_NOTE_REQUIRED_SET = new Set(
  INITIAL_RECEIPT_NOTE_REQUIRED_FIELDS.map((k) => String(k).toLowerCase())
);

const RECEIPT_NOTE_FORM_EXCLUDED_KEYS = new Set([
  'receiptnotenumber',
  'receivedby',
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

function applyReceiptNoteModuleFieldDefaults(fields) {
  if (!Array.isArray(fields)) return fields;
  return fields
    .filter((field) => {
      const key = String(field?.key || '')
        .toLowerCase()
        .replace(/[_\s]/g, '');
      return !RECEIPT_NOTE_FORM_EXCLUDED_KEYS.has(key);
    })
    .map((field) => {
      const key = String(field?.key || '').toLowerCase();
      if (!INITIAL_RECEIPT_NOTE_REQUIRED_SET.has(key)) return field;
      if (field.required === false) return field;
      return { ...field, required: true };
    });
}

function isInitialReceiptNoteRequiredField(fieldKey) {
  return INITIAL_RECEIPT_NOTE_REQUIRED_SET.has(String(fieldKey || '').toLowerCase());
}

module.exports = {
  INITIAL_RECEIPT_NOTE_QUICK_CREATE,
  INITIAL_RECEIPT_NOTE_REQUIRED_FIELDS,
  applyReceiptNoteModuleFieldDefaults,
  isInitialReceiptNoteRequiredField
};
