/**
 * ============================================================================
 * PLATFORM FIELD MODEL: Organization
 * ============================================================================
 * 
 * Canonical field metadata for Organization entity.
 * 
 * This file encodes the authoritative field classification for CRM Organizations
 * (isTenant: false). Tenant organization fields (subscription, limits, settings)
 * are excluded as they are platform infrastructure, not CRM entity fields.
 * 
 * ⚠️ IMPORTANT:
 * - Field ownership, intent, and scope are FINALIZED
 * - Do NOT infer, reinterpret, or reclassify any field
 * - This is DATA-MEANING encoding, not UI or schema redesign
 * 
 * ============================================================================
 * 
 * ARCHITECTURAL NOTES:
 * 
 * 1. Organization model serves dual purpose
 *    - Tenant organizations (isTenant: true) - platform infrastructure
 *    - CRM organizations (isTenant: false) - business entities
 *    - This field model covers CRM organization fields only
 * 
 * 2. Core business fields are platform-scoped
 *    - `name`, `industry`, `website`, `phone`, `address`, `types`, `tags`
 *    - These exist independently of any app participation
 *    - fieldScope: 'CORE' indicates platform-level ownership
 * 
 * 3. App participation fields are SALES-scoped
 *    - `customerStatus`, `partnerStatus`, `vendorStatus`, etc.
 *    - These fields exist only because of SALES app participation
 *    - fieldScope: 'SALES' indicates SALES app ownership
 * 
 * 4. System fields are infrastructure-scoped
 *    - `createdBy`, `createdAt`, `updatedAt`, `organizationId`, etc.
 *    - Managed by the platform, never user-editable
 *    - fieldScope: 'CORE' indicates platform-level ownership
 * 
 * 5. Quick Create eligibility
 *    - Only core business fields: name (required), industry, website, phone, address, types
 *    - Excluded: status fields, assignment fields, system fields, tenant fields
 *    - See: docs/architecture/organization-settings.md
 * 
 * ============================================================================
 */

import type {
  BaseFieldMetadata,
  BaseFieldOwner,
  BaseFieldIntent,
  BaseFieldScope,
  BaseFilterType,
} from './BaseFieldModel';
import {
  validateBaseFieldMetadata,
  classifyFieldBase,
  normalizeFieldKeyForMetadataLookup,
} from './BaseFieldModel';

// =============================================================================
// ORGANIZATION-SPECIFIC TYPE ALIASES (for backward compatibility)
// =============================================================================

/**
 * Field ownership classification for Organizations.
 * @deprecated Use BaseFieldOwner from BaseFieldModel.ts
 */
export type OrganizationFieldOwner = BaseFieldOwner;

/**
 * Field intent classification for Organizations.
 * Organizations module uses 'identity' for core fields (similar to People).
 */
export type OrganizationFieldIntent = 'identity' | 'state' | 'detail' | 'system';

/**
 * Field scope classification for Organizations.
 * @deprecated Use BaseFieldScope from BaseFieldModel.ts
 */
export type OrganizationFieldScope = BaseFieldScope;

/**
 * Filter type classification for Organizations.
 * @deprecated Use BaseFilterType from BaseFieldModel.ts
 */
export type OrganizationFilterType = BaseFilterType;

// =============================================================================
// ORGANIZATION FIELD METADATA INTERFACE
// =============================================================================

/**
 * Organization-specific field metadata interface.
 * Extends BaseFieldMetadata with Organization-specific intent types.
 */
export interface OrganizationFieldMetadata extends Omit<BaseFieldMetadata, 'intent'> {
  /**
   * Field intent classification.
   * Organizations uses 'identity' for core fields (vs 'primary' in Tasks).
   */
  intent: OrganizationFieldIntent;
}

// =============================================================================
// FIELD METADATA DEFINITIONS
// =============================================================================

/**
 * Field metadata map - single source of truth for Organization fields
 * 
 * Every Organization field MUST be classified here.
 * Missing fields will cause runtime errors.
 * 
 * Note: This covers CRM organization fields only (isTenant: false).
 * Tenant organization fields (subscription, limits, settings) are excluded.
 */
export const ORGANIZATION_FIELD_METADATA: Record<string, OrganizationFieldMetadata> = {
  // ==========================================================================
  // SYSTEM FIELDS (platform-managed, read-only, infrastructure-scoped)
  // Type A: Infrastructure (never visible): _id, __v, organizationId
  // Type B: Audit (visible, read-only): createdAt, updatedAt, createdBy
  // Type C: Computed: derivedStatus; legacyOrganizationId: infrastructure
  // ==========================================================================
  organizationId: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isProtected: true,
    isSystem: true,
    isVisibleInConfig: false,
  },
  createdBy: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isProtected: true,
    isSystem: true,
    isVisibleInConfig: true,
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
  _id: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: false,
  },
  __v: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: false,
  },
  legacyOrganizationId: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isVisibleInConfig: false,
  },
  isActive: {
    owner: 'core',
    intent: 'state',
    fieldScope: 'CORE',
    editable: true,
    filterable: true,
    filterType: 'boolean',
    filterPriority: 10,
  },
  derivedStatus: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isSystem: true,
    isComputed: true,
    isVisibleInConfig: true,
  },

  // ==========================================================================
  // CORE BUSINESS FIELDS (platform-scoped, app-agnostic)
  // ==========================================================================
  
  // Primary field - required, cannot be hidden or deleted
  name: {
    owner: 'core',
    intent: 'identity',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: true,
    isProtected: true,
    filterable: true,
    filterType: 'text',
    filterPriority: 1,
  },
  
  // Core identity fields
  industry: {
    owner: 'core',
    intent: 'identity',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: true,
    filterable: true,
    filterType: 'text',
    filterPriority: 2,
  },
  website: {
    owner: 'core',
    intent: 'identity',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: true,
  },
  phone: {
    owner: 'core',
    intent: 'identity',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: true,
  },
  address: {
    owner: 'core',
    intent: 'identity',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: true,
  },
  
  // Types field - core classification
  types: {
    owner: 'core',
    intent: 'state',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: true,
    filterable: true,
    filterType: 'multi-select',
    filterPriority: 3,
  },
  tags: {
    owner: 'core',
    intent: 'state',
    fieldScope: 'CORE',
    editable: true,
    allowOnCreate: false,
    filterable: true,
    filterType: 'multi-select',
    filterPriority: 4,
  },
  
  // ==========================================================================
  // SALES APP PARTICIPATION FIELDS
  // ==========================================================================
  
  // Assignment fields
  assignedTo: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'SALES',
    editable: true,
    requiredFor: ['SALES'],
    filterable: true,
    filterType: 'user',
    filterPriority: 4,
  },
  accountManager: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'SALES',
    editable: true,
    requiredFor: ['SALES'],
    filterable: true,
    filterType: 'user',
    filterPriority: 5,
  },
  primaryContact: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'SALES',
    editable: true,
    requiredFor: ['SALES'],
    filterable: true,
    filterType: 'entity',
    filterPriority: 6,
  },
  
  // Customer-specific fields
  customerStatus: {
    owner: 'participation',
    intent: 'state',
    fieldScope: 'SALES',
    editable: true,
    requiredFor: ['SALES'],
    filterable: true,
    filterType: 'select',
    filterPriority: 7,
  },
  customerTier: {
    owner: 'participation',
    intent: 'state',
    fieldScope: 'SALES',
    editable: true,
    requiredFor: ['SALES'],
    filterable: true,
    filterType: 'select',
    filterPriority: 8,
  },
  slaLevel: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'SALES',
    editable: true,
    requiredFor: ['SALES'],
  },
  paymentTerms: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'SALES',
    editable: true,
    requiredFor: ['SALES'],
  },
  creditLimit: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'SALES',
    editable: true,
    requiredFor: ['SALES'],
  },
  annualRevenue: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'SALES',
    editable: true,
    requiredFor: ['SALES'],
    filterable: true,
    filterType: 'number',
    filterPriority: 9,
  },
  numberOfEmployees: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'SALES',
    editable: true,
    requiredFor: ['SALES'],
    filterable: true,
    filterType: 'number',
    filterPriority: 10,
  },
  
  // Partner-specific fields
  partnerStatus: {
    owner: 'participation',
    intent: 'state',
    fieldScope: 'SALES',
    editable: true,
    requiredFor: ['SALES'],
    filterable: true,
    filterType: 'select',
    filterPriority: 11,
  },
  partnerTier: {
    owner: 'participation',
    intent: 'state',
    fieldScope: 'SALES',
    editable: true,
    requiredFor: ['SALES'],
    filterable: true,
    filterType: 'select',
    filterPriority: 12,
  },
  partnerType: {
    owner: 'participation',
    intent: 'state',
    fieldScope: 'SALES',
    editable: true,
    requiredFor: ['SALES'],
    filterable: true,
    filterType: 'select',
    filterPriority: 13,
  },
  partnerSince: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'SALES',
    editable: true,
    requiredFor: ['SALES'],
    filterable: true,
    filterType: 'date',
    filterPriority: 14,
  },
  territory: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'SALES',
    editable: true,
    requiredFor: ['SALES'],
  },
  discountRate: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'SALES',
    editable: true,
    requiredFor: ['SALES'],
  },
  
  // Vendor-specific fields
  vendorStatus: {
    owner: 'participation',
    intent: 'state',
    fieldScope: 'SALES',
    editable: true,
    requiredFor: ['SALES'],
    filterable: true,
    filterType: 'select',
    filterPriority: 15,
  },
  vendorRating: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'SALES',
    editable: true,
    requiredFor: ['SALES'],
    filterable: true,
    filterType: 'number',
    filterPriority: 16,
  },
  vendorContract: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'SALES',
    editable: true,
    requiredFor: ['SALES'],
    filterable: true,
    filterType: 'entity',
    filterPriority: 17,
  },
  preferredPaymentMethod: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'SALES',
    editable: true,
    requiredFor: ['SALES'],
  },
  taxId: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'SALES',
    editable: true,
    requiredFor: ['SALES'],
  },
  
  // Distributor/Dealer-specific fields
  channelRegion: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'SALES',
    editable: true,
    requiredFor: ['SALES'],
  },
  distributionTerritory: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'SALES',
    editable: true,
    requiredFor: ['SALES'],
  },
  distributionCapacityMonthly: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'SALES',
    editable: true,
    requiredFor: ['SALES'],
  },
  dealerLevel: {
    owner: 'participation',
    intent: 'state',
    fieldScope: 'SALES',
    editable: true,
    requiredFor: ['SALES'],
    filterable: true,
    filterType: 'select',
    filterPriority: 18,
  },
  terms: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'SALES',
    editable: true,
    requiredFor: ['SALES'],
  },
  shippingAddress: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'SALES',
    editable: true,
    requiredFor: ['SALES'],
  },
  logisticsPartner: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'SALES',
    editable: true,
    requiredFor: ['SALES'],
    filterable: true,
    filterType: 'entity',
    filterPriority: 19,
  },
};

// =============================================================================
// VALIDATION & GUARDRAILS
// =============================================================================

/**
 * Validates Organization-specific field metadata for correctness.
 * Extends base validation with Organization-specific rules.
 * Throws if invalid combinations are detected.
 */
function validateOrganizationFieldMetadata(fieldName: string, metadata: OrganizationFieldMetadata): void {
  // Run base validation first (cast to BaseFieldMetadata for compatibility)
  validateBaseFieldMetadata(fieldName, metadata as unknown as BaseFieldMetadata);

  const { owner, intent } = metadata;

  // Organization-specific: Core fields must have intent: 'identity' or 'state'
  if (owner === 'core' && intent !== 'identity' && intent !== 'state') {
    throw new Error(
      `Field "${fieldName}": Organization core fields must have intent: 'identity' or 'state'. Found: ${intent}`
    );
  }

  // Organization-specific: Participation fields must have intent: 'state' or 'detail'
  if (owner === 'participation' && intent !== 'state' && intent !== 'detail') {
    throw new Error(
      `Field "${fieldName}": Organization participation fields must have intent: 'state' or 'detail'. Found: ${intent}`
    );
  }
}

/**
 * Validates all field metadata on module load
 * Fails fast if any field has invalid classification
 */
function validateAllOrganizationMetadata(): void {
  for (const [fieldName, metadata] of Object.entries(ORGANIZATION_FIELD_METADATA)) {
    validateOrganizationFieldMetadata(fieldName, metadata);
  }
}

// Run validation on module load
validateAllOrganizationMetadata();

// =============================================================================
// HELPER UTILITIES
// =============================================================================

/**
 * Get metadata for an organization field
 * Returns undefined if field is not found (allows graceful handling of unknown fields)
 */
export function getOrganizationFieldMetadata(fieldName: string): OrganizationFieldMetadata | undefined {
  const normalizedName = normalizeFieldKeyForMetadataLookup(fieldName);
  
  if (ORGANIZATION_FIELD_METADATA[fieldName]) {
    return ORGANIZATION_FIELD_METADATA[fieldName];
  }
  
  for (const [key, metadata] of Object.entries(ORGANIZATION_FIELD_METADATA)) {
    if (normalizeFieldKeyForMetadataLookup(key) === normalizedName) {
      return metadata;
    }
  }
  
  return undefined;
}

/**
 * Check if a field is a system field
 */
export function isOrganizationSystemField(fieldName: string): boolean {
  const metadata = getOrganizationFieldMetadata(fieldName);
  return metadata?.owner === 'system';
}

/**
 * Check if a field is a core organization field
 */
export function isOrganizationCoreField(fieldName: string): boolean {
  const metadata = getOrganizationFieldMetadata(fieldName);
  return metadata?.owner === 'core';
}

/**
 * Check if a field is a protected field (cannot be deleted)
 */
export function isOrganizationProtectedField(fieldName: string): boolean {
  const metadata = getOrganizationFieldMetadata(fieldName);
  return metadata?.isProtected === true;
}

/**
 * Get all core organization fields (platform-owned)
 */
export function getCoreOrganizationFields(): string[] {
  return Object.entries(ORGANIZATION_FIELD_METADATA)
    .filter(([_, metadata]) => metadata.owner === 'core')
    .map(([fieldName]) => fieldName);
}

/**
 * Get all system fields
 */
export function getOrganizationSystemFields(): string[] {
  return Object.entries(ORGANIZATION_FIELD_METADATA)
    .filter(([_, metadata]) => metadata.owner === 'system')
    .map(([fieldName]) => fieldName);
}

/**
 * Get all participation fields for a specific app
 */
export function getOrganizationParticipationFields(appKey: string): string[] {
  return Object.entries(ORGANIZATION_FIELD_METADATA)
    .filter(([_, metadata]) => 
      metadata.owner === 'participation' && metadata.fieldScope === appKey
    )
    .map(([fieldName]) => fieldName);
}

/**
 * Get all fields eligible for Quick Create
 * Only core business fields: name (required), industry, website, phone, address, types
 */
export function getOrganizationQuickCreateFields(): string[] {
  return Object.entries(ORGANIZATION_FIELD_METADATA)
    .filter(([_, metadata]) => 
      metadata.allowOnCreate === true || 
      (metadata.owner === 'core' && metadata.intent === 'identity')
    )
    .map(([fieldName]) => fieldName);
}

/**
 * Get all protected fields (cannot be deleted)
 */
export function getOrganizationProtectedFields(): string[] {
  return Object.entries(ORGANIZATION_FIELD_METADATA)
    .filter(([_, metadata]) => metadata.isProtected === true)
    .map(([fieldName]) => fieldName);
}

/**
 * Classify a field into its group for UI display
 * Returns: 'core' | 'system' | app scope (e.g., 'SALES')
 * 
 * Uses base classification utility for consistency.
 */
export function classifyOrganizationField(fieldName: string): string {
  const metadata = getOrganizationFieldMetadata(fieldName);
  return classifyFieldBase(metadata as unknown as BaseFieldMetadata);
}

/**
 * Group organization fields by their classification
 * Used for UI rendering in ModulesAndFields.vue
 */
export function groupOrganizationFields(fieldKeys: string[]): {
  coreIdentity: string[];
  participation: Record<string, string[]>;
  system: string[];
} {
  const coreIdentity: string[] = [];
  const participation: Record<string, string[]> = {};
  const system: string[] = [];
  
  for (const fieldKey of fieldKeys) {
    const classification = classifyOrganizationField(fieldKey);
    
    if (classification === 'core') {
      coreIdentity.push(fieldKey);
    } else if (classification === 'system') {
      system.push(fieldKey);
    } else {
      // Participation field - group by app scope
      if (!participation[classification]) {
        participation[classification] = [];
      }
      participation[classification].push(fieldKey);
    }
  }
  
  return { coreIdentity, participation, system };
}

/** ObjectId reference fields on CRM organizations — empty values must be null, not "". */
export const ORGANIZATION_REFERENCE_FIELD_KEYS = [
  'assignedTo',
  'primaryContact',
  'accountManager',
  'vendorContract',
  'logisticsPartner',
] as const;

/** System / audit fields that must never be sent on organization create/update. */
export const ORGANIZATION_SYSTEM_NON_EDITABLE_FIELD_KEYS = [
  'importHistoryId',
  'derivedStatus',
  'createdBy',
  'modifiedBy',
  'createdAt',
  'updatedAt',
  '_id',
  '__v',
  'organizationId',
  'deletedAt',
  'deletedBy',
  'deletionReason',
  'activityLogs',
  'source',
] as const;

/**
 * Tenant/workspace infrastructure fields on Organization documents.
 * CRM business org create/update must never send these (aligned with mapOrganizationToSurface).
 */
export const ORGANIZATION_TENANT_PLATFORM_FIELD_KEYS = [
  'isTenant',
  'slug',
  'subscription',
  'limits',
  'enabledApps',
  'enabledModules',
  'moduleOverrides',
  'crmInitialized',
  'settings',
  'dataRegion',
  'security',
  'integrations',
  'database',
  'billing',
  'activityLogs',
  'legacyOrganizationId',
  'descriptionVersions',
] as const;

const ORGANIZATION_TENANT_PLATFORM_ROOTS_NORM = ORGANIZATION_TENANT_PLATFORM_FIELD_KEYS.map((key) =>
  normalizeFieldKeyForMetadataLookup(key)
);

/** Tenant/workspace fields and nested paths under them (e.g. subscription.stripeCustomerId). */
export function isTenantPlatformOrganizationFieldKey(fieldKey: string): boolean {
  const normalized = normalizeFieldKeyForMetadataLookup(String(fieldKey || ''));
  for (const root of ORGANIZATION_TENANT_PLATFORM_ROOTS_NORM) {
    if (normalized === root) return true;
    if (normalized.startsWith(`${root}.`)) return true;
    if (normalized.startsWith(`${root}[`)) return true;
  }
  return false;
}

/** Remove tenant/platform fields from organization create/update payloads. */
export function stripOrganizationTenantPlatformFields(
  payload: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (!payload || typeof payload !== 'object') return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (!isTenantPlatformOrganizationFieldKey(key)) {
      out[key] = value;
    }
  }
  return out;
}

function normalizeOrganizationReferenceValue(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    const id = obj._id ?? obj.id;
    if (id == null || id === '') return null;
    return String(id);
  }
  return String(value);
}

/** Sanitize organization edit/create payloads before API submission. */
export function normalizeOrganizationEditSubmitPayload(
  payload: Record<string, unknown> | null | undefined,
  moduleFields?: Array<{ key?: string; dataType?: string }>
): Record<string, unknown> {
  const out = stripOrganizationTenantPlatformFields(payload);

  for (const key of ORGANIZATION_SYSTEM_NON_EDITABLE_FIELD_KEYS) {
    delete out[key];
  }

  const referenceKeys = new Set<string>(ORGANIZATION_REFERENCE_FIELD_KEYS);
  for (const field of moduleFields || []) {
    const key = field?.key;
    if (!key) continue;
    const dataType = field.dataType || '';
    if (dataType === 'Lookup (Relationship)' || dataType === 'Lookup' || dataType === 'User') {
      referenceKeys.add(key);
    }
  }

  for (const key of referenceKeys) {
    if (!(key in out)) continue;
    out[key] = normalizeOrganizationReferenceValue(out[key]);
  }

  return out;
}

/** Seed edit forms without tenant/system/reference noise from loaded records. */
export function stripOrganizationRecordForEditForm(
  record: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  return normalizeOrganizationEditSubmitPayload(record);
}

/**
 * Check if a field should be excluded from Quick Create
 * Based on architecture: only core business fields are eligible
 */
export function isExcludedFromOrganizationQuickCreate(fieldName: string): boolean {
  const metadata = getOrganizationFieldMetadata(fieldName);
  
  if (!metadata) {
    // Unknown fields are excluded
    return true;
  }
  
  // System fields are always excluded
  if (metadata.owner === 'system') {
    return true;
  }
  
  // Participation fields are excluded
  if (metadata.owner === 'participation') {
    return true;
  }
  
  // Core fields with allowOnCreate: false are excluded
  if (metadata.owner === 'core' && metadata.allowOnCreate === false) {
    return true;
  }
  
  return false;
}

// =============================================================================
// EXPORTS FOR BACKWARD COMPATIBILITY
// =============================================================================

/**
 * Array of all organization field metadata objects.
 * @deprecated Use ORGANIZATION_FIELD_METADATA directly or FieldRegistry functions
 */
export const ORGANIZATION_FIELDS: OrganizationFieldMetadata[] = Object.entries(ORGANIZATION_FIELD_METADATA)
  .map(([fieldName, metadata]) => ({
    ...metadata,
    fieldKey: fieldName,
  } as OrganizationFieldMetadata & { fieldKey: string }))
  .map(({ fieldKey, ...metadata }) => metadata as OrganizationFieldMetadata);
