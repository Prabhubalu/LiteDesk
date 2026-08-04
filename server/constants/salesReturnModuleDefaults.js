const INITIAL_SALES_RETURN_QUICK_CREATE = [
  'invoiceId',
  'returnLocationId',
  'overallReturnReason',
  'returnDate',
  'returnType'
];

const INITIAL_SALES_RETURN_REQUIRED_FIELDS = [
  'invoiceId',
  'returnLocationId',
  'overallReturnReason'
];

const INITIAL_SALES_RETURN_REQUIRED_SET = new Set(
  INITIAL_SALES_RETURN_REQUIRED_FIELDS.map((k) => String(k).toLowerCase())
);

const SALES_RETURN_FORM_EXCLUDED_KEYS = new Set([
  'salesreturnnumber',
  'subtotal',
  'taxtotal',
  'chargestotal',
  'grandtotal',
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
  'lastsyncat',
  'status',
  'customerid',
  'deliverynoteid',
  'salesorderid'
]);

function applySalesReturnModuleFieldDefaults(fields) {
  if (!Array.isArray(fields)) return fields;
  return fields
    .filter((field) => {
      const key = String(field?.key || '')
        .toLowerCase()
        .replace(/[_\s]/g, '');
      return !SALES_RETURN_FORM_EXCLUDED_KEYS.has(key);
    })
    .map((field) => {
      const key = String(field?.key || '').toLowerCase();
      if (!INITIAL_SALES_RETURN_REQUIRED_SET.has(key)) return field;
      if (field.required === false) return field;
      return { ...field, required: true };
    });
}

function isInitialSalesReturnRequiredField(fieldKey) {
  return INITIAL_SALES_RETURN_REQUIRED_SET.has(String(fieldKey || '').toLowerCase());
}

module.exports = {
  INITIAL_SALES_RETURN_QUICK_CREATE,
  INITIAL_SALES_RETURN_REQUIRED_FIELDS,
  applySalesReturnModuleFieldDefaults,
  isInitialSalesReturnRequiredField
};
