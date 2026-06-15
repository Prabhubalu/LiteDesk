/**
 * ============================================================================
 * Phase 2A.3: Projection-Aware Create Type Resolver
 * ============================================================================
 * 
 * This utility resolves the correct type for record creation based on
 * app-specific projection metadata. Ensures that:
 * - Only allowed record types can be created
 * - Default types are applied when no explicit type is provided
 * - Backward compatibility is maintained
 * 
 * ⚠️ SAFETY RULES:
 * - Must never throw (returns safe defaults)
 * - Only applies during create operations
 * - Non-blocking fallback if projection metadata is missing
 * - Only works for platform-owned primitives (PEOPLE, ORGANIZATION, EVENT, FORM, TASK)
 * 
 * ============================================================================
 */

const {
  getProjection,
  getAllowedTypes,
  getDefaultType,
  isTypeAllowed,
  isPlatformOwnedPrimitive
} = require('./moduleProjectionResolver');

/**
 * Map module keys to their type field names in the models
 * Different models use different field names for the type concept
 */
const MODULE_TYPE_FIELD_MAP = {
  people: 'sales_type',
  organizations: 'type', // May not exist in model, will be handled gracefully
  events: 'eventType',
  forms: 'formType',
  tasks: 'taskType'
};

/**
 * Normalize type value for comparison
 * Handles case differences and value mapping
 * @param {string} type - Type value to normalize
 * @returns {string} - Normalized type value
 */
function normalizeTypeValue(type) {
  if (!type || typeof type !== 'string') {
    return null;
  }
  
  // Convert to uppercase for comparison
  return type.toUpperCase().trim();
}

/**
 * Map projection type to model field value
 * Handles differences between projection metadata and actual model values
 * @param {string} moduleKey - Module key
 * @param {string} projectionType - Type from projection metadata (e.g., 'LEAD')
 * @returns {string|null} - Model field value (e.g., 'Lead') or null
 */
function mapProjectionTypeToModelValue(moduleKey, projectionType) {
  if (!moduleKey || !projectionType) {
    return null;
  }

  const normalizedModuleKey = (moduleKey || '').toLowerCase();
  const normalizedType = normalizeTypeValue(projectionType);

  // People: Projection uses 'LEAD', 'CONTACT' -> Model uses 'Lead', 'Contact'
  if (normalizedModuleKey === 'people') {
    const typeMap = {
      'LEAD': 'Lead',
      'CONTACT': 'Contact',
      'PARTNER': 'Partner'
    };
    return typeMap[normalizedType] || null;
  }

  // Organization: Projection uses 'CUSTOMER', 'PARTNER', 'VENDOR'
  // Model may not have a simple type field - this will be handled gracefully
  if (normalizedModuleKey === 'organizations') {
    // For now, return as-is. May need mapping if model uses different values
    return projectionType; // Keep original case for now
  }

  // Event: Projection uses 'MEETING', 'INTERNAL_AUDIT', 'EXTERNAL_AUDIT_SINGLE', 'EXTERNAL_AUDIT_BEAT', 'FIELD_SALES_BEAT'
  // Model uses: 'Meeting', 'Internal Audit', 'External Audit — Single Org', 'External Audit Beat', 'Field Sales Beat'
  if (normalizedModuleKey === 'events') {
    const typeMap = {
      'MEETING': 'Meeting',
      'INTERNAL_AUDIT': 'Internal Audit',
      'EXTERNAL_AUDIT_SINGLE': 'External Audit — Single Org',
      'EXTERNAL_AUDIT_BEAT': 'External Audit Beat',
      'FIELD_SALES_BEAT': 'Field Sales Beat',
      // Legacy mappings for backward compatibility
      'AUDIT': 'Internal Audit', // Default to Internal Audit if just 'AUDIT'
      'INSPECTION': 'Field Sales Beat'
    };
    return typeMap[normalizedType] || null;
  }

  // Form: Projection uses 'SURVEY', 'AUDIT', 'FEEDBACK'
  // Model uses 'Survey', 'Audit', 'Feedback'
  if (normalizedModuleKey === 'forms') {
    const typeMap = {
      'SURVEY': 'Survey',
      'AUDIT': 'Audit',
      'FEEDBACK': 'Feedback'
    };
    return typeMap[normalizedType] || null;
  }

  // Task: projection type mapping not defined; taskType is set explicitly when provided
  if (normalizedModuleKey === 'tasks') {
    return null;
  }

  return null;
}

/**
 * Resolve the type for record creation
 * @param {Object} options - Resolver options
 * @param {string} options.appKey - App key (e.g., 'CRM', 'AUDIT')
 * @param {string} options.moduleKey - Module key (e.g., 'people', 'organizations')
 * @param {string} options.explicitType - Explicitly provided type from request body
 * @param {string} options.fallbackType - Fallback type if no projection exists
 * @returns {Object} - Resolution result with { allowed, type, reason }
 */
function resolveCreateType({ appKey, moduleKey, explicitType, fallbackType }) {
  try {
    // SAFETY: Return safe defaults if required params are missing
    if (!appKey || !moduleKey) {
      return {
        allowed: true,
        type: fallbackType || null,
        reason: null
      };
    }

    const normalizedAppKey = (appKey || '').toUpperCase();
    const normalizedModuleKey = (moduleKey || '').toLowerCase();

    // SAFETY: Only apply to platform-owned primitives
    if (!isPlatformOwnedPrimitive(normalizedModuleKey)) {
      return {
        allowed: true,
        type: fallbackType || explicitType || null,
        reason: null
      };
    }

    // Get projection metadata
    const projectionMeta = getProjection(normalizedAppKey, normalizedModuleKey);

    // SAFETY: If no projection exists, fall back to existing behavior
    if (!projectionMeta) {
      return {
        allowed: true,
        type: fallbackType || explicitType || null,
        reason: null
      };
    }

    // If explicitType is provided, validate it against projection
    if (explicitType) {
      const normalizedExplicitType = normalizeTypeValue(explicitType);
      const allowedTypes = getAllowedTypes(normalizedAppKey, normalizedModuleKey);

      // Check if type is allowed (case-insensitive)
      const isAllowed = allowedTypes.some(
        allowedType => normalizeTypeValue(allowedType) === normalizedExplicitType
      );

      if (!isAllowed) {
        return {
          allowed: false,
          type: null,
          reason: 'TYPE_NOT_ALLOWED',
          message: `Type "${explicitType}" is not allowed in ${normalizedAppKey} app for ${normalizedModuleKey} module. Allowed types: ${allowedTypes.join(', ')}`
        };
      }

      // Type is allowed - map it to model value if needed
      const modelValue = mapProjectionTypeToModelValue(normalizedModuleKey, explicitType);
      return {
        allowed: true,
        type: modelValue !== null ? modelValue : explicitType, // Use mapped value or original
        reason: null
      };
    }

    // No explicitType - use projection defaultType or fallback
    const defaultType = getDefaultType(normalizedAppKey, normalizedModuleKey);

    if (defaultType) {
      // Map default type to model value if needed
      const modelValue = mapProjectionTypeToModelValue(normalizedModuleKey, defaultType);
      return {
        allowed: true,
        type: modelValue !== null ? modelValue : defaultType,
        reason: null
      };
    }

    // No defaultType in projection - use fallback
    return {
      allowed: true,
      type: fallbackType || null,
      reason: null
    };

  } catch (error) {
    // SAFETY: Never throw - return safe fallback
    console.error('[appProjectionCreateResolver] Error resolving create type:', error);
    return {
      allowed: true,
      type: fallbackType || explicitType || null,
      reason: 'RESOLVER_ERROR',
      message: 'Error resolving create type - using fallback'
    };
  }
}

/**
 * Get the type field name for a module
 * @param {string} moduleKey - Module key
 * @returns {string|null} - Type field name or null if not applicable
 */
function getTypeFieldName(moduleKey) {
  if (!moduleKey) {
    return null;
  }

  const normalizedModuleKey = (moduleKey || '').toLowerCase();
  return MODULE_TYPE_FIELD_MAP[normalizedModuleKey] || null;
}

module.exports = {
  resolveCreateType,
  getTypeFieldName,
  normalizeTypeValue,
  mapProjectionTypeToModelValue
};

