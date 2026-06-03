const INITIAL_SALES_ORDER_QUICK_CREATE = [
  'orderTitle',
  'orderDate',
  'requestedDeliveryDate',
  'currency',
  'contactId',
  'organizationRefId',
  'dealId',
  'ownerId',
  'fulfillmentMode'
];

const INITIAL_SALES_ORDER_REQUIRED_FIELDS = ['orderTitle'];

const INITIAL_SALES_ORDER_REQUIRED_SET = new Set(
  INITIAL_SALES_ORDER_REQUIRED_FIELDS.map((k) => String(k).toLowerCase())
);

function applySalesOrderModuleFieldDefaults(fields) {
  if (!Array.isArray(fields)) return fields;
  return fields.map((field) => {
    const key = String(field?.key || '').toLowerCase();
    if (!INITIAL_SALES_ORDER_REQUIRED_SET.has(key)) return field;
    if (field.required === false) return field;
    return { ...field, required: true };
  });
}

function isInitialSalesOrderRequiredField(fieldKey) {
  return INITIAL_SALES_ORDER_REQUIRED_SET.has(String(fieldKey || '').toLowerCase());
}

module.exports = {
  INITIAL_SALES_ORDER_QUICK_CREATE,
  INITIAL_SALES_ORDER_REQUIRED_FIELDS,
  applySalesOrderModuleFieldDefaults,
  isInitialSalesOrderRequiredField
};
