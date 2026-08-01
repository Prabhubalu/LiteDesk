import type { BaseFieldMetadata } from './BaseFieldModel';
import {
  classifyFieldBase,
  normalizeFieldKeyForMetadataLookup,
} from './BaseFieldModel';

export interface PaymentFieldMetadata extends Omit<BaseFieldMetadata, 'intent'> {
  intent: 'primary' | 'state' | 'tracking' | 'scheduling' | 'detail' | 'system';
}

export const PAYMENT_FIELD_METADATA: Record<string, PaymentFieldMetadata> = {
  paymentNumber: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isProtected: true,
    isSystem: true,
    isVisibleInConfig: true,
    allowOnCreate: false
  },
  status: {
    owner: 'system',
    intent: 'state',
    fieldScope: 'CORE',
    editable: false,
    isProtected: true,
    isSystem: true,
    isVisibleInConfig: true,
    allowOnCreate: false
  },
  amount: {
    owner: 'core',
    intent: 'primary',
    fieldScope: 'CORE',
    editable: true,
    isProtected: true,
    allowOnCreate: true,
    filterable: true,
    filterType: 'number',
    filterPriority: 1
  },
  paymentCurrency: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
    isProtected: true,
    allowOnCreate: true
  },
  paymentDate: {
    owner: 'core',
    intent: 'scheduling',
    fieldScope: 'CORE',
    editable: true,
    isProtected: true,
    allowOnCreate: true,
    filterable: true,
    filterType: 'date'
  },
  paymentPurpose: {
    owner: 'core',
    intent: 'state',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: true,
    filterable: true,
    filterType: 'select'
  },
  amountAllocated: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isProtected: true,
    isSystem: true,
    isVisibleInConfig: true,
    allowOnCreate: false
  },
  amountUnallocated: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isProtected: true,
    isSystem: true,
    isVisibleInConfig: true,
    allowOnCreate: false
  },
  amountRefunded: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isProtected: true,
    isSystem: true,
    isVisibleInConfig: true,
    allowOnCreate: false
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
  contactId: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: true,
    filterable: true,
    filterType: 'entity'
  },
  externalReference: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isProtected: true,
    isSystem: true,
    isVisibleInConfig: true,
    allowOnCreate: false
  },
  recordedAt: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: true,
    allowOnCreate: false
  },
  recordedBy: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: true,
    allowOnCreate: false
  },
  sourceContext: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: true,
    allowOnCreate: false
  },
  exchangeRateSnapshot: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: false,
    allowOnCreate: false
  },
  notes: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: false
  },
  updatedAt: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: true,
    allowOnCreate: false
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

export function getPaymentFieldMetadata(fieldName: string): PaymentFieldMetadata | undefined {
  const normalized = normalizeFieldKeyForMetadataLookup(fieldName);
  for (const [key, metadata] of Object.entries(PAYMENT_FIELD_METADATA)) {
    if (normalizeFieldKeyForMetadataLookup(key) === normalized) {
      return metadata;
    }
  }
  return undefined;
}

export function classifyPaymentField(fieldName: string): string {
  const metadata = getPaymentFieldMetadata(fieldName);
  return classifyFieldBase(metadata);
}

export function isPaymentProtectedField(fieldName: string): boolean {
  const metadata = getPaymentFieldMetadata(fieldName);
  return metadata?.isProtected === true;
}

export function isExcludedFromPaymentQuickCreate(fieldName: string): boolean {
  const metadata = getPaymentFieldMetadata(fieldName);
  if (!metadata) return true;
  if (metadata.owner === 'system') return true;
  if (metadata.owner === 'core' && metadata.allowOnCreate === false) return true;
  return false;
}
