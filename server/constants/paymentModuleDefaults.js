const { PAYMENT_STATUSES, PAYMENT_PURPOSES } = require('./paymentLifecycle');

const INITIAL_PAYMENT_QUICK_CREATE = [
  { key: 'organizationRefId', required: true },
  { key: 'amount', required: true },
  { key: 'paymentCurrency', required: true },
  { key: 'paymentDate', required: true },
  { key: 'paymentPurpose', required: true }
];

function applyPaymentModuleFieldDefaults(fields) {
  return (fields || []).map((field) => ({
    visible: true,
    editable: !field.system,
    ...field
  }));
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
  INITIAL_PAYMENT_FIELDS,
  applyPaymentModuleFieldDefaults
};
