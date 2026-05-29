/**
 * Platform field metadata for Quote (transactional module, Sales app).
 */

import type {
  BaseFieldMetadata,
  BaseFieldOwner,
  BaseFieldIntent,
  BaseFieldScope,
  BaseFilterType,
} from './BaseFieldModel';
import {
  classifyFieldBase,
  normalizeFieldKeyForMetadataLookup,
} from './BaseFieldModel';

export type QuoteFieldOwner = BaseFieldOwner;
export type QuoteFieldIntent =
  | 'primary'
  | 'state'
  | 'tracking'
  | 'scheduling'
  | 'detail'
  | 'system';
export type QuoteFieldScope = BaseFieldScope;
export type QuoteFilterType = BaseFilterType;

export interface QuoteFieldMetadata extends Omit<BaseFieldMetadata, 'intent'> {
  intent: QuoteFieldIntent;
}

export const QUOTE_FIELD_METADATA: Record<string, QuoteFieldMetadata> = {
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
  quoteNumber: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isProtected: true,
    isSystem: true,
    isVisibleInConfig: true,
    allowOnCreate: false,
  },
  revisionNumber: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: false,
    allowOnCreate: false,
  },
  activeRevision: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: false,
    allowOnCreate: false,
  },
  sourceQuoteId: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: false,
    allowOnCreate: false,
  },
  quoteTitle: {
    owner: 'core',
    intent: 'primary',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: true,
    // Bootstrap: required by default on fresh instances (see server/constants/quoteModuleDefaults.js).
    isProtected: true,
    filterable: true,
    filterType: 'text',
    filterPriority: 1,
  },
  quoteDate: {
    owner: 'core',
    intent: 'scheduling',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: true,
    filterable: true,
    filterType: 'date',
    filterPriority: 2,
  },
  validUntil: {
    owner: 'core',
    intent: 'scheduling',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: true,
    filterable: true,
    filterType: 'date',
    filterPriority: 3,
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
    filterPriority: 4,
  },
  currency: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: true,
  },
  ownerId: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: true,
    filterable: true,
    filterType: 'user',
    filterPriority: 5,
  },
  contactId: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: true,
  },
  organizationRefId: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: true,
  },
  dealId: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: true,
  },
  caseId: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: false,
  },
  sourceContext: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: false,
    allowOnCreate: false,
  },
  sourceRef: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: false,
    allowOnCreate: false,
  },
  subtotal: {
    owner: 'system',
    intent: 'tracking',
    fieldScope: 'CORE',
    editable: false,
    isComputed: true,
    isVisibleInConfig: true,
    allowOnCreate: false,
  },
  lineDiscountTotal: {
    owner: 'system',
    intent: 'tracking',
    fieldScope: 'CORE',
    editable: false,
    isComputed: true,
    isVisibleInConfig: false,
    allowOnCreate: false,
  },
  globalDiscountTotal: {
    owner: 'system',
    intent: 'tracking',
    fieldScope: 'CORE',
    editable: false,
    isComputed: true,
    isVisibleInConfig: false,
    allowOnCreate: false,
  },
  taxTotal: {
    owner: 'system',
    intent: 'tracking',
    fieldScope: 'CORE',
    editable: false,
    isComputed: true,
    isVisibleInConfig: true,
    allowOnCreate: false,
  },
  adjustmentTotal: {
    owner: 'system',
    intent: 'tracking',
    fieldScope: 'CORE',
    editable: false,
    isComputed: true,
    isVisibleInConfig: false,
    allowOnCreate: false,
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
  customFields: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: false,
  },
};

export function getQuoteFieldMetadata(fieldName: string): QuoteFieldMetadata | undefined {
  const normalized = normalizeFieldKeyForMetadataLookup(fieldName);
  for (const [key, metadata] of Object.entries(QUOTE_FIELD_METADATA)) {
    if (normalizeFieldKeyForMetadataLookup(key) === normalized) {
      return metadata;
    }
  }
  return undefined;
}

/**
 * Suggested initial Quick Create keys for platform seed/migration only.
 * Canonical list: server/constants/quoteModuleDefaults.js INITIAL_QUOTE_QUICK_CREATE.
 * Runtime UI uses ModuleDefinition.quickCreate from Settings (not this list).
 */
export function buildInitialQuoteQuickCreateFromMetadata(): string[] {
  return Object.entries(QUOTE_FIELD_METADATA)
    .filter(([, metadata]) => metadata.owner === 'core' && metadata.allowOnCreate === true)
    .map(([key]) => key);
}

/** @deprecated Use Settings → Core Modules → Quotes → Quick Create. Kept for legacy imports. */
export function getQuoteQuickCreateFields(): string[] {
  return buildInitialQuoteQuickCreateFromMetadata();
}

export function classifyQuoteField(fieldName: string): string {
  const metadata = getQuoteFieldMetadata(fieldName);
  return classifyFieldBase(metadata as unknown as BaseFieldMetadata);
}

export function isQuoteProtectedField(fieldName: string): boolean {
  const metadata = getQuoteFieldMetadata(fieldName);
  return metadata?.isProtected === true;
}

export function isExcludedFromQuoteQuickCreate(fieldName: string): boolean {
  const metadata = getQuoteFieldMetadata(fieldName);
  if (!metadata) return true;
  if (metadata.owner === 'system') return true;
  if (metadata.owner === 'core' && metadata.allowOnCreate === false) return true;
  return false;
}
