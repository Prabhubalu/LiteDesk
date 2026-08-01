/**
 * ============================================================================
 * PLATFORM FIELD REGISTRY
 * ============================================================================
 * 
 * Centralized, read-only registry for accessing field metadata across modules.
 * 
 * ⚠️ ARCHITECTURAL CONTRACT:
 * 
 * 1. Field Registry is the ONLY approved way for cross-module field access
 *    - UI components must use this registry for aggregation use cases
 *    - Services must use this registry for cross-module field queries
 *    - Direct imports of field models are allowed ONLY for single-module use
 * 
 * 2. Registry is READ-ONLY and STATELESS
 *    - No mutations to field metadata
 *    - No caching or memoization
 *    - Returned arrays are always shallow copies
 *    - Deterministic behavior guaranteed
 * 
 * 3. Adding new modules
 *    - Import the module's field metadata constant
 *    - Add the module key to ModuleKey type
 *    - Register in FIELD_REGISTRY constant
 *    - No other changes required
 * 
 * ============================================================================
 * 
 * USAGE EXAMPLES:
 * 
 * ```typescript
 * // Get all fields for a module
 * const peopleFields = getFieldsForModule('people');
 * 
 * // Get filterable fields for a module
 * const taskFilters = getFilterableFieldsForModule('tasks');
 * 
 * // Get fields by owner across a module
 * const coreFields = getFieldsByOwnerForModule('people', 'core');
 * 
 * // Check if a module is registered
 * if (isModuleRegistered('events')) { ... }
 * ```
 * 
 * ============================================================================
 */

import type {
  BaseFieldMetadata,
  BaseFieldOwner,
  BaseFieldScope,
} from './BaseFieldModel';
import {
  getFilterableFields,
  getProtectedFields,
  getFieldsByOwner,
  getFieldsByScope,
  isAllowedOnCreateBase,
  classifyFieldBase,
  normalizeFieldKeyForMetadataLookup,
} from './BaseFieldModel';

import { PEOPLE_FIELD_METADATA } from './peopleFieldModel';
import type { FieldMetadata as PeopleFieldMetadata } from './peopleFieldModel';

import { TASK_FIELD_METADATA } from './taskFieldModel';
import type { TaskFieldMetadata } from './taskFieldModel';

import { ORGANIZATION_FIELD_METADATA } from './organizationFieldModel';
import type { OrganizationFieldMetadata } from './organizationFieldModel';

import { DEAL_FIELD_METADATA } from './dealFieldModel';
import type { DealFieldMetadata } from './dealFieldModel';

import { EVENT_FIELD_METADATA } from './eventFieldModel';
import type { EventFieldMetadata } from './eventFieldModel';

import { ITEM_FIELD_METADATA } from './itemFieldModel';
import type { ItemFieldMetadata } from './itemFieldModel';
import { CASE_FIELD_METADATA } from './caseFieldModel';
import type { CaseFieldMetadata } from './caseFieldModel';

import { QUOTE_FIELD_METADATA } from './quoteFieldModel';
import type { QuoteFieldMetadata } from './quoteFieldModel';

import { SALES_ORDER_FIELD_METADATA } from './salesOrderFieldModel';
import type { SalesOrderFieldMetadata } from './salesOrderFieldModel';

import { INVOICE_FIELD_METADATA } from './invoiceFieldModel';
import type { InvoiceFieldMetadata } from './invoiceFieldModel';

import { PAYMENT_FIELD_METADATA } from './paymentFieldModel';
import type { PaymentFieldMetadata } from './paymentFieldModel';

import { DOCUMENT_FIELD_METADATA } from './documentsFieldModel';
import type { DocumentFieldMetadata } from './documentsFieldModel';
import {
  getInventoryWorkbenchFieldMetadataMap,
  isInventoryWorkbenchModuleKey,
} from './inventoryWorkbenchFieldModel';

// =============================================================================
// MODULE KEY TYPE
// =============================================================================

/**
 * Stable module key type.
 * Add new modules here as they are created.
 */
export type ModuleKey = 'people' | 'tasks' | 'organization' | 'deal' | 'event' | 'item' | 'case' | 'quote' | 'salesOrder' | 'invoice' | 'payment' | 'documents';

/**
 * All registered module keys.
 * Used for iteration and validation.
 */
export const MODULE_KEYS: readonly ModuleKey[] = ['people', 'tasks', 'organization', 'deal', 'event', 'item', 'case', 'quote', 'salesOrder', 'invoice', 'payment', 'documents'] as const;

/**
 * Map UI module keys (plural) to registry keys (singular).
 * Used when modules use 'deals' but registry uses 'deal'.
 */
const MODULE_KEY_ALIASES: Record<string, ModuleKey> = {
  deals: 'deal',
  cases: 'case',
  organizations: 'organization',
  events: 'event',
  items: 'item',
  quotes: 'quote',
  sales_orders: 'salesOrder',
  invoices: 'invoice',
  payments: 'payment'
};

/**
 * Normalize module key for registry lookup.
 * Handles plural forms (deals -> deal, etc.).
 */
export function normalizeModuleKeyForRegistry(moduleKey: string): ModuleKey | undefined {
  const k = (moduleKey || '').toLowerCase().trim();
  if (k in FIELD_REGISTRY) return k as ModuleKey;
  return MODULE_KEY_ALIASES[k] ?? undefined;
}

// =============================================================================
// FIELD REGISTRY
// =============================================================================

/**
 * Union type for all module field metadata types.
 * Extends BaseFieldMetadata to ensure compatibility.
 */
export type AnyFieldMetadata = PeopleFieldMetadata | TaskFieldMetadata | OrganizationFieldMetadata | DealFieldMetadata | EventFieldMetadata | ItemFieldMetadata | CaseFieldMetadata | QuoteFieldMetadata | SalesOrderFieldMetadata | InvoiceFieldMetadata | PaymentFieldMetadata | DocumentFieldMetadata;

/**
 * Type for the field registry map.
 */
type FieldRegistryMap = {
  readonly people: Record<string, PeopleFieldMetadata>;
  readonly tasks: Record<string, TaskFieldMetadata>;
  readonly organization: Record<string, OrganizationFieldMetadata>;
  readonly deal: Record<string, DealFieldMetadata>;
  readonly event: Record<string, EventFieldMetadata>;
  readonly item: Record<string, ItemFieldMetadata>;
  readonly case: Record<string, CaseFieldMetadata>;
  readonly quote: Record<string, QuoteFieldMetadata>;
  readonly salesOrder: Record<string, SalesOrderFieldMetadata>;
  readonly invoice: Record<string, InvoiceFieldMetadata>;
  readonly payment: Record<string, PaymentFieldMetadata>;
  readonly documents: Record<string, DocumentFieldMetadata>;
};

/**
 * Central field registry.
 * Maps module keys to their field metadata.
 * 
 * ⚠️ READ-ONLY: Do not mutate this object or its contents.
 */
const FIELD_REGISTRY: FieldRegistryMap = {
  people: PEOPLE_FIELD_METADATA,
  tasks: TASK_FIELD_METADATA,
  organization: ORGANIZATION_FIELD_METADATA,
  deal: DEAL_FIELD_METADATA,
  event: EVENT_FIELD_METADATA,
  item: ITEM_FIELD_METADATA,
  case: CASE_FIELD_METADATA,
  quote: QUOTE_FIELD_METADATA,
  salesOrder: SALES_ORDER_FIELD_METADATA,
  invoice: INVOICE_FIELD_METADATA,
  payment: PAYMENT_FIELD_METADATA,
  documents: DOCUMENT_FIELD_METADATA,
} as const;

// =============================================================================
// REGISTRY QUERY FUNCTIONS
// =============================================================================

/**
 * Check if a module is registered in the field registry.
 * Accepts both registry keys (deal) and UI keys (deals).
 * 
 * @param moduleKey - The module key to check
 * @returns true if the module is registered
 */
export function isModuleRegistered(moduleKey: string): moduleKey is ModuleKey {
  const resolved = normalizeModuleKeyForRegistry(moduleKey);
  return resolved !== undefined && resolved in FIELD_REGISTRY;
}

/**
 * Get all registered module keys.
 * 
 * @returns Array of registered module keys (shallow copy)
 */
export function getRegisteredModules(): ModuleKey[] {
  return [...MODULE_KEYS];
}

/**
 * Get the raw field metadata map for a module.
 * Accepts both registry keys (deal) and UI keys (deals).
 * 
 * ⚠️ INTERNAL USE ONLY: Prefer using specific query functions.
 * 
 * @param moduleKey - The module key (e.g. 'tasks', 'deals', 'deal')
 * @returns The field metadata map, or undefined if not registered
 */
export function getFieldMetadataMap(
  moduleKey: string
): Record<string, BaseFieldMetadata> | undefined {
  const resolved = normalizeModuleKeyForRegistry(moduleKey) ?? moduleKey;
  if (resolved in FIELD_REGISTRY) {
    return FIELD_REGISTRY[resolved as keyof typeof FIELD_REGISTRY] as Record<string, BaseFieldMetadata>;
  }
  if (isInventoryWorkbenchModuleKey(moduleKey)) {
    return getInventoryWorkbenchFieldMetadataMap(moduleKey) as Record<string, BaseFieldMetadata> | undefined;
  }
  return undefined;
}

/**
 * Get all field keys for a module.
 * 
 * @param moduleKey - The module key
 * @returns Array of field keys (shallow copy), or empty array if not registered
 */
export function getFieldsForModule(moduleKey: ModuleKey): string[] {
  const metadata = getFieldMetadataMap(moduleKey);
  if (!metadata) return [];
  return Object.keys(metadata);
}

/**
 * Get field metadata for a specific field in a module.
 * Accepts both registry keys (deal) and UI keys (deals).
 * Uses case-insensitive field key lookup for robustness.
 * 
 * @param moduleKey - The module key (e.g. 'tasks', 'deals')
 * @param fieldKey - The field key
 * @returns The field metadata, or undefined if not found
 */
export function getFieldMetadataFromRegistry(
  moduleKey: string,
  fieldKey: string
): BaseFieldMetadata | undefined {
  const metadataMap = getFieldMetadataMap(moduleKey);
  if (!metadataMap) return undefined;
  const exact = metadataMap[fieldKey];
  if (exact) return exact;
  const normalized = normalizeFieldKeyForMetadataLookup(fieldKey);
  for (const [k, m] of Object.entries(metadataMap)) {
    if (normalizeFieldKeyForMetadataLookup(k) === normalized) return m;
  }
  return undefined;
}

/** @deprecated Use getFieldMetadataFromRegistry. Kept for backward compatibility. */
export const getFieldMetadata = getFieldMetadataFromRegistry;

/**
 * Get all filterable field keys for a module.
 * Uses the filterable metadata property.
 * 
 * @param moduleKey - The module key
 * @returns Array of filterable field keys (shallow copy)
 */
export function getFilterableFieldsForModule(moduleKey: ModuleKey): string[] {
  const metadata = getFieldMetadataMap(moduleKey);
  if (!metadata) return [];
  return getFilterableFields(metadata);
}

/**
 * Get all fields that are allowed at creation time for a module.
 * Uses the allowOnCreate metadata property and implicit rules.
 * 
 * @param moduleKey - The module key
 * @returns Array of creatable field keys (shallow copy)
 */
export function getCreatableFieldsForModule(moduleKey: ModuleKey): string[] {
  const metadata = getFieldMetadataMap(moduleKey);
  if (!metadata) return [];
  
  return Object.entries(metadata)
    .filter(([_, m]) => isAllowedOnCreateBase(m))
    .map(([fieldName]) => fieldName);
}

/**
 * Get all protected field keys for a module.
 * Protected fields cannot be deleted.
 * 
 * @param moduleKey - The module key
 * @returns Array of protected field keys (shallow copy)
 */
export function getProtectedFieldsForModule(moduleKey: ModuleKey): string[] {
  const metadata = getFieldMetadataMap(moduleKey);
  if (!metadata) return [];
  return getProtectedFields(metadata);
}

/**
 * Get field keys by owner type for a module.
 * 
 * @param moduleKey - The module key
 * @param owner - The owner type ('core' | 'participation' | 'system')
 * @returns Array of field keys with the specified owner (shallow copy)
 */
export function getFieldsByOwnerForModule(
  moduleKey: ModuleKey,
  owner: BaseFieldOwner
): string[] {
  const metadata = getFieldMetadataMap(moduleKey);
  if (!metadata) return [];
  return getFieldsByOwner(metadata, owner);
}

/**
 * Get field keys by scope for a module.
 * 
 * @param moduleKey - The module key
 * @param scope - The field scope ('CORE' | 'SALES' | etc.)
 * @returns Array of field keys with the specified scope (shallow copy)
 */
export function getFieldsByScopeForModule(
  moduleKey: ModuleKey,
  scope: BaseFieldScope
): string[] {
  const metadata = getFieldMetadataMap(moduleKey);
  if (!metadata) return [];
  return getFieldsByScope(metadata, scope);
}

/**
 * Get system field keys for a module.
 * Convenience wrapper for getFieldsByOwnerForModule(moduleKey, 'system').
 * 
 * @param moduleKey - The module key
 * @returns Array of system field keys (shallow copy)
 */
export function getSystemFieldsForModule(moduleKey: ModuleKey): string[] {
  return getFieldsByOwnerForModule(moduleKey, 'system');
}

/**
 * Get core field keys for a module.
 * Convenience wrapper for getFieldsByOwnerForModule(moduleKey, 'core').
 * 
 * @param moduleKey - The module key
 * @returns Array of core field keys (shallow copy)
 */
export function getCoreFieldsForModule(moduleKey: ModuleKey): string[] {
  return getFieldsByOwnerForModule(moduleKey, 'core');
}

/**
 * Get participation field keys for a module.
 * Convenience wrapper for getFieldsByOwnerForModule(moduleKey, 'participation').
 * 
 * @param moduleKey - The module key
 * @returns Array of participation field keys (shallow copy)
 */
export function getParticipationFieldsForModule(moduleKey: ModuleKey): string[] {
  return getFieldsByOwnerForModule(moduleKey, 'participation');
}

/**
 * Get editable field keys for a module.
 * 
 * @param moduleKey - The module key
 * @returns Array of editable field keys (shallow copy)
 */
export function getEditableFieldsForModule(moduleKey: ModuleKey): string[] {
  const metadata = getFieldMetadataMap(moduleKey);
  if (!metadata) return [];
  
  return Object.entries(metadata)
    .filter(([_, m]) => m.editable === true)
    .map(([fieldName]) => fieldName);
}

/**
 * Classify a field for UI display.
 * Returns: 'core' | 'system' | app scope (e.g., 'SALES', 'HELPDESK', 'AUDIT')
 * 
 * @param moduleKey - The module key
 * @param fieldKey - The field key
 * @returns The classification string
 */
export function classifyFieldForModule(
  moduleKey: ModuleKey,
  fieldKey: string
): string {
  const metadata = getFieldMetadata(moduleKey, fieldKey);
  return classifyFieldBase(metadata);
}

/**
 * Group fields by their classification for a module.
 * Used for UI rendering in settings components.
 * 
 * @param moduleKey - The module key
 * @returns Object with core, participation, and system field arrays
 */
export function groupFieldsForModule(moduleKey: ModuleKey): {
  core: string[];
  participation: Record<string, string[]>;
  system: string[];
} {
  const metadata = getFieldMetadataMap(moduleKey);
  if (!metadata) {
    return { core: [], participation: {}, system: [] };
  }
  
  const core: string[] = [];
  const participation: Record<string, string[]> = {};
  const system: string[] = [];
  
  for (const [fieldKey, fieldMetadata] of Object.entries(metadata)) {
    const classification = classifyFieldBase(fieldMetadata);
    
    if (classification === 'core') {
      core.push(fieldKey);
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
  
  return { core, participation, system };
}

// =============================================================================
// CROSS-MODULE QUERY FUNCTIONS
// =============================================================================

/**
 * Get all fields across all registered modules.
 * 
 * @returns Map of module key to field keys
 */
export function getAllFields(): Record<ModuleKey, string[]> {
  const result: Record<string, string[]> = {};
  
  for (const moduleKey of MODULE_KEYS) {
    result[moduleKey] = getFieldsForModule(moduleKey);
  }
  
  return result as Record<ModuleKey, string[]>;
}

/**
 * Get all filterable fields across all registered modules.
 * 
 * @returns Map of module key to filterable field keys
 */
export function getAllFilterableFields(): Record<ModuleKey, string[]> {
  const result: Record<string, string[]> = {};
  
  for (const moduleKey of MODULE_KEYS) {
    result[moduleKey] = getFilterableFieldsForModule(moduleKey);
  }
  
  return result as Record<ModuleKey, string[]>;
}

/**
 * Get total field count across all registered modules.
 * 
 * @returns Total number of fields
 */
export function getTotalFieldCount(): number {
  let count = 0;
  
  for (const moduleKey of MODULE_KEYS) {
    count += getFieldsForModule(moduleKey).length;
  }
  
  return count;
}

/**
 * Check if a field exists in a module.
 * 
 * @param moduleKey - The module key
 * @param fieldKey - The field key
 * @returns true if the field exists
 */
export function hasField(moduleKey: ModuleKey, fieldKey: string): boolean {
  const metadata = getFieldMetadata(moduleKey, fieldKey);
  return metadata !== undefined;
}

/**
 * Find modules that have a field with the given key.
 * Useful for cross-module field analysis.
 * 
 * @param fieldKey - The field key to search for
 * @returns Array of module keys that have this field
 */
export function findModulesWithField(fieldKey: string): ModuleKey[] {
  return MODULE_KEYS.filter(moduleKey => hasField(moduleKey, fieldKey));
}
