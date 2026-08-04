const INITIAL_STOCKROOM_QUICK_CREATE = [
  'name',
  'locationCode',
  'locationType',
  'description',
  'isDefault',
  'allowNegative'
];

const INITIAL_STOCKROOM_REQUIRED_FIELDS = ['name', 'locationCode'];

const INITIAL_STOCKROOM_REQUIRED_SET = new Set(
  INITIAL_STOCKROOM_REQUIRED_FIELDS.map((k) => String(k).toLowerCase())
);

/** Form/settings noise — system ids, nested snapshots, non-createable ops fields */
const STOCKROOM_FORM_EXCLUDED_KEYS = new Set([
  'inventorylocationid',
  'systemgenerated',
  'contactsnapshot',
  'addresssnapshot',
  'externalref',
  'externalreferenceid',
  'syncstatus',
  'lastsyncat',
  'parentlocationid',
  'managerid',
  'status',
  'modifiedby',
  'organizationid',
  'createdby',
  'createdat',
  'updatedat',
  'deletedat',
  'deletedby',
  'deletionreason'
]);

function applyStockroomModuleFieldDefaults(fields) {
  if (!Array.isArray(fields)) return fields;
  return fields
    .filter((field) => {
      const key = String(field?.key || '')
        .toLowerCase()
        .replace(/[_\s-]/g, '');
      return !STOCKROOM_FORM_EXCLUDED_KEYS.has(key);
    })
    .map((field) => {
      const key = String(field?.key || '')
        .toLowerCase()
        .replace(/[_\s-]/g, '');
      if (key === 'locationcode' || key === 'name') {
        return { ...field, required: true };
      }
      if (key === 'locationtype') {
        return {
          ...field,
          dataType: field.dataType || 'Picklist',
          defaultValue: field.defaultValue || 'warehouse'
        };
      }
      return field;
    });
}

function isInitialStockroomRequiredField(fieldKey) {
  const key = String(fieldKey || '')
    .toLowerCase()
    .replace(/[_\s-]/g, '');
  return key === 'name' || key === 'locationcode';
}

module.exports = {
  INITIAL_STOCKROOM_QUICK_CREATE,
  INITIAL_STOCKROOM_REQUIRED_FIELDS,
  applyStockroomModuleFieldDefaults,
  isInitialStockroomRequiredField
};
