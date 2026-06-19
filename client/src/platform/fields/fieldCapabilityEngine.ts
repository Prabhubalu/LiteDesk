/**
 * ============================================================================
 * FIELD CAPABILITY ENGINE
 * ============================================================================
 *
 * Centralized single source of truth for field capability decisions.
 * All capability logic flows through this engine — no component should
 * reason about metadata directly.
 *
 * ⚠️ ARCHITECTURAL CONTRACT:
 *
 * 1. Engine uses ONLY existing helpers:
 *    - getFieldMetadataFromRegistry
 *    - BaseFieldModel: getIsSystemBase, getIsEditableBase, getIsVisibleInConfigBase,
 *      getIsComputedBase, getIsHideableBase
 *
 * 2. No hardcoded field keys — all classification comes from metadata + base helpers
 *
 * 3. No permission logic yet — this is structural only
 *
 * 4. Future-ready: CapabilityContext reserved for role-based permissions,
 *    workflow-state restrictions, view-based overrides
 *
 * ============================================================================
 */

import { getFieldMetadataFromRegistry } from './FieldRegistry';
import type { BaseFieldMetadata } from './BaseFieldModel';
import {
  getIsSystemBase,
  getIsEditableBase,
  getIsVisibleInConfigBase,
  getIsComputedBase,
  getIsHideableBase,
  normalizeFieldKeyForMetadataLookup,
} from './BaseFieldModel';
import { globalSystemFieldKeySetHas } from './globalSystemFields';
import {
  getFieldRbacAuthContext,
  isFieldHiddenByRbac,
  isFieldReadOnlyByRbac,
  type FieldPermissionsMap
} from '@/utils/fieldRbacPermission';
import { useAuthStore } from '@/stores/authRegistry';

function resolveAuthRbacContext(): {
  fieldPermissions?: FieldPermissionsMap;
  fieldPermissionAppKey?: string | null;
  bypass?: boolean;
} | null {
  try {
    const auth = useAuthStore();
    return getFieldRbacAuthContext(auth.user, auth.organization);
  } catch {
    return null;
  }
}

// Re-export for existing imports from fieldCapabilityEngine (see globalSystemFields.ts).
export {
  getGlobalSystemFieldKeys,
  isGlobalSystemFieldKey,
  normalizeFieldKeyForSystemMatch,
} from './globalSystemFields';

/**
 * Document identity + audit keys (normalized like global system keys).
 * Always non-editable even when registry has no metadata — getIsEditableBase(undefined) is true.
 * Includes `id` from `_id` (normalize strips underscores).
 */
const IMMUTABLE_NON_EDITABLE_KEYS = new Set([
  'id',
  'createdat',
  'updatedat',
  'createdby',
  'modifiedby',
  'updatedby',
]);

/**
 * For flattened paths (e.g. list columns from schema paths: "assignmentControl.lockReason"),
 * resolve metadata from the root segment when the full path is not in the registry.
 */
function getFieldMetadataForSystemLookup(
  moduleKey: string,
  fieldKey: string
): BaseFieldMetadata | undefined {
  const exact = getFieldMetadataFromRegistry(moduleKey, fieldKey);
  if (exact) return exact;
  const dot = fieldKey.indexOf('.');
  if (dot <= 0) return undefined;
  return getFieldMetadataFromRegistry(moduleKey, fieldKey.slice(0, dot));
}

// =============================================================================
// TYPES
// =============================================================================

/**
 * Minimal field shape for capability lookups.
 * Engine uses only field.key for metadata lookup — never field.editable or other runtime props.
 */
export interface Field {
  key: string;
  [key: string]: unknown;
}

/**
 * Optional context for future capability overrides.
 * Not used yet — reserved for role-based permissions, workflow-state, view-type.
 */
export interface CapabilityContext {
  userRole?: string;
  viewType?: 'form' | 'table' | 'summary' | 'preview';
  recordState?: string;
  fieldPermissions?: FieldPermissionsMap;
  fieldPermissionAppKey?: string | null;
  rbacBypass?: boolean;
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Check if a field is a system field (platform-managed, infrastructure).
 * Returns true if:
 *   - metadata.isSystem === true OR BaseFieldModel resolves as system
 *   - OR field key is in GLOBAL_SYSTEM_FIELD_KEYS (e.g. trash: deletedAt, deletedBy, deletionReason)
 */
export function isSystemField(moduleKey: string, field: Field): boolean {
  const metadata = getFieldMetadataForSystemLookup(moduleKey, field.key);
  if (metadata) return getIsSystemBase(metadata);
  // Unknown fields that are model-level system fields (trash, etc.) - never show in create/edit
  const keyLower = normalizeFieldKeyForMetadataLookup(field.key);
  return globalSystemFieldKeySetHas(keyLower);
}

/**
 * Check if a field is visible in Field Configuration UI.
 * Returns false if metadata.isVisibleInConfig === false OR BaseFieldModel resolves false.
 * Otherwise returns true.
 */
export function isFieldVisibleInConfig(moduleKey: string, field: Field): boolean {
  const metadata = getFieldMetadataFromRegistry(moduleKey, field.key);
  return getIsVisibleInConfigBase(metadata, field.key);
}

/**
 * Check if a field is computed/derived (not stored directly).
 * Returns true if metadata.isComputed === true.
 */
export function isComputedField(moduleKey: string, field: Field): boolean {
  const metadata = getFieldMetadataFromRegistry(moduleKey, field.key);
  return getIsComputedBase(metadata);
}

function resolveRbacContext(context?: CapabilityContext) {
  if (context?.rbacBypass) return { bypass: true as const };
  if (context?.fieldPermissions) {
    return {
      fieldPermissions: context.fieldPermissions,
      fieldPermissionAppKey: context.fieldPermissionAppKey ?? 'SALES'
    };
  }
  const authCtx = resolveAuthRbacContext();
  if (!authCtx) return null;
  if (authCtx.bypass) return { bypass: true as const };
  return authCtx;
}

/**
 * RBAC v2: field hidden by profile/role field permission map.
 */
export function isFieldHiddenForUser(
  moduleKey: string,
  field: Field,
  context?: CapabilityContext
): boolean {
  const rbac = resolveRbacContext(context);
  if (!rbac || 'bypass' in rbac) return false;
  return isFieldHiddenByRbac(
    rbac.fieldPermissions,
    rbac.fieldPermissionAppKey,
    moduleKey,
    field.key
  );
}

/**
 * Check if a field can be edited by the user.
 * Returns false if ANY of:
 *   - metadata.isEditable === false
 *   - metadata.isSystem === true
 *   - metadata.isComputed === true
 *   - BaseFieldModel resolves non-editable
 *   - field is in GLOBAL_SYSTEM_FIELD_KEYS (trash, etc.)
 *   - field is document id / audit (IMMUTABLE_NON_EDITABLE_KEYS), including `_id` → `id`
 *   - raw key `__v` (Mongoose version; normalize alone would match `v`)
 * Otherwise returns true.
 *
 * Engine does NOT use field.editable — metadata + base helpers only.
 */
export function canEditField(moduleKey: string, field: Field, context?: CapabilityContext): boolean {
  const rbac = resolveRbacContext(context);
  if (rbac && !('bypass' in rbac)) {
    if (
      isFieldHiddenByRbac(rbac.fieldPermissions, rbac.fieldPermissionAppKey, moduleKey, field.key) ||
      isFieldReadOnlyByRbac(rbac.fieldPermissions, rbac.fieldPermissionAppKey, moduleKey, field.key)
    ) {
      return false;
    }
  }

  const raw = String(field.key || '');
  if (raw === '__v') return false;
  const keyLower = normalizeFieldKeyForMetadataLookup(field.key);
  if (globalSystemFieldKeySetHas(keyLower)) return false;
  if (IMMUTABLE_NON_EDITABLE_KEYS.has(keyLower)) return false;
  const metadata = getFieldMetadataForSystemLookup(moduleKey, field.key);
  if (metadata?.isEditable === false) return false;
  if (getIsSystemBase(metadata)) return false;
  if (metadata?.isComputed === true) return false;
  if (!getIsEditableBase(metadata)) return false;
  return true;
}

/**
 * Check if a field can be hidden by users in list/detail views.
 * Returns based on metadata.isHideable with fallback to BaseFieldModel.
 */
export function canHideField(moduleKey: string, field: Field): boolean {
  const metadata = getFieldMetadataFromRegistry(moduleKey, field.key);
  return getIsHideableBase(metadata);
}
