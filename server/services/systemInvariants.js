/**
 * ============================================================================
 * PLATFORM CORE: System Invariants Service
 * ============================================================================
 * 
 * This service enforces non-negotiable data integrity rules across the platform.
 * 
 * Key Features:
 * - App-agnostic and reusable across Sales and future apps
 * - Declarative and composable invariant definitions
 * - Machine-readable errors (code + message)
 * - No UI logic - validation + enforcement only
 * - No hardcoded Sales-specific values
 * 
 * Invariants:
 * 1. Deletion: Prevent hard delete if referenced by another active record
 * 2. Relationship: Prevent unlink if active records reference both entities
 * 3. Type: Organization Types are additive only (no removal/replacement)
 * 4. Role: Partner Contact must always be the same People entity
 * 
 * Usage:
 *   const { validateDelete, validateUnlink, validateTypeMutation } = require('./systemInvariants');
 *   const result = await validateDelete({ moduleKey: 'people', recordId: '...', organizationId: '...' });
 *   if (!result.valid) {
 *     return res.status(400).json({ success: false, code: result.code, message: result.message, errors: result.errors });
 *   }
 * 
 * ============================================================================
 */

const mongoose = require('mongoose');
const People = require('../models/People');
const Organization = require('../models/Organization');
const Deal = require('../models/Deal');
const { observeStatusMismatch: observeRecordStatusMismatch, hasConfiguration } = require('./derivedStatusService');
const {
  hasDealPipelineConfig,
  findPipelineByKeyOrLabel,
  isStageInPipeline
} = require('./configRegistry');

/**
 * @typedef {Object} InvariantContext
 * @property {string} moduleKey - Module key ('people', 'organizations', 'deals')
 * @property {string|ObjectId} recordId - Record ID
 * @property {string|ObjectId} organizationId - Organization ID (tenant context)
 * @property {Object} [updateData] - Update data (for unlink/type mutations)
 */

/**
 * @typedef {Object} InvariantResult
 * @property {boolean} valid - Whether the operation is allowed
 * @property {string} code - Machine-readable error code
 * @property {string} message - User-safe error message
 * @property {Array<Object>} [errors] - Detailed error information
 */

/**
 * Check if a record is referenced by active records
 * @param {string} moduleKey - Source module key
 * @param {string|ObjectId} recordId - Source record ID
 * @param {string|ObjectId} organizationId - Organization ID
 * @returns {Promise<Array<Object>>} - Array of referencing records
 */
async function findActiveReferences(moduleKey, recordId, organizationId) {
  const references = [];
  
  if (moduleKey === 'people') {
    // Check if Person is referenced by active Deals
    const activeDeals = await Deal.find({
      organizationId,
      contactId: recordId,
      status: 'Open',
      deletedAt: null
    }).select('_id name status').lean();
    
    if (activeDeals.length > 0) {
      references.push({
        moduleKey: 'deals',
        records: activeDeals,
        relationship: 'contactId'
      });
    }
    
    // Check if Person is referenced by Organizations as primaryContact
    // Note: Sales organizations don't have organizationId, so we can't filter by tenant directly
    // However, we check if any Sales organization has this person as primaryContact
    const orgsWithContact = await Organization.find({
      primaryContact: recordId,
      isTenant: false,
      deletedAt: null
    }).select('_id name').lean();
    
    if (orgsWithContact.length > 0) {
      references.push({
        moduleKey: 'organizations',
        records: orgsWithContact,
        relationship: 'primaryContact'
      });
    }
  } else if (moduleKey === 'organizations') {
    // Check if Organization is referenced by active Deals
    // Note: Sales organizations don't have organizationId, so we filter by tenant organizationId on Deals
    const activeDeals = await Deal.find({
      organizationId,
      accountId: recordId,
      status: 'Open',
      deletedAt: null
    }).select('_id name status').lean();
    
    if (activeDeals.length > 0) {
      references.push({
        moduleKey: 'deals',
        records: activeDeals,
        relationship: 'accountId'
      });
    }
    
    // Check if Organization is referenced by People
    // Note: People.organizationId is the tenant organization, People.organization is the Sales organization
    const peopleWithOrg = await People.find({
      organizationId,
      organization: recordId,
      deletedAt: null
    }).select('_id first_name last_name email').lean();
    
    if (peopleWithOrg.length > 0) {
      references.push({
        moduleKey: 'people',
        records: peopleWithOrg,
        relationship: 'organization'
      });
    }
    
    // Check if Organization is referenced as primaryContact by other Organizations
    // (This is less common but should be checked)
    const orgsWithContact = await Organization.find({
      primaryContact: recordId,
      isTenant: false,
      _id: { $ne: recordId },
      deletedAt: null
    }).select('_id name').lean();
    
    if (orgsWithContact.length > 0) {
      references.push({
        moduleKey: 'organizations',
        records: orgsWithContact,
        relationship: 'primaryContact'
      });
    }
  } else if (moduleKey === 'deals') {
    // Deals can be deleted if not referenced by other active records
    // (Future: Add checks for Tasks, Events, etc. if they reference deals)
  }
  
  return references;
}

function castObjectIdList(ids) {
  const out = [];
  for (const id of ids || []) {
    const s = String(id).trim();
    if (!mongoose.Types.ObjectId.isValid(s)) continue;
    out.push(new mongoose.Types.ObjectId(s));
  }
  return out;
}

function formatReferenceRecordNames(records) {
  return records.map((r) => {
    if (r.name) return r.name;
    if (r.first_name || r.last_name) {
      return `${r.first_name || ''} ${r.last_name || ''}`.trim();
    }
    if (r.email) return r.email;
    return r._id.toString();
  }).join(', ');
}

function buildDeleteBlockedEntry(moduleKey, referenceGroups) {
  const errors = referenceGroups.map((ref) => ({
    moduleKey: ref.moduleKey,
    relationship: ref.relationship,
    count: ref.records.length,
    recordIds: ref.records.map((r) => r._id.toString()),
    recordNames: formatReferenceRecordNames(ref.records)
  }));

  let message = `Cannot delete this ${moduleKey} record because it is referenced by active records:`;
  for (const err of errors) {
    message += `\n- ${err.count} active ${err.moduleKey === 'deals' ? 'deal' : err.moduleKey} record${err.count > 1 ? 's' : ''} (${err.recordNames})`;
  }

  return { errors, message };
}

/**
 * Batch variant of findActiveReferences for bulk delete (constant query count per module).
 *
 * @returns {Promise<Map<string, { errors: Array, message: string }>>}
 */
async function findActiveReferencesBulk(moduleKey, recordIds, organizationId) {
  const blocked = new Map();
  const objectIds = castObjectIdList(recordIds);
  if (!objectIds.length) return blocked;

  const addReferenceGroup = (recordId, ref) => {
    const key = String(recordId);
    if (!blocked.has(key)) {
      blocked.set(key, { referenceGroups: [] });
    }
    blocked.get(key).referenceGroups.push(ref);
  };

  if (moduleKey === 'people') {
    const activeDeals = await Deal.find({
      organizationId,
      contactId: { $in: objectIds },
      status: 'Open',
      deletedAt: null
    }).select('_id name status contactId').lean();

    const dealsByContact = new Map();
    for (const deal of activeDeals) {
      const contactId = String(deal.contactId);
      if (!dealsByContact.has(contactId)) dealsByContact.set(contactId, []);
      dealsByContact.get(contactId).push(deal);
    }
    for (const [contactId, records] of dealsByContact) {
      addReferenceGroup(contactId, { moduleKey: 'deals', records, relationship: 'contactId' });
    }

    const orgsWithContact = await Organization.find({
      primaryContact: { $in: objectIds },
      isTenant: false,
      deletedAt: null
    }).select('_id name primaryContact').lean();

    const orgsByContact = new Map();
    for (const org of orgsWithContact) {
      const contactId = String(org.primaryContact);
      if (!orgsByContact.has(contactId)) orgsByContact.set(contactId, []);
      orgsByContact.get(contactId).push(org);
    }
    for (const [contactId, records] of orgsByContact) {
      addReferenceGroup(contactId, { moduleKey: 'organizations', records, relationship: 'primaryContact' });
    }
  } else if (moduleKey === 'organizations') {
    const activeDeals = await Deal.find({
      organizationId,
      accountId: { $in: objectIds },
      status: 'Open',
      deletedAt: null
    }).select('_id name status accountId').lean();

    const dealsByAccount = new Map();
    for (const deal of activeDeals) {
      const accountId = String(deal.accountId);
      if (!dealsByAccount.has(accountId)) dealsByAccount.set(accountId, []);
      dealsByAccount.get(accountId).push(deal);
    }
    for (const [accountId, records] of dealsByAccount) {
      addReferenceGroup(accountId, { moduleKey: 'deals', records, relationship: 'accountId' });
    }

    const peopleWithOrg = await People.find({
      organizationId,
      organization: { $in: objectIds },
      deletedAt: null
    }).select('_id first_name last_name email organization').lean();

    const peopleByOrg = new Map();
    for (const person of peopleWithOrg) {
      const orgId = String(person.organization);
      if (!peopleByOrg.has(orgId)) peopleByOrg.set(orgId, []);
      peopleByOrg.get(orgId).push(person);
    }
    for (const [orgId, records] of peopleByOrg) {
      addReferenceGroup(orgId, { moduleKey: 'people', records, relationship: 'organization' });
    }

    const orgsWithContact = await Organization.find({
      primaryContact: { $in: objectIds },
      isTenant: false,
      _id: { $nin: objectIds },
      deletedAt: null
    }).select('_id name primaryContact').lean();

    const orgsByPrimaryContact = new Map();
    for (const org of orgsWithContact) {
      const contactId = String(org.primaryContact);
      if (!orgsByPrimaryContact.has(contactId)) orgsByPrimaryContact.set(contactId, []);
      orgsByPrimaryContact.get(contactId).push(org);
    }
    for (const [contactId, records] of orgsByPrimaryContact) {
      addReferenceGroup(contactId, { moduleKey: 'organizations', records, relationship: 'primaryContact' });
    }
  }

  const result = new Map();
  for (const [recordId, { referenceGroups }] of blocked) {
    result.set(recordId, buildDeleteBlockedEntry(moduleKey, referenceGroups));
  }
  return result;
}

/**
 * Observe status mismatch (read-only, non-blocking)
 * Logs warnings but does not block operations
 * 
 * @param {InvariantContext} context - Invariant context
 * @returns {Promise<Object|null>} - Warning object or null
 */
async function observeStatusMismatch(context) {
  const { moduleKey, recordId, organizationId } = context;
  
  try {
    // Fetch the record to check for status mismatch
    let record = null;
    
    if (moduleKey === 'people') {
      record = await People.findOne({ _id: recordId, organizationId }).lean();
    } else if (moduleKey === 'organizations') {
      record = await Organization.findOne({ _id: recordId, organizationId }).lean();
    } else if (moduleKey === 'deals') {
      record = await Deal.findOne({ _id: recordId, organizationId }).lean();
    }
    
    if (!record) {
      return null;
    }
    
    // Map moduleKey to entity name for observeRecordStatusMismatch
    const entityName = moduleKey === 'deals' ? 'deal' : 
                      moduleKey === 'organizations' ? 'organization' : 
                      moduleKey;
    
    // Use derivedStatusService to observe mismatch
    const warning = observeRecordStatusMismatch(entityName, record);
    
    if (warning) {
      // Log warning but don't block
      console.warn(`[systemInvariants] Status mismatch observed:`, warning);
    }
    
    return warning;
  } catch (error) {
    console.error(`[systemInvariants] Error observing status mismatch for ${moduleKey}:${recordId}:`, error);
    return null;
  }
}

/**
 * Enforce status === derivedStatus invariant (fail-closed)
 * Blocks updates when status !== derivedStatus if config exists
 * 
 * @param {InvariantContext} context - Invariant context
 * @param {Object} updateData - Update data
 * @returns {Promise<InvariantResult>} - Validation result
 */
async function validateStatusInvariant(context) {
  const { moduleKey, recordId, organizationId, updateData } = context;
  
  try {
    // Fetch the record
    let record = null;
    
    if (moduleKey === 'people') {
      record = await People.findOne({ _id: recordId, organizationId }).lean();
    } else if (moduleKey === 'organizations') {
      record = await Organization.findOne({ _id: recordId, organizationId }).lean();
    } else if (moduleKey === 'deals') {
      record = await Deal.findOne({ _id: recordId, organizationId }).lean();
    }
    
    if (!record) {
      // Record not found - allow operation (will fail elsewhere)
      return {
        valid: true,
        code: 'STATUS_INVARIANT_SKIPPED',
        message: 'Record not found, status invariant skipped'
      };
    }
    
    // Check if config exists
    // Map moduleKey to entity name (deals -> deal, organizations -> organization)
    const entityName = moduleKey === 'deals' ? 'deal' : 
                      moduleKey === 'organizations' ? 'organization' : 
                      moduleKey;
    const appKey = context.appKey || null;
    const configExists = await hasConfiguration(entityName, appKey);
    
    if (!configExists) {
      // No config exists - allow existing behavior (backward compatible)
      return {
        valid: true,
        code: 'STATUS_INVARIANT_SKIPPED',
        message: 'No configuration exists, status invariant skipped (backward compatible)'
      };
    }
    
    // Config exists - enforce status === derivedStatus
    // Get current status field value
    let statusValue = null;
    let statusField = null;
    
    if (moduleKey === 'people') {
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
    } else if (moduleKey === 'organizations') {
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
    } else if (moduleKey === 'deals') {
      // For Deal, check status field
      if (record.status) {
        statusValue = record.status;
        statusField = 'status';
      }
    }
    
    // If no status field or no derivedStatus, allow (might be initial state)
    if (!statusValue || !record.derivedStatus) {
      return {
        valid: true,
        code: 'STATUS_INVARIANT_ALLOWED',
        message: 'Status or derivedStatus not set, invariant allowed'
      };
    }
    
    // Check if status and derivedStatus differ
    if (statusValue.toString() !== record.derivedStatus.toString()) {
      return {
        valid: false,
        code: 'STATUS_INVARIANT_VIOLATION',
        message: `Status invariant violation: ${statusField}=${statusValue} does not match derivedStatus=${record.derivedStatus}. Status must match derivedStatus when configuration exists.`,
        errors: [{
          statusField,
          statusValue,
          derivedStatus: record.derivedStatus,
          reason: 'Status must match derivedStatus when configuration exists'
        }]
      };
    }
    
    return {
      valid: true,
      code: 'STATUS_INVARIANT_SATISFIED',
      message: 'Status invariant satisfied'
    };
  } catch (error) {
    console.error(`[systemInvariants] Error validating status invariant for ${moduleKey}:${recordId}:`, error);
    // On error, fail-closed: block operation
    return {
      valid: false,
      code: 'STATUS_INVARIANT_ERROR',
      message: 'Error validating status invariant, operation blocked',
      errors: [{ reason: error.message }]
    };
  }
}

/**
 * Validate stage-in-pipeline invariant for deals.
 * When deal pipeline config exists: stage must belong to the selected pipeline.
 *
 * @param {InvariantContext} context - { moduleKey, recordId?, organizationId, updateData?, appKey? }
 * @returns {Promise<InvariantResult>}
 */
async function validateStageInPipeline(context) {
  const { moduleKey, recordId, organizationId, updateData, appKey } = context;
  try {
    if (moduleKey !== 'deals') {
      return { valid: true, code: 'STAGE_PIPELINE_SKIPPED', message: 'Not a deal, skipped' };
    }

    const configExists = await hasDealPipelineConfig(appKey || null);
    if (!configExists) {
      return { valid: true, code: 'STAGE_PIPELINE_LEGACY', message: 'No pipeline config, legacy allowed' };
    }

    let pipeline = null;
    let stage = null;

    if (recordId && updateData) {
      const existing = await Deal.findOne({ _id: recordId, organizationId })
        .select('pipeline stage')
        .lean();
      pipeline = updateData.pipeline !== undefined ? updateData.pipeline : (existing && existing.pipeline);
      stage = updateData.stage !== undefined ? updateData.stage : (existing && existing.stage);
    } else if (updateData) {
      pipeline = updateData.pipeline;
      stage = updateData.stage;
    }

    if (!pipeline || !stage) {
      return { valid: true, code: 'STAGE_PIPELINE_ALLOWED', message: 'Pipeline or stage not provided, validated elsewhere' };
    }

    const pipelineConfig = await findPipelineByKeyOrLabel(pipeline, appKey || null);
    if (!pipelineConfig) {
      return { valid: true, code: 'STAGE_PIPELINE_LEGACY', message: 'Pipeline not in config, legacy allowed' };
    }

    const belongs = await isStageInPipeline(pipelineConfig.key, stage, appKey || null);
    if (!belongs) {
      return {
        valid: false,
        code: 'STAGE_NOT_IN_PIPELINE',
        message: `Stage "${stage}" does not belong to pipeline "${pipelineConfig.label || pipelineConfig.key}". When config exists, stage must be one of the pipeline's configured stages.`,
        errors: [{ pipeline: pipelineConfig.key, stage, reason: 'Stage must belong to selected pipeline' }]
      };
    }

    return { valid: true, code: 'STAGE_PIPELINE_SATISFIED', message: 'Stage belongs to pipeline' };
  } catch (error) {
    console.error('[systemInvariants] Error validating stage-in-pipeline:', error);
    return {
      valid: false,
      code: 'STAGE_PIPELINE_ERROR',
      message: 'Error validating stage-in-pipeline, operation blocked',
      errors: [{ reason: error.message }]
    };
  }
}

/**
 * Validate deletion invariant
 * Prevents hard delete if record is referenced by another active record
 *
 * @param {InvariantContext} context - Invariant context
 * @returns {Promise<InvariantResult>} - Validation result
 */
async function validateDelete(context) {
  const { moduleKey, recordId, organizationId } = context;
  
  try {
    // Observe status mismatch (read-only, non-blocking)
    await observeStatusMismatch(context);

    if (moduleKey === 'people') {
      const person = await People.findOne({ _id: recordId, organizationId })
        .select('portalAccess')
        .lean();
      if (person?.portalAccess?.enabled === true) {
        return {
          valid: false,
          code: 'DELETE_BLOCKED_BY_PORTAL_ACCESS',
          message: 'Cannot delete this person while portal access is enabled. Disable portal access first.',
          errors: [{
            moduleKey: 'portal',
            relationship: 'portalAccess',
            count: 1,
            recordIds: [String(recordId)],
            recordNames: 'Portal access enabled'
          }]
        };
      }
    }
    
    const references = await findActiveReferences(moduleKey, recordId, organizationId);
    
    if (references.length === 0) {
      return {
        valid: true,
        code: 'DELETE_ALLOWED',
        message: 'Deletion allowed'
      };
    }
    
    // Build detailed error information
    const errors = [];
    let errorMessage = `Cannot delete this ${moduleKey} record because it is referenced by active records:`;
    
    for (const ref of references) {
      const recordNames = ref.records.map(r => {
        if (r.name) return r.name;
        if (r.first_name || r.last_name) return `${r.first_name || ''} ${r.last_name || ''}`.trim();
        if (r.email) return r.email;
        return r._id.toString();
      }).join(', ');
      
      errors.push({
        moduleKey: ref.moduleKey,
        relationship: ref.relationship,
        count: ref.records.length,
        recordIds: ref.records.map(r => r._id.toString()),
        recordNames: recordNames
      });
      
      errorMessage += `\n- ${ref.records.length} active ${ref.moduleKey === 'deals' ? 'deal' : ref.moduleKey} record${ref.records.length > 1 ? 's' : ''} (${recordNames})`;
    }
    
    return {
      valid: false,
      code: 'DELETE_BLOCKED_BY_REFERENCES',
      message: errorMessage,
      errors
    };
  } catch (error) {
    console.error(`[systemInvariants] Error validating delete for ${moduleKey}:${recordId}:`, error);
    // On error, allow deletion to avoid blocking operations (fail-open)
    return {
      valid: true,
      code: 'DELETE_VALIDATION_ERROR',
      message: 'Deletion validation encountered an error, but operation is allowed'
    };
  }
}

/**
 * Validate unlink invariant
 * Prevents unlinking a Person from an Organization if any active Deals reference both
 * 
 * @param {InvariantContext} context - Invariant context
 * @returns {Promise<InvariantResult>} - Validation result
 */
async function validateUnlink(context) {
  const { moduleKey, recordId, organizationId, updateData } = context;
  
  try {
    // Only validate Person-Organization unlinks
    if (moduleKey !== 'people' || !updateData || updateData.organization === null || updateData.organization === undefined) {
      return {
        valid: true,
        code: 'UNLINK_ALLOWED',
        message: 'Unlink allowed'
      };
    }
    
    // Get current Person record to check current organization
    const person = await People.findOne({
      _id: recordId,
      organizationId
    }).select('organization').lean();
    
    if (!person || !person.organization) {
      // Person is not linked to an organization, unlink is allowed
      return {
        valid: true,
        code: 'UNLINK_ALLOWED',
        message: 'Unlink allowed'
      };
    }
    
    const currentOrgId = person.organization;
    
    // Check if any active Deals reference both this Person and Organization
    const activeDeals = await Deal.find({
      organizationId,
      contactId: recordId,
      accountId: currentOrgId,
      status: 'Open'
    }).select('_id name status').lean();
    
    if (activeDeals.length === 0) {
      return {
        valid: true,
        code: 'UNLINK_ALLOWED',
        message: 'Unlink allowed'
      };
    }
    
    // Build error message
    const dealNames = activeDeals.map(d => d.name || d._id.toString()).join(', ');
    const errorMessage = `Cannot unlink this person from the organization because ${activeDeals.length} active deal${activeDeals.length > 1 ? 's' : ''} reference both: ${dealNames}`;
    
    return {
      valid: false,
      code: 'UNLINK_BLOCKED_BY_ACTIVE_DEALS',
      message: errorMessage,
      errors: [{
        moduleKey: 'deals',
        count: activeDeals.length,
        recordIds: activeDeals.map(d => d._id.toString()),
        recordNames: dealNames
      }]
    };
  } catch (error) {
    console.error(`[systemInvariants] Error validating unlink for ${moduleKey}:${recordId}:`, error);
    // On error, allow unlink to avoid blocking operations (fail-open)
    return {
      valid: true,
      code: 'UNLINK_VALIDATION_ERROR',
      message: 'Unlink validation encountered an error, but operation is allowed'
    };
  }
}

/**
 * Validate type mutation invariant
 * Organization Types are additive only - disallow removal or replacement
 * 
 * @param {InvariantContext} context - Invariant context
 * @returns {Promise<InvariantResult>} - Validation result
 */
async function validateTypeMutation(context) {
  const { moduleKey, recordId, organizationId, updateData } = context;
  
  try {
    // Only validate Organization type mutations
    if (moduleKey !== 'organizations' || !updateData || !updateData.types || !Array.isArray(updateData.types)) {
      return {
        valid: true,
        code: 'TYPE_MUTATION_ALLOWED',
        message: 'Type mutation allowed'
      };
    }
    
    // Get current Organization record
    const org = await Organization.findOne({
      _id: recordId,
      organizationId,
      isTenant: false
    }).select('types').lean();
    
    if (!org) {
      return {
        valid: true,
        code: 'TYPE_MUTATION_ALLOWED',
        message: 'Type mutation allowed (organization not found)'
      };
    }
    
    const currentTypes = (org.types || []).sort();
    const newTypes = updateData.types.sort();
    
    // Check if any current types are being removed
    const removedTypes = currentTypes.filter(t => !newTypes.includes(t));
    
    if (removedTypes.length > 0) {
      return {
        valid: false,
        code: 'TYPE_REMOVAL_NOT_ALLOWED',
        message: `Cannot remove organization types once they are set. Attempted to remove: ${removedTypes.join(', ')}`,
        errors: [{
          removedTypes,
          currentTypes,
          newTypes
        }]
      };
    }
    
    // Types are additive only - new types can be added, but existing ones cannot be removed
    return {
      valid: true,
      code: 'TYPE_MUTATION_ALLOWED',
      message: 'Type mutation allowed (additive only)'
    };
  } catch (error) {
    console.error(`[systemInvariants] Error validating type mutation for ${moduleKey}:${recordId}:`, error);
    // On error, allow mutation to avoid blocking operations (fail-open)
    return {
      valid: true,
      code: 'TYPE_MUTATION_VALIDATION_ERROR',
      message: 'Type mutation validation encountered an error, but operation is allowed'
    };
  }
}

/**
 * Validate role invariant
 * Partner Contact must always be the same People entity (no duplicate People creation)
 * This is enforced via validation, not UI assumptions
 * 
 * @param {InvariantContext} context - Invariant context
 * @returns {Promise<InvariantResult>} - Validation result
 */
async function validateRoleInvariant(context) {
  const { moduleKey, recordId, organizationId, updateData } = context;
  
  try {
    // This invariant applies when:
    // 1. Creating/updating a Person that will be set as Partner Contact
    // 2. Updating an Organization to set a Partner Contact
    
    // For now, we'll validate when updating Organizations to set primaryContact
    // and ensure the same Person is used if Partner type is involved
    if (moduleKey === 'organizations' && updateData && updateData.primaryContact) {
      const org = await Organization.findOne({
        _id: recordId,
        organizationId,
        isTenant: false
      }).select('types primaryContact').lean();
      
      if (!org) {
        return {
          valid: true,
          code: 'ROLE_INVARIANT_ALLOWED',
          message: 'Role invariant allowed (organization not found)'
        };
      }
      
      // Check if organization has Partner type
      const hasPartnerType = (org.types || []).includes('Partner');
      const newTypes = updateData.types || org.types || [];
      const willHavePartnerType = Array.isArray(newTypes) && newTypes.includes('Partner');
      
      if (hasPartnerType || willHavePartnerType) {
        // If there's already a primaryContact and it's different, check if it's the same person
        if (org.primaryContact && org.primaryContact.toString() !== updateData.primaryContact.toString()) {
          // Get the existing contact
          const existingContact = await People.findOne({
            _id: org.primaryContact,
            organizationId
          }).select('_id first_name last_name email').lean();
          
          if (existingContact) {
            // Check if the new contact is actually the same person (by email or name)
            const newContact = await People.findOne({
              _id: updateData.primaryContact,
              organizationId
            }).select('_id first_name last_name email').lean();
            
            if (newContact && existingContact.email && newContact.email && 
                existingContact.email.toLowerCase() === newContact.email.toLowerCase()) {
              // Same person, different record - this violates the invariant
              return {
                valid: false,
                code: 'PARTNER_CONTACT_DUPLICATE',
                message: `Partner Contact must always be the same People entity. A different record exists for the same person (${existingContact.email}).`,
                errors: [{
                  existingContactId: existingContact._id.toString(),
                  newContactId: newContact._id.toString(),
                  email: existingContact.email
                }]
              };
            }
          }
        }
      }
    }
    
    // For People creation/update, we could check if they're being set as Partner Contact
    // and ensure no duplicate exists, but this is more complex and may not be needed
    // if the UI prevents duplicate creation
    
    return {
      valid: true,
      code: 'ROLE_INVARIANT_ALLOWED',
      message: 'Role invariant allowed'
    };
  } catch (error) {
    console.error(`[systemInvariants] Error validating role invariant for ${moduleKey}:${recordId}:`, error);
    // On error, allow operation to avoid blocking (fail-open)
    return {
      valid: true,
      code: 'ROLE_INVARIANT_VALIDATION_ERROR',
      message: 'Role invariant validation encountered an error, but operation is allowed'
    };
  }
}

/**
 * Validate deal relationship invariants
 * Enforces:
 * 1. Only one primary contact per Deal (isPrimary = true in dealPeople)
 * 2. Only one primary customer organization per Deal (isPrimary = true in dealOrganizations)
 * 3. A Deal must have at least one active customer organization
 * 
 * Only enforced when relationship arrays are present (backward compatible)
 * 
 * @param {InvariantContext} context - { moduleKey, recordId?, organizationId, updateData?, appKey? }
 * @returns {Promise<InvariantResult>}
 */
async function validateDealRelationships(context) {
  const { moduleKey, recordId, organizationId, updateData } = context;
  
  try {
    if (moduleKey !== 'deals') {
      return {
        valid: true,
        code: 'DEAL_RELATIONSHIPS_SKIPPED',
        message: 'Not a deal, skipped'
      };
    }

    let deal = null;
    let effectiveData = updateData || {};

    if (recordId) {
      deal = await Deal.findOne({ _id: recordId, organizationId }).lean();
      if (!deal) {
        return {
          valid: true,
          code: 'DEAL_RELATIONSHIPS_SKIPPED',
          message: 'Deal not found, skipped'
        };
      }
      effectiveData = { ...deal, ...updateData };
    }

    const dealPeople = effectiveData.dealPeople || [];
    const dealOrganizations = effectiveData.dealOrganizations || [];

    if (!Array.isArray(dealPeople) && !Array.isArray(dealOrganizations)) {
      return {
        valid: true,
        code: 'DEAL_RELATIONSHIPS_LEGACY',
        message: 'No role-based relationships present, legacy mode allowed'
      };
    }

    const errors = [];

    if (Array.isArray(dealPeople) && dealPeople.length > 0) {
      const primaryContacts = dealPeople.filter((p) => p.isPrimary && p.isActive);
      if (primaryContacts.length > 1) {
        errors.push({
          field: 'dealPeople',
          reason: 'Only one primary contact allowed per Deal',
          primaryContacts: primaryContacts.map((p) => ({
            personId: p.personId?.toString(),
            role: p.role
          }))
        });
      }
    }

    if (Array.isArray(dealOrganizations) && dealOrganizations.length > 0) {
      const primaryCustomers = dealOrganizations.filter(
        (o) => o.isPrimary && o.isActive && o.role === 'customer'
      );
      if (primaryCustomers.length > 1) {
        errors.push({
          field: 'dealOrganizations',
          reason: 'Only one primary customer organization allowed per Deal',
          primaryCustomers: primaryCustomers.map((o) => ({
            organizationId: o.organizationId?.toString(),
            role: o.role
          }))
        });
      }

      const activeCustomers = dealOrganizations.filter(
        (o) => o.isActive && o.role === 'customer'
      );
      if (activeCustomers.length === 0) {
        errors.push({
          field: 'dealOrganizations',
          reason: 'Deal must have at least one active customer organization',
          activeCustomers: 0
        });
      }
    }

    if (errors.length > 0) {
      return {
        valid: false,
        code: 'DEAL_RELATIONSHIPS_VIOLATION',
        message: `Deal relationship invariants violated: ${errors.map((e) => e.reason).join('; ')}`,
        errors
      };
    }

    return {
      valid: true,
      code: 'DEAL_RELATIONSHIPS_SATISFIED',
      message: 'Deal relationship invariants satisfied'
    };
  } catch (error) {
    console.error('[systemInvariants] Error validating deal relationships:', error);
    return {
      valid: false,
      code: 'DEAL_RELATIONSHIPS_ERROR',
      message: 'Error validating deal relationships, operation blocked',
      errors: [{ reason: error.message }]
    };
  }
}

/**
 * Validate all invariants for a given operation
 * 
 * @param {string} operation - Operation type ('delete', 'unlink', 'typeMutation', 'roleInvariant', 'dealRelationships')
 * @param {InvariantContext} context - Invariant context
 * @returns {Promise<InvariantResult>} - Validation result
 */
async function validateInvariant(operation, context) {
  switch (operation) {
    case 'delete':
      return await validateDelete(context);
    case 'unlink':
      return await validateUnlink(context);
    case 'typeMutation':
      return await validateTypeMutation(context);
    case 'roleInvariant':
      return await validateRoleInvariant(context);
    case 'statusInvariant':
      return await validateStatusInvariant(context);
    case 'stageInPipeline':
      return await validateStageInPipeline(context);
    case 'dealRelationships':
      return await validateDealRelationships(context);
    default:
      return {
        valid: true,
        code: 'UNKNOWN_OPERATION',
        message: 'Unknown operation, validation skipped'
      };
  }
}

module.exports = {
  validateDelete,
  validateUnlink,
  validateTypeMutation,
  validateRoleInvariant,
  validateStatusInvariant,
  validateStageInPipeline,
  validateDealRelationships,
  validateInvariant,
  observeStatusMismatch,
  findActiveReferences,
  findActiveReferencesBulk
};
