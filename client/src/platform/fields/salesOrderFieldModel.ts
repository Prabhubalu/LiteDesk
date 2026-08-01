/**
 * Platform field metadata for Sales Order (transactional core module).
 */

import type { BaseFieldMetadata } from './BaseFieldModel';
import {
  classifyFieldBase,
  normalizeFieldKeyForMetadataLookup,
} from './BaseFieldModel';

export interface SalesOrderFieldMetadata extends Omit<BaseFieldMetadata, 'intent'> {
  intent: 'primary' | 'state' | 'tracking' | 'scheduling' | 'detail' | 'system';
}

export const SALES_ORDER_FIELD_METADATA: Record<string, SalesOrderFieldMetadata> = {
  organizationId: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isProtected: true,
    isSystem: true,
    isVisibleInConfig: false,
  },
  createdAt: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: true,
  },
  updatedAt: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: true,
  },
  salesOrderNumber: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isProtected: true,
    isSystem: true,
    isVisibleInConfig: true,
    allowOnCreate: false,
  },
  salesOrderId: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: false,
    allowOnCreate: false,
  },
  orderTitle: {
    owner: 'core',
    intent: 'primary',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: true,
    isProtected: true,
    filterable: true,
    filterType: 'text',
    filterPriority: 1,
  },
  status: {
    owner: 'core',
    intent: 'state',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: false,
    isProtected: true,
    filterable: true,
    filterType: 'select',
    filterPriority: 2,
  },
  fulfillmentMode: {
    owner: 'core',
    intent: 'state',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: true,
    filterable: true,
    filterType: 'select',
  },
  fulfillmentStatus: {
    owner: 'system',
    intent: 'state',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: true,
    allowOnCreate: false,
  },
  orderDate: {
    owner: 'core',
    intent: 'scheduling',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: true,
    filterable: true,
    filterType: 'date',
  },
  requestedDeliveryDate: {
    owner: 'core',
    intent: 'scheduling',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: true,
    filterable: true,
    filterType: 'date',
  },
  currency: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: true,
  },
  grandTotal: {
    owner: 'system',
    intent: 'tracking',
    fieldScope: 'CORE',
    editable: false,
    isComputed: true,
    isProtected: true,
    isVisibleInConfig: true,
    allowOnCreate: false,
  },
  // Engine-owned money + snapshots — never editable in create/edit forms
  chargesTotal: {
    owner: 'system',
    intent: 'tracking',
    fieldScope: 'CORE',
    editable: false,
    isComputed: true,
    isVisibleInConfig: false,
    allowOnCreate: false,
  },
  transactionTaxSnapshot: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isComputed: true,
    isVisibleInConfig: false,
    allowOnCreate: false,
  },
  chargeDocumentSnapshot: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isComputed: true,
    isVisibleInConfig: false,
    allowOnCreate: false,
  },
  taxDocumentSnapshot: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isComputed: true,
    isVisibleInConfig: false,
    allowOnCreate: false,
  },
  contactId: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: true,
    filterable: true,
    filterType: 'entity',
  },
  organizationRefId: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: true,
    filterable: true,
    filterType: 'entity',
  },
  dealId: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: true,
    filterable: true,
    filterType: 'entity',
  },
  assignedTo: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: true,
    filterable: true,
    filterType: 'user',
  },
  sourceQuoteNumber: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: true,
    allowOnCreate: false,
  },
  sourceType: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: true,
    allowOnCreate: false,
  },
  invoiceStatus: {
    owner: 'system',
    intent: 'state',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: true,
    allowOnCreate: false,
  },
  customFields: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: false,
  },
  // Connector sync metadata — system-managed; never user-editable on create/edit
  externalReferenceId: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: true,
    allowOnCreate: false,
  },
  syncStatus: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: true,
    allowOnCreate: false,
  },
  lastSyncAt: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: true,
    allowOnCreate: false,
  },
};

export function getSalesOrderFieldMetadata(fieldName: string): SalesOrderFieldMetadata | undefined {
  const normalized = normalizeFieldKeyForMetadataLookup(fieldName);
  for (const [key, metadata] of Object.entries(SALES_ORDER_FIELD_METADATA)) {
    if (normalizeFieldKeyForMetadataLookup(key) === normalized) {
      return metadata;
    }
  }
  return undefined;
}

export function classifySalesOrderField(fieldName: string): string {
  const metadata = getSalesOrderFieldMetadata(fieldName);
  return classifyFieldBase(metadata as unknown as BaseFieldMetadata);
}

export function isSalesOrderProtectedField(fieldName: string): boolean {
  const metadata = getSalesOrderFieldMetadata(fieldName);
  return metadata?.isProtected === true;
}

export function isExcludedFromSalesOrderQuickCreate(fieldName: string): boolean {
  const metadata = getSalesOrderFieldMetadata(fieldName);
  if (!metadata) return true;
  if (metadata.owner === 'system') return true;
  if (metadata.owner === 'core' && metadata.allowOnCreate === false) return true;
  return false;
}
