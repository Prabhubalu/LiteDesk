/**
 * Inventory workbench field catalogs for Settings + create drawers.
 *
 * Independent of moduleController so bootstrap never circular-depends on it.
 * Prefer live schema paths on the master mongoose model; fall back to static catalogs.
 */

const {
  resolveInventoryModuleModel,
  isInventorySchemaModuleKey,
  INVENTORY_WORKBENCH_KEYS
} = require('../constants/inventoryWorkbenchModules');
const {
  INITIAL_INVENTORY_FIELDS,
  applyInventoryModuleFieldDefaults
} = require('../constants/inventoryModuleDefaults');
const {
  applyPurchaseOrderModuleFieldDefaults
} = require('../constants/purchaseOrderModuleDefaults');
const {
  applyPurchaseReturnModuleFieldDefaults
} = require('../constants/purchaseReturnModuleDefaults');
const {
  applyDeliveryNoteModuleFieldDefaults
} = require('../constants/deliveryNoteModuleDefaults');
const {
  applyDeliveryReturnModuleFieldDefaults
} = require('../constants/deliveryReturnModuleDefaults');
const {
  applySalesReturnModuleFieldDefaults
} = require('../constants/salesReturnModuleDefaults');
const {
  applyReceiptNoteModuleFieldDefaults
} = require('../constants/receiptNoteModuleDefaults');
const {
  applyStockroomModuleFieldDefaults
} = require('../constants/stockroomModuleDefaults');
const {
  applyStockAdjustmentModuleFieldDefaults
} = require('../constants/stockAdjustmentModuleDefaults');
const {
  applyStockTransferModuleFieldDefaults
} = require('../constants/stockTransferModuleDefaults');

/** System/storage paths never shown in create / field configuration. */
const EXCLUDED_PATHS = new Set([
  '_id',
  '__v',
  'createdAt',
  'updatedAt',
  'organizationId',
  'createdBy',
  'modifiedBy',
  'deletedAt',
  'deletedBy',
  'deletionReason',
  'customFields',
  'externalReferenceId',
  'syncStatus',
  'lastSyncAt',
  'importHistoryId',
  'source'
]);

/** Module-specific engine totals / auto ids — hide from form field config. */
const MODULE_EXCLUDED_PATHS = {
  purchase_orders: new Set([
    'poNumber',
    'subtotal',
    'overallDiscountType',
    'overallDiscountValue',
    'overallDiscountTotal',
    'preTaxTotal',
    'taxTotal',
    'chargesTotal',
    'adjustmentTotal',
    'grandTotal',
    'transactionTaxSnapshot',
    'taxDocumentSnapshot',
    'chargeDocumentSnapshot'
  ]),
  purchase_returns: new Set([
    'purchaseReturnNumber',
    'subtotal',
    'taxTotal',
    'chargesTotal',
    'grandTotal',
    'transactionTaxSnapshot',
    'taxDocumentSnapshot',
    'chargeDocumentSnapshot'
  ]),
  delivery_notes: new Set([
    'deliveryNoteNumber',
    'subtotal',
    'taxTotal',
    'chargesTotal',
    'grandTotal',
    'transactionTaxSnapshot',
    'taxDocumentSnapshot',
    'chargeDocumentSnapshot'
  ]),
  delivery_returns: new Set([
    'deliveryReturnNumber',
    'subtotal',
    'taxTotal',
    'chargesTotal',
    'grandTotal',
    'transactionTaxSnapshot',
    'taxDocumentSnapshot',
    'chargeDocumentSnapshot'
  ]),
  receipt_notes: new Set(['receiptNoteNumber']),
  sales_returns: new Set(['salesReturnNumber']),
  stockrooms: new Set([]),
  stock_adjustments: new Set(['inventoryAdjustmentId']),
  stock_transfers: new Set(['inventoryTransferId'])
};

function humanizeLabel(key) {
  const raw = String(key || '');
  const spaced = raw
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  return spaced.replace(/\b\w/g, (c) => c.toUpperCase()) || raw;
}

function mapSchemaTypeToDataType(schemaType) {
  if (!schemaType) return 'Text';
  const instance = String(schemaType.instance || schemaType.constructor?.name || '').toLowerCase();
  if (instance.includes('objectid')) return 'Lookup (Relationship)';
  if (instance.includes('date')) return 'Date';
  if (instance.includes('boolean')) return 'Checkbox';
  if (instance.includes('number')) return 'Decimal';
  if (instance.includes('array')) return 'Multi-Picklist';
  if (schemaType.enumValues && schemaType.enumValues.length) return 'Picklist';
  if (schemaType.options?.enum && Array.isArray(schemaType.options.enum)) return 'Picklist';
  return 'Text';
}

function lookupSettingsForPath(schemaType) {
  const ref = schemaType?.options?.ref || schemaType?.caster?.options?.ref;
  if (!ref || typeof ref !== 'string') return null;
  const refMap = {
    User: 'users',
    Organization: 'organizations',
    People: 'people',
    Person: 'people',
    InventoryLocation: 'stockrooms',
    PurchaseOrder: 'purchase_orders',
    ItemVariant: 'items',
    Invoice: 'invoices',
    DeliveryNote: 'delivery_notes',
    SalesOrder: 'sales_orders'
  };
  return { targetModule: refMap[ref] || ref.toLowerCase() };
}

/**
 * Live field list from master mongoose schema for one inventory module.
 * @param {string} moduleKey
 * @returns {object[]}
 */
function getLiveInventoryFields(moduleKey) {
  const key = String(moduleKey || '').toLowerCase();
  try {
    let model = resolveInventoryModuleModel(key);
    if (!model) return [];
    // Always use master model — tenant proxy clones can miss paths under multi-tenant.
    if (model.__masterModel) model = model.__masterModel;
    const paths = model.schema?.paths;
    if (!paths || typeof paths !== 'object') return [];

    const moduleExcluded = MODULE_EXCLUDED_PATHS[key] || new Set();
    const fields = [];
    let order = 0;

    for (const [name, schemaType] of Object.entries(paths)) {
      if (!name || name.includes('.')) continue;
      if (EXCLUDED_PATHS.has(name)) continue;
      if (moduleExcluded.has(name)) continue;

      const enumValues = schemaType.enumValues?.length
        ? schemaType.enumValues
        : Array.isArray(schemaType.options?.enum)
          ? schemaType.options.enum
          : [];
      const options = enumValues.map((value) =>
        value && typeof value === 'object' ? value : { value }
      );
      const required = Boolean(
        schemaType.isRequired === true ||
          schemaType.options?.required === true ||
          (typeof schemaType.options?.required === 'function' && false)
      );
      const lookupSettings = lookupSettingsForPath(schemaType);

      fields.push({
        key: name,
        label: humanizeLabel(name),
        dataType: mapSchemaTypeToDataType(schemaType),
        required,
        keyField: false,
        options,
        defaultValue: schemaType.defaultValue ?? schemaType.options?.default ?? null,
        placeholder: '',
        index: Boolean(schemaType._index || schemaType.options?.index),
        visibility: { list: true, detail: true },
        order: order++,
        validations: [],
        dependencies: [],
        lookupSettings,
        owner: 'platform',
        context: 'global'
      });
    }

    return fields;
  } catch (err) {
    console.warn(
      `[inventory field catalog] live schema failed for ${moduleKey}:`,
      err?.message || err
    );
    return [];
  }
}

function applyModuleDefaults(moduleKey, fields) {
  if (!Array.isArray(fields) || !fields.length) return fields || [];
  const key = String(moduleKey || '').toLowerCase();
  switch (key) {
    case 'purchase_orders':
      return applyPurchaseOrderModuleFieldDefaults(fields) || fields;
    case 'purchase_returns':
      return applyPurchaseReturnModuleFieldDefaults(fields) || fields;
    case 'delivery_notes':
      return applyDeliveryNoteModuleFieldDefaults(fields) || fields;
    case 'delivery_returns':
      return applyDeliveryReturnModuleFieldDefaults(fields) || fields;
    case 'sales_returns':
      return applySalesReturnModuleFieldDefaults(fields) || fields;
    case 'receipt_notes':
      return applyReceiptNoteModuleFieldDefaults(fields) || fields;
    case 'stockrooms':
      return applyStockroomModuleFieldDefaults(fields) || fields;
    case 'stock_adjustments':
      return applyStockAdjustmentModuleFieldDefaults(fields) || fields;
    case 'stock_transfers':
      return applyStockTransferModuleFieldDefaults(fields) || fields;
    case 'inventory':
      return applyInventoryModuleFieldDefaults(fields) || fields;
    default:
      return fields;
  }
}

/**
 * Canonical field catalog for inventory module keys.
 * Never returns null — empty array only if everything fails.
 */
function getInventoryModuleFieldCatalog(moduleKey) {
  const key = String(moduleKey || '').toLowerCase();
  if (key === 'inventory') {
    return applyInventoryModuleFieldDefaults(INITIAL_INVENTORY_FIELDS).map((f, order) => ({
      ...f,
      dataType: f.dataType || f.type || 'Text',
      owner: f.owner || 'platform',
      context: f.context || 'global',
      order: f.order ?? order
    }));
  }
  if (!isInventorySchemaModuleKey(key) && !INVENTORY_WORKBENCH_KEYS.includes(key)) {
    return [];
  }

  let fields = getLiveInventoryFields(key);
  fields = applyModuleDefaults(key, fields);
  if (!Array.isArray(fields) || !fields.length) {
    console.warn(`[inventory field catalog] no fields resolved for ${key}`);
    return [];
  }
  return fields.map((f, order) => ({
    ...f,
    order: typeof f.order === 'number' ? f.order : order,
    owner: f.owner || 'platform',
    context: f.context || 'global',
    dataType: f.dataType || f.type || 'Text'
  }));
}

module.exports = {
  getInventoryModuleFieldCatalog,
  getLiveInventoryFields
};
