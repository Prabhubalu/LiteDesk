/**
 * ============================================================================
 * PLATFORM FIELD MODEL: Item
 * ============================================================================
 * 
 * Canonical field metadata for Item entity.
 * 
 * This file encodes the authoritative field classification for Item records.
 * Items are supporting/secondary entities used across apps (primarily SALES).
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
 * 1. Items are supporting/secondary entities
 *    - Items are shared across apps but primarily SALES-focused
 *    - Conservative classification: minimal core fields, SALES-scoped business fields
 *    - fieldScope: 'SALES' for business fields indicates SALES app ownership
 * 
 * 2. Core fields are minimal identity fields
 *    - `item_name` (primary identifier)
 *    - `item_code` (identity/sku)
 *    - These are platform-level identity fields
 *    - fieldScope: 'CORE' indicates platform-level ownership
 * 
 * 3. Business fields are SALES-scoped participation fields
 *    - `item_type`, `category`, `description`, `price`, `inventory`, etc.
 *    - These exist primarily for SALES app usage
 *    - owner: 'participation', fieldScope: 'SALES'
 * 
 * 4. System fields are infrastructure-scoped
 *    - `createdBy`, `createdAt`, `updatedAt`, `organizationId`, `item_id`, etc.
 *    - Managed by the platform, never user-editable
 *    - fieldScope: 'CORE' indicates platform-level ownership
 * 
 * 5. Quick Create eligibility
 *    - Essential fields: item_name (required), item_type, category, selling_price
 *    - Excluded: inventory fields, tax details, relationships, system fields
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
import {
  isInventoryEnabled,
  isInventoryGatedField,
  shouldHideFieldWhenInventoryDisabled,
  type OrgCapabilities,
} from '@/utils/inventoryCapability';

// =============================================================================
// ITEM-SPECIFIC TYPE ALIASES (for backward compatibility)
// =============================================================================

/**
 * Field ownership classification for Items.
 * @deprecated Use BaseFieldOwner from BaseFieldModel.ts
 */
export type ItemFieldOwner = BaseFieldOwner;

/**
 * Field intent classification for Items.
 * Items module uses 'primary' for item_name, 'identity' for item_code/sku, 'tracking' for pricing/inventory.
 */
export type ItemFieldIntent = 'primary' | 'identity' | 'state' | 'detail' | 'tracking' | 'system';

/**
 * Field scope classification for Items.
 * @deprecated Use BaseFieldScope from BaseFieldModel.ts
 */
export type ItemFieldScope = BaseFieldScope;

/**
 * Filter type classification for Items.
 * @deprecated Use BaseFilterType from BaseFieldModel.ts
 */
export type ItemFilterType = BaseFilterType;

// =============================================================================
// ITEM FIELD METADATA INTERFACE
// =============================================================================

/**
 * Item-specific field metadata interface.
 * Extends BaseFieldMetadata with Item-specific intent types.
 */
export interface ItemFieldMetadata extends Omit<BaseFieldMetadata, 'intent'> {
  /**
   * Field intent classification.
   * Items uses 'primary' for item_name, 'identity' for item_code, 'tracking' for pricing/inventory.
   */
  intent: ItemFieldIntent;
}

// =============================================================================
// FIELD METADATA DEFINITIONS
// =============================================================================

/**
 * Canonical field metadata for Item entity.
 * This is the single source of truth for Item field classification.
 */
export const ITEM_FIELD_METADATA: Record<string, ItemFieldMetadata> = {
  // ===========================================================================
  // SYSTEM FIELDS (Infrastructure, never user-editable)
  // Type A: Infrastructure (never visible): _id, __v, organizationId
  // Type B: Audit (visible, read-only): createdAt, updatedAt, createdBy, modifiedBy
  // item_id: visible (identity), read-only
  // ===========================================================================
  
  organizationId: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isProtected: true,
    filterable: false,
    filterType: 'entity',
    isSystem: true,
    isVisibleInConfig: false,
  },
  
  item_id: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isProtected: true,
    filterable: true,
    filterType: 'text',
    isSystem: true,
    isVisibleInConfig: true,
  },
  
  createdBy: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isProtected: true,
    filterable: true,
    filterType: 'user',
    isSystem: true,
    isVisibleInConfig: true,
  },
  
  createdAt: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isProtected: true,
    filterable: true,
    filterType: 'date',
    filterPriority: 2,
    isSystem: true,
    isVisibleInConfig: true,
  },
  
  modifiedBy: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isProtected: true,
    filterable: false,
    isSystem: true,
    isVisibleInConfig: true,
  },
  
  updatedAt: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isProtected: true,
    filterable: true,
    filterType: 'date',
    isSystem: true,
    isVisibleInConfig: true,
  },
  
  _id: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isProtected: true,
    filterable: false,
    isSystem: true,
    isVisibleInConfig: false,
  },
  
  __v: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    isProtected: true,
    filterable: false,
    isSystem: true,
    isVisibleInConfig: false,
  },
  
  // ===========================================================================
  // CORE FIELDS (Platform-level identity)
  // ===========================================================================
  
  item_name: {
    owner: 'core',
    intent: 'primary',
    fieldScope: 'CORE',
    editable: true,
    isProtected: false,
    filterable: true,
    filterType: 'text',
    filterPriority: 1,
  },
  
  item_code: {
    owner: 'core',
    intent: 'identity',
    fieldScope: 'CORE',
    editable: true,
    isProtected: false,
    filterable: true,
    filterType: 'text',
    filterPriority: 2,
  },
  
  // ===========================================================================
  // PARTICIPATION FIELDS (SALES-scoped business fields)
  // ===========================================================================
  
  item_type: {
    owner: 'participation',
    intent: 'state',
    fieldScope: 'SALES',
    editable: true,
    isProtected: false,
    filterable: true,
    filterType: 'select',
    filterPriority: 1,
    requiredFor: ['SALES'],
  },
  
  /** @deprecated Denormalized label — use categoryId. Kept for list/filter compat. */
  category: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'SALES',
    editable: false,
    isProtected: true,
    filterable: true,
    filterType: 'select',
    filterPriority: 2,
    isVisibleInConfig: false,
  },

  categoryId: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'SALES',
    editable: true,
    isProtected: false,
    filterable: true,
    filterType: 'entity',
    filterPriority: 2,
  },

  attributeValues: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'SALES',
    editable: true,
    isProtected: false,
    filterable: false,
    isVisibleInConfig: false,
  },
  
  /** @deprecated Denormalized sub-label when category has a parent — synced from categoryId. */
  subcategory: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'SALES',
    editable: false,
    isProtected: true,
    filterable: true,
    filterType: 'select',
    isVisibleInConfig: false,
  },
  
  tags: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'SALES',
    editable: true,
    isProtected: false,
    filterable: true,
    filterType: 'multi-select',
  },
  
  description: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'SALES',
    editable: true,
    isProtected: false,
    filterable: false,
  },
  
  product_image: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'SALES',
    editable: true,
    isProtected: false,
    filterable: false,
  },
  
  unit_of_measure: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'SALES',
    editable: true,
    isProtected: false,
    filterable: true,
    filterType: 'select',
  },
  
  status: {
    owner: 'participation',
    intent: 'state',
    fieldScope: 'SALES',
    editable: true,
    isProtected: false,
    filterable: true,
    filterType: 'select',
    filterPriority: 2,
  },

  lifecycle_state: {
    owner: 'participation',
    intent: 'state',
    fieldScope: 'SALES',
    editable: true,
    isProtected: false,
    filterable: true,
    filterType: 'select',
    filterPriority: 1,
  },
  
  cost_price: {
    owner: 'participation',
    intent: 'tracking',
    fieldScope: 'SALES',
    editable: true,
    isProtected: false,
    filterable: true,
    filterType: 'number',
  },
  
  selling_price: {
    owner: 'participation',
    intent: 'tracking',
    fieldScope: 'SALES',
    editable: true,
    isProtected: false,
    filterable: true,
    filterType: 'number',
    filterPriority: 2,
  },
  
  currency: {
    owner: 'participation',
    intent: 'tracking',
    fieldScope: 'SALES',
    editable: true,
    isProtected: false,
    filterable: true,
    filterType: 'select',
  },
  
  tax_type: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'SALES',
    editable: true,
    isProtected: false,
    filterable: true,
    filterType: 'select',
  },
  
  tax_percentage: {
    owner: 'participation',
    intent: 'tracking',
    fieldScope: 'SALES',
    editable: true,
    isProtected: false,
    filterable: false,
  },
  
  commission_rate: {
    owner: 'participation',
    intent: 'tracking',
    fieldScope: 'SALES',
    editable: true,
    isProtected: false,
    filterable: false,
  },
  
  stock_quantity: {
    owner: 'participation',
    intent: 'tracking',
    fieldScope: 'SALES',
    editable: true,
    isProtected: false,
    filterable: false,
    filterType: 'number',
    isVisibleInConfig: false,
  },

  reorder_level: {
    owner: 'participation',
    intent: 'tracking',
    fieldScope: 'SALES',
    editable: false,
    isProtected: false,
    filterable: false,
    isVisibleInConfig: false,
  },
  
  serial_numbers: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'SALES',
    editable: true,
    isProtected: false,
    filterable: false,
  },
  
  warranty_period_months: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'SALES',
    editable: true,
    isProtected: false,
    filterable: false,
  },
  
  vendor: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'SALES',
    editable: true,
    isProtected: false,
    filterable: true,
    filterType: 'entity',
  },
  
  linked_deals: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'SALES',
    editable: false,
    isProtected: false,
    filterable: false,
  },
  
  linked_invoices: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'SALES',
    editable: false,
    isProtected: false,
    filterable: false,
  },
  
  linked_forms: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'SALES',
    editable: false,
    isProtected: false,
    filterable: false,
  },
  
  linked_contacts: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'SALES',
    editable: false,
    isProtected: false,
    filterable: false,
  },
  
  // NOTE: customFields is a transitional container.
  // Long-term, custom fields should become first-class metadata entries.
  customFields: {
    owner: 'participation',
    intent: 'detail',
    fieldScope: 'SALES',
    editable: true,
    isProtected: false,
    filterable: false,
  },
};

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validates Item-specific field metadata constraints.
 */
function validateItemFieldMetadata(fieldName: string, metadata: ItemFieldMetadata): void {
  validateBaseFieldMetadata(fieldName, metadata as unknown as BaseFieldMetadata);
  
  const { owner, intent } = metadata;
  
  // Core fields must have valid intents
  const validCoreIntents = ['primary', 'identity', 'detail'];
  if (owner === 'core' && !validCoreIntents.includes(intent)) {
    throw new Error(
      `Field "${fieldName}": Item core fields must have intent: ${validCoreIntents.join(' | ')}. Found: ${intent}`
    );
  }
  
  // Participation fields must have valid intents
  const validParticipationIntents = ['state', 'detail', 'tracking'];
  if (owner === 'participation' && !validParticipationIntents.includes(intent)) {
    throw new Error(
      `Field "${fieldName}": Item participation fields must have intent: ${validParticipationIntents.join(' | ')}. Found: ${intent}`
    );
  }
}

/**
 * Validates all Item field metadata on module load.
 * Throws if any field is invalid.
 */
function validateAllItemMetadata(): void {
  for (const [fieldName, metadata] of Object.entries(ITEM_FIELD_METADATA)) {
    try {
      validateItemFieldMetadata(fieldName, metadata);
    } catch (error) {
      console.error(`[itemFieldModel] Validation error for field "${fieldName}":`, error);
      throw error;
    }
  }
}

// Run validation on module load
validateAllItemMetadata();

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get metadata for a specific Item field.
 * Uses case-insensitive lookup and handles field key variations (kebab-case, snake_case, camelCase).
 */
export function getItemFieldMetadata(fieldKey: string): ItemFieldMetadata | undefined {
  if (!fieldKey) return undefined;
  
  // Try exact match first
  if (ITEM_FIELD_METADATA[fieldKey]) {
    return ITEM_FIELD_METADATA[fieldKey];
  }
  
  const normalizedName = normalizeFieldKeyForMetadataLookup(fieldKey);
  
  for (const [key, metadata] of Object.entries(ITEM_FIELD_METADATA)) {
    if (normalizeFieldKeyForMetadataLookup(key) === normalizedName) {
      return metadata;
    }
  }
  
  // Try kebab-case to snake_case conversion (item-name -> item_name)
  if (fieldKey.includes('-')) {
    const snakeCaseKey = fieldKey.replace(/-/g, '_');
    if (ITEM_FIELD_METADATA[snakeCaseKey]) {
      return ITEM_FIELD_METADATA[snakeCaseKey];
    }
    // Try case-insensitive match with snake_case
    const normalizedSnake = snakeCaseKey.toLowerCase();
    for (const [key, metadata] of Object.entries(ITEM_FIELD_METADATA)) {
      if (key.toLowerCase() === normalizedSnake) {
        return metadata;
      }
    }
  }
  
  // Try camelCase to snake_case conversion (itemName -> item_name)
  if (/[A-Z]/.test(fieldKey)) {
    const snakeCaseKey = fieldKey.replace(/([A-Z])/g, '_$1').toLowerCase();
    if (ITEM_FIELD_METADATA[snakeCaseKey]) {
      return ITEM_FIELD_METADATA[snakeCaseKey];
    }
    // Try case-insensitive match
    const normalizedSnake = snakeCaseKey.toLowerCase();
    for (const [key, metadata] of Object.entries(ITEM_FIELD_METADATA)) {
      if (key.toLowerCase() === normalizedSnake) {
        return metadata;
      }
    }
  }
  
  return undefined;
}

/**
 * Get all Item field metadata as an array.
 */
export function getItemFields(): ItemFieldMetadata[] {
  return Object.entries(ITEM_FIELD_METADATA).map(([fieldKey, metadata]) => ({
    ...metadata,
    fieldKey,
  }));
}

/**
 * Classify an Item field by owner.
 * Returns 'core' | 'participation' | 'system' | null
 */
export function classifyItemField(fieldKey: string): BaseFieldOwner | null {
  const metadata = getItemFieldMetadata(fieldKey);
  return metadata ? metadata.owner : null;
}

/**
 * Check if a field is a system field.
 */
export function isItemSystemField(fieldKey: string): boolean {
  return classifyItemField(fieldKey) === 'system';
}

/**
 * Check if a field is a core field.
 */
export function isItemCoreField(fieldKey: string): boolean {
  return classifyItemField(fieldKey) === 'core';
}

/**
 * Check if a field is a protected field (system or core).
 */
export function isItemProtectedField(fieldKey: string): boolean {
  const metadata = getItemFieldMetadata(fieldKey);
  return metadata?.isProtected === true;
}

/**
 * Get fields eligible for quick create.
 * Returns field keys for essential fields only.
 */
export function getItemQuickCreateFields(): string[] {
  return [
    'item_name',
    'item_code',
    'item_type',
    'lifecycle_state',
    'categoryId',
    'selling_price'
  ];
}

/** Catalog scaffold fields — not shown on flat item create/edit drawer (catalog section on record). */
export function getItemCatalogScaffoldFieldKeys(): string[] {
  return [
    'hasVariants',
    'defaultVariantId',
    'variants',
    'media',
    'catalogVariantId',
    'attributeValues',
    'attributeTemplates',
    'defaultVariant'
  ];
}

/** Legacy flat category labels — hidden from settings/create; use categoryId. */
export function getItemLegacyCategoryFieldKeys(): string[] {
  return ['category', 'subcategory'];
}

/** @deprecated Use INVENTORY_GATED_FIELD_KEYS.items from inventoryCapability.ts */
export const ITEM_INVENTORY_ENGINE_FIELD_KEYS = new Set([
  'stock_quantity',
  'reorder_level',
  'serial_numbers',
]);

export function isItemInventoryEngineFieldKey(fieldKey: string): boolean {
  return isInventoryGatedField('items', fieldKey);
}

export function shouldShowItemFieldForCapabilities(
  fieldKey: string,
  capabilities: OrgCapabilities
): boolean {
  return !shouldHideFieldWhenInventoryDisabled('items', fieldKey, isInventoryEnabled({ capabilities }));
}

/**
 * Get all core Item fields.
 */
export function getCoreItemFields(): string[] {
  return Object.keys(ITEM_FIELD_METADATA).filter((key) =>
    isItemCoreField(key)
  );
}

/**
 * Get all system Item fields.
 */
export function getItemSystemFields(): string[] {
  return Object.keys(ITEM_FIELD_METADATA).filter((key) =>
    isItemSystemField(key)
  );
}

/**
 * Get all participation Item fields.
 */
export function getItemParticipationFields(): string[] {
  return Object.keys(ITEM_FIELD_METADATA).filter((key) =>
    classifyItemField(key) === 'participation'
  );
}

/**
 * Group Item fields by owner and scope.
 */
export function groupItemFields(): {
  core: string[];
  participation: Record<string, string[]>;
  system: string[];
} {
  const core: string[] = [];
  const participation: Record<string, string[]> = {};
  const system: string[] = [];
  
  for (const [fieldKey, metadata] of Object.entries(ITEM_FIELD_METADATA)) {
    if (metadata.owner === 'core') {
      core.push(fieldKey);
    } else if (metadata.owner === 'participation') {
      const scope = metadata.fieldScope;
      if (!participation[scope]) {
        participation[scope] = [];
      }
      participation[scope].push(fieldKey);
    } else if (metadata.owner === 'system') {
      system.push(fieldKey);
    }
  }
  
  return { core, participation, system };
}

// =============================================================================
// EXPORTS
// =============================================================================

/**
 * @deprecated Use ITEM_FIELD_METADATA instead
 */
export const ITEM_FIELDS = getItemFields();
