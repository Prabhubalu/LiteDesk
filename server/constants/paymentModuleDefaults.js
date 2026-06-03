const { PAYMENT_STATUSES, PAYMENT_PURPOSES } = require('./paymentLifecycle');

const INITIAL_PAYMENT_QUICK_CREATE = [
  'organizationRefId',
  'amount',
  'paymentCurrency',
  'paymentDate',
  'paymentPurpose'
];

const INITIAL_PAYMENT_REQUIRED_FIELDS = ['amount', 'paymentCurrency', 'paymentDate'];

const INITIAL_PAYMENT_REQUIRED_SET = new Set(
  INITIAL_PAYMENT_REQUIRED_FIELDS.map((k) => String(k).toLowerCase())
);

function applyPaymentModuleFieldDefaults(fields) {
  if (!Array.isArray(fields)) return fields;
  return fields.map((field) => {
    const key = String(field?.key || '').toLowerCase();
    const withDefaults = {
      visible: true,
      editable: !field.system,
      ...field
    };
    if (!INITIAL_PAYMENT_REQUIRED_SET.has(key)) return withDefaults;
    if (field.required === false) return withDefaults;
    return { ...withDefaults, required: true };
  });
}

function isInitialPaymentRequiredField(fieldKey) {
  return INITIAL_PAYMENT_REQUIRED_SET.has(String(fieldKey || '').toLowerCase());
}

const INITIAL_PAYMENT_FIELDS = [
  { key: 'paymentNumber', label: 'Payment Number', type: 'text', system: true },
  { key: 'status', label: 'Status', type: 'select', options: PAYMENT_STATUSES, system: true },
  { key: 'paymentPurpose', label: 'Purpose', type: 'select', options: PAYMENT_PURPOSES },
  { key: 'amount', label: 'Amount', type: 'currency', required: true },
  { key: 'paymentCurrency', label: 'Currency', type: 'text', required: true },
  { key: 'paymentDate', label: 'Payment Date', type: 'date', required: true },
  { key: 'amountAllocated', label: 'Allocated', type: 'currency', system: true },
  { key: 'amountUnallocated', label: 'Unallocated', type: 'currency', system: true },
  { key: 'organizationRefId', label: 'Account', type: 'lookup', lookupModule: 'organizations' },
  { key: 'contactId', label: 'Contact', type: 'lookup', lookupModule: 'people' }
];

module.exports = {
  INITIAL_PAYMENT_QUICK_CREATE,
  INITIAL_PAYMENT_REQUIRED_FIELDS,
  INITIAL_PAYMENT_FIELDS,
  applyPaymentModuleFieldDefaults,
  isInitialPaymentRequiredField
};
