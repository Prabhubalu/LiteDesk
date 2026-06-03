const INITIAL_INVOICE_QUICK_CREATE = [
  'invoiceTitle',
  'invoiceDate',
  'dueDate',
  'currency',
  'contactId',
  'organizationRefId',
  'dealId',
  'ownerId'
];

const INITIAL_INVOICE_REQUIRED_FIELDS = ['invoiceTitle'];

const INITIAL_INVOICE_REQUIRED_SET = new Set(
  INITIAL_INVOICE_REQUIRED_FIELDS.map((k) => String(k).toLowerCase())
);

function applyInvoiceModuleFieldDefaults(fields) {
  if (!Array.isArray(fields)) return fields;
  return fields.map((field) => {
    const key = String(field?.key || '').toLowerCase();
    if (!INITIAL_INVOICE_REQUIRED_SET.has(key)) return field;
    if (field.required === false) return field;
    return { ...field, required: true };
  });
}

function isInitialInvoiceRequiredField(fieldKey) {
  return INITIAL_INVOICE_REQUIRED_SET.has(String(fieldKey || '').toLowerCase());
}

module.exports = {
  INITIAL_INVOICE_QUICK_CREATE,
  INITIAL_INVOICE_REQUIRED_FIELDS,
  applyInvoiceModuleFieldDefaults,
  isInitialInvoiceRequiredField
};
