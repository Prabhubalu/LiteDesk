/**
 * ============================================================================
 * Phase 2A.2: Projection-Aware Query Helper
 * ============================================================================
 * 
 * Applies module projection metadata at query time so that each app only sees
 * the record types it is allowed to see — without changing schemas, records, or ownership.
 * 
 * ⚠️ SAFETY RULES:
 * - Never throws (always returns a valid query object)
 * - Only applies filters if projection metadata exists
 * - Only applies to platform-owned primitives
 * - Returns baseQuery unchanged if no projection or invalid projection
 * 
 * This is read-time filtering only. No schema changes, no record mutations,
 * no permission changes, no enforcement on direct record fetch by ID.
 * 
 * ============================================================================
 */

const { getProjection } = require('./moduleProjectionResolver');
const { isPlatformOwnedPrimitive } = require('./moduleProjectionResolver');
const { getPeopleFieldQueryPath } = require('./peopleFieldRegistry');

/**
 * Apply projection filter to a MongoDB query
 * 
 * @param {Object} params - Parameters
 * @param {string} params.appKey - App key (e.g., 'CRM', 'AUDIT', 'PORTAL')
 * @param {string} params.moduleKey - Module key (e.g., 'people', 'organizations', 'events', 'forms')
 * @param {Object} params.baseQuery - Base MongoDB query object
 * @param {Object} params.projectionMeta - Optional projection metadata (if not provided, will be fetched)
 * @returns {Object} - Modified MongoDB query object with projection filters applied
 */
function applyProjectionFilter({ appKey, moduleKey, baseQuery = {}, projectionMeta = null }) {
  try {
    // SAFETY: Projection filtering is read-only.
    // SAFETY: No record ownership or permissions are enforced here.

    // If no appKey or moduleKey, return baseQuery unchanged
    if (!appKey || !moduleKey) {
      return baseQuery;
    }

    // Get projection metadata if not provided
    const projection = projectionMeta || getProjection(appKey, moduleKey);

    // If no projection metadata exists, return baseQuery unchanged
    if (!projection) {
      return baseQuery;
    }

    // Only apply projection if module is platform-owned primitive
    const isPlatformOwned = projection.platformOwned || isPlatformOwnedPrimitive(moduleKey);
    if (!isPlatformOwned) {
      return baseQuery;
    }

    // Get allowed types from projection
    const allowedTypes = projection.allowedTypes || [];

    // If allowedTypes is empty or null, return baseQuery unchanged
    if (!allowedTypes || allowedTypes.length === 0) {
      return baseQuery;
    }

    // Apply type filter: type must be IN allowedTypes
    // Note: The field name may vary by module (e.g., 'type' for People, 'eventType' for Events)
    // We'll use a generic approach that works for most modules
    
    // Determine the type field name based on module
    let typeField = 'type';
    let isArrayField = false; // Whether the type field is an array (e.g., organizations.types)
    let useParticipationsRole = false; // People: use participations.SALES.role
    if (moduleKey === 'events') {
      typeField = 'eventType';
    } else if (moduleKey === 'forms') {
      typeField = 'formType';
    } else if (moduleKey === 'organizations') {
      typeField = 'types'; // Organizations use 'types' array field
      isArrayField = true;
    } else if (moduleKey === 'people') {
      typeField = getPeopleFieldQueryPath('sales_type');
      useParticipationsRole = true;
    }

    // Map projection types to model values
    // Projection metadata uses uppercase (LEAD, CONTACT), but models use different cases
    const mapProjectionTypesToModelValues = (moduleKey, types) => {
      if (!types || types.length === 0) return types;
      
      const normalizedModuleKey = (moduleKey || '').toLowerCase();
      
      // People: Projection uses 'LEAD', 'CONTACT' -> Model uses 'Lead', 'Contact'
      if (normalizedModuleKey === 'people') {
        const typeMap = {
          'LEAD': 'Lead',
          'CONTACT': 'Contact',
          'PARTNER': 'Partner'
        };
        return types.map(t => typeMap[t?.toUpperCase()] || t).filter(Boolean);
      }
      
      // Forms: Projection uses 'SURVEY', 'AUDIT', 'FEEDBACK' -> Model uses 'Survey', 'Audit', 'Feedback'
      if (normalizedModuleKey === 'forms') {
        const typeMap = {
          'SURVEY': 'Survey',
          'AUDIT': 'Audit',
          'FEEDBACK': 'Feedback'
        };
        return types.map(t => typeMap[t?.toUpperCase()] || t).filter(Boolean);
      }
      
      // Events: Projection uses 'MEETING', 'INTERNAL_AUDIT', 'EXTERNAL_AUDIT_SINGLE', 'EXTERNAL_AUDIT_BEAT', 'FIELD_SALES_BEAT'
      // Model uses: 'Meeting', 'Internal Audit', 'External Audit — Single Org', 'External Audit Beat', 'Field Sales Beat'
      if (normalizedModuleKey === 'events') {
        const typeMap = {
          'MEETING': ['Meeting', 'Meeting / Appointment'],
          'INTERNAL_AUDIT': 'Internal Audit',
          'EXTERNAL_AUDIT_SINGLE': 'External Audit — Single Org',
          'EXTERNAL_AUDIT_BEAT': 'External Audit Beat',
          'FIELD_SALES_BEAT': 'Field Sales Beat',
          // Legacy mappings for backward compatibility
          'AUDIT': ['Internal Audit', 'External Audit — Single Org', 'External Audit Beat'],
          'INSPECTION': 'Field Sales Beat'
        };
        
        const modelEventTypes = [];
        types.forEach(t => {
          const normalizedType = (t || '').toUpperCase();
          const mapped = typeMap[normalizedType];
          if (Array.isArray(mapped)) {
            // Multiple model types for one projection type
            modelEventTypes.push(...mapped);
          } else if (mapped) {
            // Single model type
            modelEventTypes.push(mapped);
          }
        });
        
        // Return mapped types, or original types if no mapping found
        return modelEventTypes.length > 0 ? modelEventTypes : types;
      }
      
      // Organizations: Projection uses 'CUSTOMER', 'PARTNER', 'VENDOR'
      // Model uses 'types' array field with values: 'Customer', 'Partner', 'Vendor'
      if (normalizedModuleKey === 'organizations') {
        const typeMap = {
          'CUSTOMER': 'Customer',
          'PARTNER': 'Partner',
          'VENDOR': 'Vendor',
          'LEAD': 'Lead',
          'MARKETING_LEAD': 'Marketing Lead',
        };
        return types.map(t => typeMap[t?.toUpperCase()] || t).filter(Boolean);
      }
      
      // Tasks: Don't have a type field - return empty array to skip filtering
      if (normalizedModuleKey === 'tasks') {
        return []; // Tasks don't have type field, so return empty to skip type filtering
      }
      
      // Default: return types as-is
      return types;
    };

    // Map projection types to model values
    const modelAllowedTypes = mapProjectionTypesToModelValues(moduleKey, allowedTypes);

    // If mapping resulted in empty array (e.g., tasks don't have type field), skip type filtering
    if (!modelAllowedTypes || modelAllowedTypes.length === 0) {
      return baseQuery;
    }

    // Debug logging for projection filter
    if (moduleKey === 'people' || moduleKey === 'events' || moduleKey === 'forms' || moduleKey === 'organizations') {
      console.log('[appProjectionQuery] Mapping projection types to model values:', {
        moduleKey,
        appKey,
        projectionTypes: allowedTypes,
        modelTypes: modelAllowedTypes,
        typeField,
        isArrayField
      });
    }

    // Build projection filter
    // For array fields (like organizations.types), we need to check if array contains any of the allowed types
    // For simple type fields, we use $in
    let projectionFilter;
    if (isArrayField) {
      // For array fields: check if the array contains any of the allowed types
      // Also include documents where the array is empty or missing (backward compatibility)
      // MongoDB: For array fields, $in checks if any element in the array matches
      // We include empty arrays and missing fields for backward compatibility
      projectionFilter = {
        $or: [
          { [typeField]: { $in: modelAllowedTypes } }, // Array contains allowed type
          { [typeField]: { $exists: false } }, // Field doesn't exist
          { [typeField]: { $size: 0 } }, // Array is empty
          { [typeField]: { $eq: [] } } // Array is explicitly empty
        ]
      };
    } else {
      // For simple type fields: match if type is in allowed types
      // For backward compatibility, we should NOT restrict to only allowed types
      // Instead, we should only exclude types that are explicitly not allowed
      // Since we only have allowedTypes (not deniedTypes), we include all forms
      // The projection filtering is meant to be additive, not restrictive
      // 
      // However, if we want strict filtering, we can uncomment the strict version below
      // For now, let's be permissive for backward compatibility:
      // 
      // Strict version (uncomment to enforce strict filtering):
      // projectionFilter = {
      //   [typeField]: { $in: modelAllowedTypes }
      // };
      //
      // Permissive version (current - for backward compatibility):
      // Don't filter by type at all if we want to show all existing records
      // OR filter only if type exists AND is in allowed list, otherwise show all
      
      // For forms and events, we'll be more permissive - only filter if explicitly provided
      // For people, we're permissive to include people without participation (identity-only records)
      // Role is NOT required - participation is set via Attach-to-App, not during creation
      if (moduleKey === 'people' && useParticipationsRole) {
        // People: participations.SALES.role - include allowed roles OR no SALES participation (identity-only)
        projectionFilter = {
          $or: [
            { [typeField]: { $in: modelAllowedTypes } }, // Role is in allowed types
            { [typeField]: { $exists: false } }, // No SALES participation (identity-only)
            { [typeField]: null }, // Role is null (identity-only person)
            { [typeField]: '' } // Role is empty string (identity-only person)
          ]
        };
      } else {
        // Forms and Events: More permissive for backward compatibility
        // For backward compatibility, we should show all forms/events regardless of type
        // The projection filtering is mainly for NEW records (create-time)
        // For read-time, we're more lenient to avoid breaking existing data
        // 
        // Option 1: Show all (completely bypass projection for backward compat)
        // Option 2: Include common types that exist in the model but not in projection
        // 
        // For now, let's be lenient and include all forms/events
        // The projection will still apply at create-time via the resolver
        if (moduleKey === 'forms') {
          // For forms: Apply projection filter normally
          // The model has: 'Audit', 'Survey', 'Feedback', 'Inspection', 'Custom'
          // Projection metadata defines what types are allowed per app
          projectionFilter = {
            $or: [
              { [typeField]: { $in: modelAllowedTypes } }, // Type is in allowed types
              { [typeField]: { $exists: false } }, // Field doesn't exist (backward compat)
              { [typeField]: null } // Field is null (backward compat)
            ]
          };
        } else if (moduleKey === 'events') {
          // For events: Include all valid event types for backward compatibility
          // The model has specific enum values: 'Meeting', 'Internal Audit', etc.
          // Projection types map to these values correctly via the mapping function
          // Include all valid event types if mapping returned types, otherwise include all for backward compat
          const allValidEventTypes = [
            'Meeting',
            'Meeting / Appointment',
            'Internal Audit',
            'External Audit — Single Org',
            'External Audit Beat',
            'Field Sales Beat'
          ];
          
          // If we have mapped types, use them; otherwise include all valid types for backward compatibility
          const typesToMatch = modelAllowedTypes.length > 0 && modelAllowedTypes.some(t => allValidEventTypes.includes(t))
            ? modelAllowedTypes
            : allValidEventTypes;
          
          projectionFilter = {
            $or: [
              { [typeField]: { $in: typesToMatch } }, // Type is in allowed/mapped types or all valid types
              { [typeField]: { $exists: false } }, // Field doesn't exist
              { [typeField]: null } // Field is null
            ]
          };
        } else {
          // Default: include missing/null for backward compat
          projectionFilter = {
            $or: [
              { [typeField]: { $in: modelAllowedTypes } }, // Type is in allowed types
              { [typeField]: { $exists: false } }, // Field doesn't exist
              { [typeField]: null } // Field is null
            ]
          };
        }
      }
    }

    // Safely combine with existing query
    // If baseQuery already has a filter on the type field, we need to combine them
    if (baseQuery[typeField]) {
      // If baseQuery already filters by type, combine with $and to ensure both conditions are met
      const existingTypeFilter = baseQuery[typeField];
      
      // For array fields, projectionFilter uses $or structure, need special handling
      if (isArrayField) {
        // For array fields, existing filter might be a string (single type) or array
        // We need to add the existing filter condition to the $or
        if (Array.isArray(existingTypeFilter)) {
          // If existing is array, intersect with allowed types
          const intersection = existingTypeFilter.filter(t => modelAllowedTypes.includes(t));
          if (intersection.length === 0) {
            return { ...baseQuery, _id: { $in: [] } };
          }
          // Add intersection to $or
          projectionFilter.$or.push({ [typeField]: { $in: intersection } });
        } else if (typeof existingTypeFilter === 'string') {
          // If existing is string, check if allowed
          if (modelAllowedTypes.includes(existingTypeFilter)) {
            projectionFilter.$or.push({ [typeField]: existingTypeFilter });
          } else {
            return { ...baseQuery, _id: { $in: [] } };
          }
        } else if (typeof existingTypeFilter === 'object') {
          // Existing filter is an object (e.g., $eq, $ne, $in, etc.)
          // Use $and to combine both conditions
          const combinedQuery = {
            ...baseQuery,
            $and: [
              { [typeField]: existingTypeFilter },
              projectionFilter
            ]
          };
          delete combinedQuery[typeField];
          return combinedQuery;
        }
        // Remove the existing filter from baseQuery since we've incorporated it
        const { [typeField]: removed, ...restBaseQuery } = baseQuery;
        return { ...restBaseQuery, ...projectionFilter };
      } else {
        // For simple type fields (which now use $or structure for backward compatibility)
        // We need to merge the existing filter with the $or structure
        if (Array.isArray(existingTypeFilter)) {
          // If existing is array, intersect with allowed types
          const intersection = existingTypeFilter.filter(t => modelAllowedTypes.includes(t));
          if (intersection.length === 0) {
            // No overlap - return a query that matches nothing (unless missing/null is allowed)
            // Since we include missing/null in $or, we should still allow those
            // But if they explicitly filter by array that doesn't match, return nothing
            return { ...baseQuery, _id: { $in: [] } };
          }
          // Add intersection to $or
          projectionFilter.$or.push({ [typeField]: { $in: intersection } });
        } else if (typeof existingTypeFilter === 'string') {
          // If existing is string, check if allowed or in backward-compatible list
          if (modelAllowedTypes.includes(existingTypeFilter)) {
            // Add to $or (more specific than the generic $in)
            projectionFilter.$or.push({ [typeField]: existingTypeFilter });
          } else {
            // Not in allowed types - check if it's a valid type for backward compatibility
            // For forms, include 'Custom', 'Inspection', 'Audit', 'Feedback'
            // For events, include all valid event types
            const backwardCompatTypes = moduleKey === 'forms' 
              ? ['Custom', 'Inspection', 'Audit', 'Feedback']
              : moduleKey === 'events'
              ? ['Meeting', 'Meeting / Appointment', 'Internal Audit', 'External Audit — Single Org', 'External Audit Beat', 'Field Sales Beat']
              : [];
            
            if (backwardCompatTypes.includes(existingTypeFilter)) {
              // Include in $or for backward compatibility
              projectionFilter.$or.push({ [typeField]: existingTypeFilter });
            } else {
              // Not in allowed types and not in backward-compat list
              // Return nothing since explicit filter doesn't match
              return { ...baseQuery, _id: { $in: [] } };
            }
          }
        } else if (typeof existingTypeFilter === 'object') {
          // Existing filter is an object (e.g., $eq, $ne, $in, etc.)
          // Use $and to combine both conditions
          const combinedQuery = {
            ...baseQuery,
            $and: [
              { [typeField]: existingTypeFilter },
              projectionFilter
            ]
          };
          delete combinedQuery[typeField];
          return combinedQuery;
        }
        // Remove the existing filter from baseQuery since we've incorporated it into $or
        const { [typeField]: removed, ...restBaseQuery } = baseQuery;
        return { ...restBaseQuery, ...projectionFilter };
      }
    }

    // Check if baseQuery has $or from search or other filters (but not from typeField handling above)
    // If so, we need to combine it with projectionFilter using $and
    if (baseQuery.$or && !baseQuery[typeField]) {
      // baseQuery has $or (likely from search) but no typeField filter
      // Combine search $or with projection $or using $and
      if (baseQuery.$and && Array.isArray(baseQuery.$and)) {
        // If $and already exists, add search $or and projection filter to it
        const combinedQuery = {
          ...baseQuery,
          $and: [
            ...baseQuery.$and,
            { $or: baseQuery.$or },
            projectionFilter
          ]
        };
        delete combinedQuery.$or;
        return combinedQuery;
      } else {
        // Create new $and to combine search $or with projection filter
        const combinedQuery = {
          ...baseQuery,
          $and: [
            { $or: baseQuery.$or },
            projectionFilter
          ]
        };
        delete combinedQuery.$or;
        return combinedQuery;
      }
    }

    // Check if baseQuery already has $and (from previous combinations)
    // If so, add projectionFilter to the $and array
    if (baseQuery.$and && Array.isArray(baseQuery.$and)) {
      return {
        ...baseQuery,
        $and: [
          ...baseQuery.$and,
          projectionFilter
        ]
      };
    }

    // Apply projection filter to baseQuery
    const filteredQuery = {
      ...baseQuery,
      ...projectionFilter
    };

    return filteredQuery;
  } catch (error) {
    // SAFETY: Never throw - always return baseQuery unchanged on error
    console.error('[appProjectionQuery] Error applying projection filter:', error);
    console.error('[appProjectionQuery] Error stack:', error.stack);
    try {
      console.error('[appProjectionQuery] baseQuery:', JSON.stringify(baseQuery, null, 2));
      if (typeof projectionFilter !== 'undefined') {
        console.error('[appProjectionQuery] projectionFilter:', JSON.stringify(projectionFilter, null, 2));
      } else {
        console.error('[appProjectionQuery] projectionFilter: not defined yet');
      }
    } catch (logError) {
      console.error('[appProjectionQuery] Error logging debug info:', logError);
    }
    return baseQuery;
  }
}

module.exports = {
  applyProjectionFilter
};

