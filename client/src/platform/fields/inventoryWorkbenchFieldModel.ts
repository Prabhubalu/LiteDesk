/**
 * Inventory workbench field metadata — Core vs System grouping for Settings
 * (ModulesAndFields), parallel to dealFieldModel / caseFieldModel.
 */

import type { BaseFieldMetadata } from './BaseFieldModel';
import {
  classifyFieldBase,
  normalizeFieldKeyForMetadataLookup,
} from './BaseFieldModel';
import { INVENTORY_WORKBENCH_MODULE_KEYS } from '@/utils/inventoryWorkbenchNav';

export type InventoryWorkbenchFieldMetadata = BaseFieldMetadata;

const SYSTEM = (
  extras: Partial<InventoryWorkbenchFieldMetadata> = {}
): InventoryWorkbenchFieldMetadata => ({
  owner: 'system',
  intent: 'system',
  fieldScope: 'CORE',
  editable: false,
  isSystem: true,
  isVisibleInConfig: true,
  allowOnCreate: false,
  ...extras,
});

const SYSTEM_HIDDEN = (
  extras: Partial<InventoryWorkbenchFieldMetadata> = {}
): InventoryWorkbenchFieldMetadata =>
  SYSTEM({ isVisibleInConfig: false, ...extras });

const CORE = (
  extras: Partial<InventoryWorkbenchFieldMetadata> = {}
): InventoryWorkbenchFieldMetadata => ({
  owner: 'core',
  intent: 'detail',
  fieldScope: 'CORE',
  editable: true,
  allowOnCreate: true,
  ...extras,
});

const CORE_PROTECTED = (
  extras: Partial<InventoryWorkbenchFieldMetadata> = {}
): InventoryWorkbenchFieldMetadata =>
  CORE({ isProtected: true, ...extras });

/** Shared audit / tenant / sync fields across Inventory workbench docs. */
const SHARED_SYSTEM_FIELDS: Record<string, InventoryWorkbenchFieldMetadata> = {
  _id: SYSTEM_HIDDEN({ isProtected: true }),
  __v: SYSTEM_HIDDEN(),
  organizationId: SYSTEM_HIDDEN({ isProtected: true }),
  createdBy: SYSTEM({ isProtected: true }),
  modifiedBy: SYSTEM(),
  updatedBy: SYSTEM(),
  createdAt: SYSTEM(),
  updatedAt: SYSTEM(),
  deletedAt: SYSTEM_HIDDEN(),
  deletedBy: SYSTEM_HIDDEN(),
  deletionReason: SYSTEM_HIDDEN(),
  customFields: SYSTEM_HIDDEN(),
  externalReferenceId: SYSTEM(),
  syncStatus: SYSTEM(),
  lastSyncAt: SYSTEM(),
};

function withSharedSystem(
  moduleFields: Record<string, InventoryWorkbenchFieldMetadata>
): Record<string, InventoryWorkbenchFieldMetadata> {
  return { ...SHARED_SYSTEM_FIELDS, ...moduleFields };
}

const PURCHASE_ORDERS_FIELDS = withSharedSystem({
  poNumber: SYSTEM({ isProtected: true }),
  poDate: CORE_PROTECTED({ intent: 'scheduling', filterable: true, filterType: 'date' }),
  vendorId: CORE_PROTECTED({ intent: 'primary', filterable: true, filterType: 'entity' }),
  vendorContactId: CORE({ filterable: true, filterType: 'entity' }),
  vendorReferenceNumber: CORE({ filterable: true, filterType: 'text' }),
  currency: CORE_PROTECTED({ allowOnCreate: true }),
  exchangeRate: CORE({ allowOnCreate: false }),
  paymentTerms: CORE(),
  expectedDeliveryDate: CORE({ intent: 'scheduling', filterable: true, filterType: 'date' }),
  buyerId: CORE({ filterable: true, filterType: 'user' }),
  status: CORE_PROTECTED({ intent: 'state', filterable: true, filterType: 'select' }),
  notes: CORE({ allowOnCreate: false }),
  termsAndConditions: CORE({ allowOnCreate: false }),
  subtotal: SYSTEM({ isProtected: true }),
  taxTotal: SYSTEM({ isProtected: true }),
  chargesTotal: SYSTEM({ isProtected: true }),
  grandTotal: SYSTEM({ isProtected: true }),
  taxDocumentSnapshot: SYSTEM_HIDDEN(),
  chargeDocumentSnapshot: SYSTEM_HIDDEN(),
});

const RECEIPT_NOTES_FIELDS = withSharedSystem({
  receiptNoteNumber: SYSTEM({ isProtected: true }),
  receiptDate: CORE_PROTECTED({ intent: 'scheduling', filterable: true, filterType: 'date' }),
  vendorId: CORE_PROTECTED({ intent: 'primary', filterable: true, filterType: 'entity' }),
  purchaseOrderId: CORE_PROTECTED({ filterable: true, filterType: 'entity' }),
  receiptLocationId: CORE_PROTECTED({ filterable: true, filterType: 'entity' }),
  receivedBy: CORE({ filterable: true, filterType: 'user' }),
  vendorDeliveryChallanNo: CORE({ filterable: true, filterType: 'text' }),
  transportDetails: CORE(),
  status: CORE_PROTECTED({ intent: 'state', filterable: true, filterType: 'select' }),
  notes: CORE({ allowOnCreate: false }),
});

const PURCHASE_RETURNS_FIELDS = withSharedSystem({
  purchaseReturnNumber: SYSTEM({ isProtected: true }),
  returnDate: CORE_PROTECTED({ intent: 'scheduling', filterable: true, filterType: 'date' }),
  vendorId: CORE_PROTECTED({ intent: 'primary', filterable: true, filterType: 'entity' }),
  receiptNoteId: CORE_PROTECTED({ filterable: true, filterType: 'entity' }),
  purchaseOrderId: CORE_PROTECTED({ filterable: true, filterType: 'entity' }),
  returnReason: CORE_PROTECTED({ intent: 'state', filterable: true, filterType: 'select' }),
  currency: CORE_PROTECTED(),
  status: CORE_PROTECTED({ intent: 'state', filterable: true, filterType: 'select' }),
  notes: CORE({ allowOnCreate: false }),
  subtotal: SYSTEM({ isProtected: true }),
  taxTotal: SYSTEM({ isProtected: true }),
  chargesTotal: SYSTEM({ isProtected: true }),
  grandTotal: SYSTEM({ isProtected: true }),
});

const DELIVERY_NOTES_FIELDS = withSharedSystem({
  deliveryNoteNumber: SYSTEM({ isProtected: true }),
  deliveryDate: CORE_PROTECTED({ intent: 'scheduling', filterable: true, filterType: 'date' }),
  customerId: CORE_PROTECTED({ intent: 'primary', filterable: true, filterType: 'entity' }),
  salesOrderId: CORE_PROTECTED({ filterable: true, filterType: 'entity' }),
  invoiceId: CORE({ filterable: true, filterType: 'entity', allowOnCreate: false }),
  deliveryMethod: CORE(),
  vehicleNumber: CORE({ filterable: true, filterType: 'text' }),
  trackingNumber: CORE({ filterable: true, filterType: 'text' }),
  deliveryAddress: CORE(),
  contactPerson: CORE(),
  status: CORE_PROTECTED({ intent: 'state', filterable: true, filterType: 'select' }),
  notes: CORE({ allowOnCreate: false }),
  fulfillmentEventId: SYSTEM_HIDDEN(),
});

const DELIVERY_RETURNS_FIELDS = withSharedSystem({
  deliveryReturnNumber: SYSTEM({ isProtected: true }),
  returnDate: CORE_PROTECTED({ intent: 'scheduling', filterable: true, filterType: 'date' }),
  customerId: CORE_PROTECTED({ intent: 'primary', filterable: true, filterType: 'entity' }),
  deliveryNoteId: CORE_PROTECTED({ filterable: true, filterType: 'entity' }),
  salesOrderId: CORE_PROTECTED({ filterable: true, filterType: 'entity' }),
  returnReason: CORE_PROTECTED({ intent: 'state', filterable: true, filterType: 'select' }),
  returnLocationId: CORE_PROTECTED({ filterable: true, filterType: 'entity' }),
  status: CORE_PROTECTED({ intent: 'state', filterable: true, filterType: 'select' }),
  notes: CORE({ allowOnCreate: false }),
});

const SALES_RETURNS_FIELDS = withSharedSystem({
  salesReturnNumber: SYSTEM({ isProtected: true }),
  returnDate: CORE_PROTECTED({ intent: 'scheduling', filterable: true, filterType: 'date' }),
  customerId: CORE_PROTECTED({ intent: 'primary', filterable: true, filterType: 'entity' }),
  invoiceId: CORE_PROTECTED({ filterable: true, filterType: 'entity' }),
  deliveryNoteId: CORE({ filterable: true, filterType: 'entity', allowOnCreate: false }),
  salesOrderId: CORE({ filterable: true, filterType: 'entity', allowOnCreate: false }),
  returnLocationId: CORE_PROTECTED({ filterable: true, filterType: 'entity' }),
  overallReturnReason: CORE_PROTECTED({ intent: 'state', filterable: true, filterType: 'select' }),
  returnType: CORE({ intent: 'state', filterable: true, filterType: 'select' }),
  status: CORE_PROTECTED({ intent: 'state', filterable: true, filterType: 'select' }),
  notes: CORE({ allowOnCreate: false }),
  subtotal: SYSTEM({ isProtected: true }),
  taxTotal: SYSTEM({ isProtected: true }),
  chargesTotal: SYSTEM({ isProtected: true }),
  grandTotal: SYSTEM({ isProtected: true }),
});

const STOCKROOMS_FIELDS = withSharedSystem({
  inventoryLocationId: SYSTEM({ isProtected: true }),
  locationCode: CORE_PROTECTED({ intent: 'identity', filterable: true, filterType: 'text' }),
  name: CORE_PROTECTED({ intent: 'primary', filterable: true, filterType: 'text' }),
  locationType: CORE_PROTECTED({ intent: 'state', filterable: true, filterType: 'select' }),
  status: CORE_PROTECTED({ intent: 'state', filterable: true, filterType: 'select' }),
  parentLocationId: CORE({ filterable: true, filterType: 'entity', allowOnCreate: false }),
  isDefault: CORE({ filterable: true, filterType: 'boolean', allowOnCreate: false }),
  systemGenerated: SYSTEM({ isProtected: true }),
  allowNegative: CORE({ filterable: true, filterType: 'boolean', allowOnCreate: false }),
  managerId: CORE({ filterable: true, filterType: 'user' }),
  contactSnapshot: SYSTEM_HIDDEN(),
  description: CORE({ allowOnCreate: false }),
  addressSnapshot: CORE({ allowOnCreate: false }),
  externalRef: SYSTEM(),
});

const STOCK_ADJUSTMENTS_FIELDS = withSharedSystem({
  inventoryAdjustmentId: SYSTEM({ isProtected: true }),
  inventoryLocationId: CORE_PROTECTED({ filterable: true, filterType: 'entity' }),
  reasonCode: CORE_PROTECTED({ intent: 'state', filterable: true, filterType: 'select' }),
  status: CORE_PROTECTED({ intent: 'state', filterable: true, filterType: 'select' }),
  lines: SYSTEM_HIDDEN(),
  inventoryTransactionId: SYSTEM({ isProtected: true }),
  postedAt: SYSTEM(),
  postedBy: SYSTEM(),
  notes: CORE({ allowOnCreate: false }),
});

const STOCK_TRANSFERS_FIELDS = withSharedSystem({
  inventoryTransferId: SYSTEM({ isProtected: true }),
  fromLocationId: CORE_PROTECTED({ filterable: true, filterType: 'entity' }),
  toLocationId: CORE_PROTECTED({ filterable: true, filterType: 'entity' }),
  status: CORE_PROTECTED({ intent: 'state', filterable: true, filterType: 'select' }),
  lines: SYSTEM_HIDDEN(),
  inventoryTransactionId: SYSTEM({ isProtected: true }),
  shippedAt: SYSTEM(),
  receivedAt: SYSTEM(),
  postedAt: SYSTEM(),
  postedBy: SYSTEM(),
  notes: CORE({ allowOnCreate: false }),
});

/** Ledger module (inventory.inventory) — locations-oriented defaults from INV0. */
const INVENTORY_LEDGER_FIELDS = withSharedSystem({
  inventoryLocationId: SYSTEM({ isProtected: true }),
  locationCode: CORE_PROTECTED({ intent: 'identity', filterable: true, filterType: 'text' }),
  name: CORE_PROTECTED({ intent: 'primary', filterable: true, filterType: 'text' }),
  locationType: CORE_PROTECTED({ intent: 'state', filterable: true, filterType: 'select' }),
  status: CORE_PROTECTED({ intent: 'state', filterable: true, filterType: 'select' }),
});

export const INVENTORY_WORKBENCH_FIELD_METADATA_BY_MODULE: Record<
  string,
  Record<string, InventoryWorkbenchFieldMetadata>
> = {
  purchase_orders: PURCHASE_ORDERS_FIELDS,
  receipt_notes: RECEIPT_NOTES_FIELDS,
  purchase_returns: PURCHASE_RETURNS_FIELDS,
  delivery_notes: DELIVERY_NOTES_FIELDS,
  delivery_returns: DELIVERY_RETURNS_FIELDS,
  sales_returns: SALES_RETURNS_FIELDS,
  stockrooms: STOCKROOMS_FIELDS,
  stock_adjustments: STOCK_ADJUSTMENTS_FIELDS,
  stock_transfers: STOCK_TRANSFERS_FIELDS,
  inventory: INVENTORY_LEDGER_FIELDS,
};

export function isInventoryWorkbenchModuleKey(moduleKey: string | null | undefined): boolean {
  const k = String(moduleKey || '').toLowerCase();
  return k === 'inventory' || INVENTORY_WORKBENCH_MODULE_KEYS.has(k);
}

export function getInventoryWorkbenchFieldMetadataMap(
  moduleKey: string
): Record<string, InventoryWorkbenchFieldMetadata> | undefined {
  return INVENTORY_WORKBENCH_FIELD_METADATA_BY_MODULE[String(moduleKey || '').toLowerCase()];
}

export function getInventoryWorkbenchFieldMetadata(
  moduleKey: string,
  fieldName: string
): InventoryWorkbenchFieldMetadata | undefined {
  const map = getInventoryWorkbenchFieldMetadataMap(moduleKey);
  if (!map) return undefined;
  const normalized = normalizeFieldKeyForMetadataLookup(fieldName);
  for (const [key, metadata] of Object.entries(map)) {
    if (normalizeFieldKeyForMetadataLookup(key) === normalized) {
      return metadata;
    }
  }
  return undefined;
}

export function classifyInventoryWorkbenchField(
  moduleKey: string,
  fieldName: string
): string {
  const metadata = getInventoryWorkbenchFieldMetadata(moduleKey, fieldName);
  return classifyFieldBase(metadata);
}

export function isInventoryWorkbenchProtectedField(
  moduleKey: string,
  fieldName: string
): boolean {
  return getInventoryWorkbenchFieldMetadata(moduleKey, fieldName)?.isProtected === true;
}
