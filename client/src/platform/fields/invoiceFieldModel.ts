import type { BaseFieldMetadata } from './BaseFieldModel';
import {
  classifyFieldBase,
  normalizeFieldKeyForMetadataLookup,
} from './BaseFieldModel';

export interface InvoiceFieldMetadata extends Omit<BaseFieldMetadata, 'intent'> {
  intent: 'primary' | 'state' | 'tracking' | 'scheduling' | 'detail' | 'system';
}

export const INVOICE_FIELD_METADATA: Record<string, InvoiceFieldMetadata> = {
  invoiceNumber: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isProtected: true,
    isSystem: true,
    isVisibleInConfig: true,
    allowOnCreate: false
  },
  invoiceTitle: {
    owner: 'core',
    intent: 'primary',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: true,
    isProtected: true,
    filterable: true,
    filterType: 'text',
    filterPriority: 1
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
    filterPriority: 2
  },
  invoiceDate: {
    owner: 'core',
    intent: 'scheduling',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: true,
    filterable: true,
    filterType: 'date'
  },
  dueDate: {
    owner: 'core',
    intent: 'scheduling',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: true,
    filterable: true,
    filterType: 'date'
  },
  currency: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: true
  },
  grandTotal: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: true
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
  amountDue: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: true
  },
  assignedTo: {
    owner: 'core',
    intent: 'tracking',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: true,
    filterable: true,
    filterType: 'user',
    filterPriority: 3
  },
  contactId: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: true,
    filterable: true,
    filterType: 'entity'
  },
  organizationRefId: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: true,
    filterable: true,
    filterType: 'entity'
  },
  dealId: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: true,
    filterable: true,
    filterType: 'entity'
  },
  postedAt: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: true
  },
  sourceContext: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: true
  },
  updatedAt: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: true
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

export function getInvoiceFieldMetadata(fieldName: string): InvoiceFieldMetadata | undefined {
  const normalized = normalizeFieldKeyForMetadataLookup(fieldName);
  for (const [key, metadata] of Object.entries(INVOICE_FIELD_METADATA)) {
    if (normalizeFieldKeyForMetadataLookup(key) === normalized) {
      return metadata;
    }
  }
  return undefined;
}

export function classifyInvoiceField(fieldName: string): string {
  const metadata = getInvoiceFieldMetadata(fieldName);
  return classifyFieldBase(metadata);
}

export function isInvoiceProtectedField(fieldName: string): boolean {
  const metadata = getInvoiceFieldMetadata(fieldName);
  return metadata?.isProtected === true;
}

export function isExcludedFromInvoiceQuickCreate(fieldName: string): boolean {
  const metadata = getInvoiceFieldMetadata(fieldName);
  if (!metadata) return true;
  if (metadata.owner === 'system') return true;
  if (metadata.owner === 'core' && metadata.allowOnCreate === false) return true;
  return false;
}
