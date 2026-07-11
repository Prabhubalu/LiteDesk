/**
 * ============================================================================
 * PLATFORM CORE: Derived Status Service
 * ============================================================================
 * 
 * Service for computing and managing derived status from Configuration Registry.
 * 
 * Key Features:
 * - Computes derivedStatus when records are created or lifecycle/type fields change
 * - App-aware via appKey
 * - Non-blocking: leaves derivedStatus as null if computation fails
 * - Backward compatible: existing records remain valid
 * 
 * Usage:
 *   const { computeAndSetDerivedStatus } = require('./derivedStatusService');
 *   await computeAndSetDerivedStatus('people', record, 'SALES');
 * 
 * ============================================================================
 */

const {
  computeDerivedStatus,
  getEntityTypes,
  computeDealDerivedStatus,
  hasDealPipelineConfig
} = require('./configRegistry');

/**
 * Check if lifecycle or type fields have changed
 * 
 * @param {string} entity - Entity name ('people', 'organization', 'deal')
 * @param {Object} record - Record object
 * @param {Object} updateData - Update data (for updates)
 * @returns {boolean} - Whether lifecycle/type fields changed
 */
function hasLifecycleOrTypeChanged(entity, record, updateData = null) {
  if (!updateData) {
    // For new records, always compute
    return true;
  }
  
  if (entity === 'people') {
    // sales_type or lifecycle fields, or direct participations patch
    return updateData.sales_type !== undefined ||
           updateData.lead_status !== undefined ||
           updateData.contact_status !== undefined ||
           updateData.participations !== undefined;
  } else if (entity === 'organization') {
    return updateData.types !== undefined ||
           updateData.customerStatus !== undefined ||
           updateData.partnerStatus !== undefined ||
           updateData.vendorStatus !== undefined;
  } else if (entity === 'deal') {
    // Check if stage or pipeline changed
    return updateData.stage !== undefined ||
           updateData.pipeline !== undefined;
  }
  
  return false;
}

/**
 * Compute and set derived status for a record.
 * For deals, also computes and sets probability from pipeline + stage config.
 *
 * @param {string} entity - Entity name ('people', 'organization', 'deal')
 * @param {Object} record - Record object (Mongoose document or plain object)
 * @param {string} [appKey] - Optional app key
 * @returns {Promise<string|null>} - Computed derived status or null
 */
async function computeAndSetDerivedStatus(entity, record, appKey = null) {
  try {
    if (!record) return null;

    const recordData = record.toObject ? record.toObject() : record;

    if (entity === 'deal') {
      const res = await computeDealDerivedStatus(recordData, appKey);
      if (!res) return null;
      if (record.set && typeof record.set === 'function') {
        record.derivedStatus = res.derivedStatus;
        if (res.probability != null) record.probability = res.probability;
      } else if (typeof record === 'object' && record !== null) {
        record.derivedStatus = res.derivedStatus;
        if (res.probability != null) record.probability = res.probability;
      }
      return res.derivedStatus;
    }

    const derivedStatus = await computeDerivedStatus(entity, recordData, appKey);
    if (record.set && typeof record.set === 'function') {
      record.derivedStatus = derivedStatus;
    } else if (typeof record === 'object' && record !== null) {
      record.derivedStatus = derivedStatus;
    }
    return derivedStatus;
  } catch (error) {
    console.error(`[derivedStatusService] Error computing derived status for ${entity}:`, error);
    return null;
  }
}

/**
 * Observe status mismatch between status and derivedStatus
 * Returns warning information but does not block operations
 * 
 * @param {string} entity - Entity name
 * @param {Object} record - Record object
 * @returns {Object|null} - Warning object or null if no mismatch
 */
function observeStatusMismatch(entity, record) {
  try {
    if (!record) {
      return null;
    }
    
    // Get status field based on entity
    let statusValue = null;
    let statusField = null;
    
    if (entity === 'people') {
      // For People, use participations.SALES only
      const { getSalesParticipationValues } = require('../utils/getSalesParticipationValues');
      const sales = getSalesParticipationValues(record);
      if (sales.lead_status) {
        statusValue = sales.lead_status;
        statusField = 'lead_status';
      } else if (sales.contact_status) {
        statusValue = sales.contact_status;
        statusField = 'contact_status';
      }
    } else if (entity === 'organization') {
      // For Organization, check customerStatus, partnerStatus, or vendorStatus
      if (record.customerStatus) {
        statusValue = record.customerStatus;
        statusField = 'customerStatus';
      } else if (record.partnerStatus) {
        statusValue = record.partnerStatus;
        statusField = 'partnerStatus';
      } else if (record.vendorStatus) {
        statusValue = record.vendorStatus;
        statusField = 'vendorStatus';
      }
    } else if (entity === 'deal') {
      // For Deal, check status field
      if (record.status) {
        statusValue = record.status;
        statusField = 'status';
      }
    }
    
    // If no status field or no derivedStatus, no mismatch to observe
    if (!statusValue || !record.derivedStatus) {
      return null;
    }
    
    // Check if status and derivedStatus differ
    if (statusValue.toString() !== record.derivedStatus.toString()) {
      return {
        entity,
        recordId: record._id ? record._id.toString() : null,
        statusField,
        statusValue,
        derivedStatus: record.derivedStatus,
        mismatch: true,
        message: `Status mismatch detected: ${statusField}=${statusValue}, derivedStatus=${record.derivedStatus}`
      };
    }
    
    return null;
  } catch (error) {
    console.error(`[derivedStatusService] Error observing status mismatch for ${entity}:`, error);
    return null;
  }
}

/**
 * Check if configuration exists for an entity.
 * For deals, uses pipeline config (hasDealPipelineConfig); for others, entity types.
 *
 * @param {string} entity - Entity name ('people', 'organization', 'deal')
 * @param {string} [appKey] - Optional app key
 * @returns {Promise<boolean>} - Whether config exists
 */
async function hasConfiguration(entity, appKey = null) {
  try {
    if (entity === 'deal') {
      return await hasDealPipelineConfig(appKey);
    }
    const entityTypes = await getEntityTypes(entity, appKey);
    return entityTypes.length > 0;
  } catch (error) {
    console.error(`[derivedStatusService] Error checking configuration for ${entity}:`, error);
    return false;
  }
}

/**
 * Validate status write protection
 * If config exists, disallow direct writes to status fields
 * Allow lifecycle changes (type, lead_status, contact_status, types, stage, pipeline)
 * 
 * @param {string} entity - Entity name ('people', 'organization', 'deal')
 * @param {Object} updateData - Update data
 * @param {string} [appKey] - Optional app key
 * @returns {Promise<Object|null>} - Error object if violation, null if allowed
 */
async function validateStatusWriteProtection(entity, updateData, appKey = null) {
  try {
    const statusFields = [];

    // Deals: Status is always platform-owned (derived from Stage). Block all direct writes
    // regardless of pipeline config. Migrations/maintenance scripts bypass this API path.
    if (entity === 'deal') {
      if (updateData.status !== undefined) statusFields.push('status');
      if (updateData.probability !== undefined) statusFields.push('probability');
      if (statusFields.length > 0) {
        return {
          valid: false,
          code: 'STATUS_WRITE_PROTECTED',
          message: `Deal Status/probability are platform-owned and derived from Stage. Cannot directly write to: ${statusFields.join(', ')}. Change Stage (or Pipeline) instead. Use lostReason for loss nuance.`,
          errors: [{
            blockedFields: statusFields,
            reason: 'Deal Status is a platform-owned derived field; only stage derivation or maintenance scripts may set it'
          }]
        };
      }
      return null;
    }

    // People / Organization: protect only when config exists (existing behavior)
    const configExists = await hasConfiguration(entity, appKey);
    if (!configExists) {
      return null;
    }

    if (entity === 'people') {
      if (updateData.lead_status !== undefined) {
        statusFields.push('lead_status');
      }
      if (updateData.contact_status !== undefined) {
        statusFields.push('contact_status');
      }
    } else if (entity === 'organization') {
      if (updateData.customerStatus !== undefined) {
        statusFields.push('customerStatus');
      }
      if (updateData.partnerStatus !== undefined) {
        statusFields.push('partnerStatus');
      }
      if (updateData.vendorStatus !== undefined) {
        statusFields.push('vendorStatus');
      }
    }

    if (statusFields.length > 0) {
      return {
        valid: false,
        code: 'STATUS_WRITE_PROTECTED',
        message: `Status fields are system-owned when configuration exists. Cannot directly write to: ${statusFields.join(', ')}. Update lifecycle fields instead.`,
        errors: [{
          blockedFields: statusFields,
          reason: 'Status fields are system-owned when configuration exists'
        }]
      };
    }

    return null;
  } catch (error) {
    console.error(`[derivedStatusService] Error validating status write protection for ${entity}:`, error);
    // On error, allow write (backward compatible) except we already handled deal above
    return null;
  }
}

module.exports = {
  hasLifecycleOrTypeChanged,
  computeAndSetDerivedStatus,
  observeStatusMismatch,
  hasConfiguration,
  validateStatusWriteProtection
};
