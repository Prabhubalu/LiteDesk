/**
 * Field-Level Access Control Utilities
 * 
 * Controls READ and WRITE access to fields based on user roles and permissions.
 * This is orthogonal to owner and context - it controls ACCESS, not existence.
 * 
 * For complete field governance rules, see: /docs/field-governance.md
 * 
 * Rules:
 * - Platform-owned fields: Only owners/admins can edit
 * - App-owned fields: Users with app access and edit permission can edit
 * - Org-owned fields: Users with edit permission can edit
 * - READ access: Based on view permission for the module
 * - RBAC v2 field permissions (hidden/read/write) tighten access when enabled
 */

const {
  resolveFieldPermission,
  isFieldHidden
} = require('../services/fieldPermissionResolver');

const {
  isInventorySchemaModuleKey
} = require('../constants/inventoryWorkbenchModules');

function rbacFieldParams(user, moduleKey, field, appKey = null) {
  return {
    appKey: appKey || user?._fieldPermissionAppKey || null,
    moduleKey,
    fieldKey: field?.key,
    organization: user?.organization || null
  };
}

/**
 * Module-level grant check aligned with runtimePermissionResolver
 * (inventory workbench falls back to inventory.* envelope; people→contacts, etc.).
 *
 * @param {object} user
 * @param {string} moduleKey
 * @param {'view'|'create'|'edit'|'delete'} action
 * @returns {boolean}
 */
function hasModuleActionPermission(user, moduleKey, action) {
  if (!user) return false;
  if (user.isOwner === true || user._isTenantPrivileged === true) return true;

  const key = String(moduleKey || '').toLowerCase();
  try {
    const { resolveRuntimePermission } = require('../services/runtimePermissionResolver');
    // Do not pass a mismatched request appKey (e.g. SALES from another surface) for inventory modules —
    // resolver hard-fails when requestAppKey !== effectiveAppKey for native inventory keys.
    const appKeyHint = isInventorySchemaModuleKey(key)
      ? 'INVENTORY'
      : user._fieldPermissionAppKey || null;
    if (
      resolveRuntimePermission(user, key, action, {
        appKey: appKeyHint,
        orgContext: user._orgPermissionContext || null,
        organization: user.organization || null
      })
    ) {
      return true;
    }
  } catch (_e) {
    // Fall through to flat envelope checks
  }

  const normalizedModule = key === 'people' ? 'contacts' : key;
  const perms =
    user.permissions?.[normalizedModule] ||
    user.permissions?.[key] ||
    (key === 'people' ? user.permissions?.people : null) ||
    // Inventory workbench: roles often only grant the inventory ledger envelope
    (isInventorySchemaModuleKey(key) ? user.permissions?.inventory : null) ||
    null;

  if (perms && typeof perms === 'object') {
    if (perms[action] === true) return true;
    if (action === 'view' && (perms.view === true || perms.read === true || perms.viewAll === true)) {
      return true;
    }
  }

  // Settings admins configuring module schemas need to read field catalogs
  if (action === 'view') {
    const settings = user.permissions?.settings;
    if (settings?.edit === true || settings?.customizeFields === true || settings?.view === true) {
      return true;
    }
  }
  return false;
}

/**
 * Check if user can READ a field
 * 
 * @param {Object} field - Field definition
 * @param {Object} user - User object with permissions
 * @param {string} moduleKey - Module key (e.g., 'people', 'deals')
 * @param {string|null} [appKey] - Optional app key for RBAC field map
 * @returns {boolean} - True if user can read the field
 */
function canReadField(field, user, moduleKey, appKey = null) {
  if (!field || !user) return false;
  
  // Owners can read all fields
  if (user.isOwner) return true;

  if (isFieldHidden(user, rbacFieldParams(user, moduleKey, field, appKey))) {
    return false;
  }

  return hasModuleActionPermission(user, moduleKey, 'view');
}

/**
 * Check if user can WRITE (edit) a field
 * 
 * @param {Object} field - Field definition
 * @param {Object} user - User object with permissions
 * @param {string} moduleKey - Module key (e.g., 'people', 'deals')
 * @returns {boolean} - True if user can write to the field
 */
function canWriteField(field, user, moduleKey, appKey = null) {
  if (!field || !user) return false;

  const rbacState = resolveFieldPermission(user, rbacFieldParams(user, moduleKey, field, appKey));
  if (rbacState === 'hidden' || rbacState === 'read') {
    return false;
  }

  const normalizedRole = String(user.role || '').toLowerCase();
  const isLegacyAdmin = normalizedRole === 'admin' || normalizedRole === 'owner';
  const hasAdminAppAccess = Array.isArray(user.appAccess) && user.appAccess.some((access) => {
    if (String(access?.status || 'ACTIVE').toUpperCase() !== 'ACTIVE') return false;
    const roleKey = String(access?.roleKey || '').toUpperCase();
    return roleKey === 'ADMIN';
  });
  const roleElevatesPlatformFields = user._roleAllowsPlatformOwnedFieldEdit === true;
  const isAdminUser =
    user.isOwner === true ||
    isLegacyAdmin ||
    hasAdminAppAccess ||
    roleElevatesPlatformFields;
  
  // Owners can write to all fields (except platform-owned fields may have restrictions)
  if (user.isOwner) {
    // Even owners cannot edit platform-owned fields (unless they're admins)
    const fieldOwner = (field.owner || 'platform').toLowerCase();
    if (fieldOwner === 'platform') {
      // Platform fields can only be edited by owners (isOwner flag)
      return true; // Owners can edit platform fields
    }
    return true;
  }
  
  // Check module-level edit permission (inventory/workbench envelope–aware)
  const hasEditPermission = hasModuleActionPermission(user, moduleKey, 'edit');
  
  if (!hasEditPermission) return false;
  
  // Check field ownership rules
  const fieldOwner = (field.owner || 'platform').toLowerCase();
  
  // Platform-owned fields: Only owners/admins can edit
  if (fieldOwner === 'platform') {
    return isAdminUser;
  }
  
  // App-owned fields: Users with app access and edit permission can edit
  if (fieldOwner === 'app') {
    // Check if user has access to the app (via appAccess or allowedApps)
    const fieldContext = (field.context || 'global').toLowerCase();
    if (fieldContext === 'global') {
      // Global app fields - check if user has any app access
      return hasEditPermission;
    }
    
    // App-specific fields - check if user has access to that app
    const appKeyUpper = fieldContext.toUpperCase();
    const hasAppAccess = user.appAccess?.some(
      access => access.appKey === appKeyUpper && access.status === 'ACTIVE'
    ) || user.allowedApps?.includes(appKeyUpper) || false;
    
    return hasAppAccess && hasEditPermission;
  }
  
  // Org-owned fields: Users with edit permission can edit.
  // Tenant-defined app-scoped custom fields use context !== 'global' (lowercase app token, e.g. 'sales').
  if (fieldOwner === 'org') {
    const fieldContext = (field.context || 'global').toLowerCase();
    if (fieldContext === 'global') {
      return hasEditPermission;
    }
    const appKeyUpper = fieldContext.toUpperCase();
    const hasAppAccess = user.appAccess?.some(
      (access) => access.appKey === appKeyUpper && access.status === 'ACTIVE'
    ) || user.allowedApps?.includes(appKeyUpper) || false;
    return hasAppAccess && hasEditPermission;
  }
  
  // Default: deny if ownership is unclear
  return false;
}

/**
 * Filter fields by READ access
 * 
 * @param {Array} fields - Array of field definitions
 * @param {Object} user - User object with permissions
 * @param {string} moduleKey - Module key
 * @returns {Array} - Filtered fields that user can read
 */
function filterFieldsByReadAccess(fields, user, moduleKey) {
  if (!Array.isArray(fields)) return [];
  if (!user) return [];
  
  return fields.filter(field => canReadField(field, user, moduleKey));
}

/**
 * Filter fields by WRITE access
 * 
 * @param {Array} fields - Array of field definitions
 * @param {Object} user - User object with permissions
 * @param {string} moduleKey - Module key
 * @returns {Array} - Filtered fields that user can write
 */
function filterFieldsByWriteAccess(fields, user, moduleKey) {
  if (!Array.isArray(fields)) return [];
  if (!user) return [];
  
  return fields.filter(field => canWriteField(field, user, moduleKey));
}

/**
 * Validate if user can write to a specific field
 * 
 * @param {string} fieldKey - Field key
 * @param {Array} fields - Array of field definitions
 * @param {Object} user - User object with permissions
 * @param {string} moduleKey - Module key
 * @returns {Object} - { allowed: boolean, reason: string }
 */
function validateFieldWrite(fieldKey, fields, user, moduleKey, appKey = null) {
  if (!fieldKey || !fields || !user) {
    return { allowed: false, reason: 'Missing required parameters' };
  }
  
  const field = fields.find(f => f && f.key && f.key.toLowerCase() === fieldKey.toLowerCase());
  
  if (!field) {
    // Field doesn't exist - allow (might be custom field or new field)
    return { allowed: true, reason: 'Field not found in definitions' };
  }

  const rbacState = resolveFieldPermission(user, {
    appKey: appKey || user?._fieldPermissionAppKey || null,
    moduleKey,
    fieldKey: field.key,
    organization: user?.organization || null
  });
  if (rbacState === 'hidden') {
    return { allowed: false, reason: 'Field is hidden by role profile' };
  }
  if (rbacState === 'read') {
    return { allowed: false, reason: 'Field is read-only by role profile' };
  }
  
  const canWrite = canWriteField(field, user, moduleKey, appKey);
  
  if (!canWrite) {
    const fieldOwner = (field.owner || 'platform').toLowerCase();
    let reason = 'Insufficient permissions';
    
    if (fieldOwner === 'platform') {
      reason = 'Platform fields cannot be modified by regular users';
    } else if (fieldOwner === 'app') {
      reason = 'App-managed fields require app access and edit permission';
    } else if (fieldOwner === 'org') {
      const fc = (field.context || 'global').toLowerCase();
      reason =
        fc !== 'global'
          ? 'This field is scoped to an application; you need access to that app and edit permission'
          : 'Edit permission required for this field';
    }
    
    return { allowed: false, reason };
  }
  
  return { allowed: true, reason: 'Access granted' };
}

module.exports = {
  canReadField,
  canWriteField,
  filterFieldsByReadAccess,
  filterFieldsByWriteAccess,
  validateFieldWrite
};

