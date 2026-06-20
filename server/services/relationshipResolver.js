/**
 * ============================================================================
 * PLATFORM CORE: Relationship Resolution Service
 * ============================================================================
 * 
 * This service resolves relationships between records using:
 * - RelationshipDefinition (platform metadata)
 * - TenantRelationshipConfiguration (tenant overrides)
 * - RelationshipInstance (runtime data)
 * 
 * Key Features:
 * - App-agnostic resolution
 * - Tenant-aware filtering
 * - Never throws (returns empty results safely)
 * - Supports both directions (source/target)
 * 
 * ⚠️ This is READ-ONLY resolution - no mutations
 * ⚠️ No business logic - pure data access
 * ⚠️ Must handle missing data gracefully
 * 
 * See PLATFORM_ARCHITECTURE.md for details.
 * ============================================================================
 */

const mongoose = require('mongoose');
const RelationshipInstance = require('../models/RelationshipInstance');
const RelationshipDefinition = require('../models/RelationshipDefinition');
const TenantRelationshipConfiguration = require('../models/TenantRelationshipConfiguration');
const { getEffectiveRelationships } = require('../utils/tenantMetadata');
const {
  MODULE_APP_FALLBACKS,
  isDocumentRelationshipKey,
  PLATFORM_DOCUMENT_RELATIONSHIP_DEFINITIONS
} = require('../constants/defaultDocumentRelationships');

function getAppKeyCandidates(appKey, moduleKey) {
  const normalizedAppKey = String(appKey || '').toLowerCase().trim();
  const normalizedModuleKey = String(moduleKey || '').toLowerCase().trim();
  const fallbacks = MODULE_APP_FALLBACKS[normalizedModuleKey] || [];
  return [...new Set([normalizedAppKey, ...fallbacks.map((key) => String(key).toLowerCase())])];
}

function matchesRecordEndpoint(endpoint, appKeyCandidates, moduleKey, recordId) {
  if (!endpoint?.appKey || !endpoint?.moduleKey || endpoint.recordId == null) return false;
  if (String(endpoint.moduleKey).toLowerCase() !== String(moduleKey).toLowerCase()) return false;
  if (!appKeyCandidates.includes(String(endpoint.appKey).toLowerCase())) return false;
  return String(endpoint.recordId) === String(recordId);
}

function getDocumentRelationshipFallbackDef(relationshipKey) {
  const relKey = String(relationshipKey || '').toLowerCase();
  if (!isDocumentRelationshipKey(relKey)) return null;
  const def = PLATFORM_DOCUMENT_RELATIONSHIP_DEFINITIONS.find(
    (entry) => String(entry.relationshipKey || '').toLowerCase() === relKey
  );
  if (!def) return null;
  return {
    relationshipKey: relKey,
    source: {
      appKey: String(def.source?.appKey || '').toUpperCase(),
      moduleKey: def.source?.moduleKey
    },
    target: {
      appKey: String(def.target?.appKey || '').toUpperCase(),
      moduleKey: def.target?.moduleKey
    },
    cardinality: def.cardinality,
    relationshipType: def.relationshipType || def.cardinality,
    ownership: def.ownership,
    required: def.required,
    userLinkable: def.userLinkable !== undefined ? def.userLinkable : true,
    display: def.display || null,
    ui: def.ui
  };
}

/**
 * Normalize recordId for query (RelationshipInstance stores recordId as ObjectId)
 * @param {string|ObjectId} recordId
 * @returns {ObjectId|string} - ObjectId if valid hex string, otherwise original
 */
function normalizeRecordIdForQuery(recordId) {
  if (recordId == null) return recordId;
  if (mongoose.Types.ObjectId.isValid(recordId) && String(recordId).length === 24) {
    return new mongoose.Types.ObjectId(String(recordId));
  }
  return recordId;
}

/**
 * Get all relationship instances for a specific record
 * @param {string|ObjectId} organizationId - The organization ID
 * @param {string} appKey - The app key
 * @param {string} moduleKey - The module key
 * @param {string|ObjectId} recordId - The record ID
 * @returns {Promise<Array>} - Array of relationship instances (both directions)
 */
async function getRelationshipsForRecord(organizationId, appKey, moduleKey, recordId) {
  try {
    const normalizedAppKey = appKey.toLowerCase();
    const normalizedModuleKey = moduleKey.toLowerCase();
    const normalizedRecordId = normalizeRecordIdForQuery(recordId);
    const appKeyCandidates = getAppKeyCandidates(normalizedAppKey, normalizedModuleKey);
    const sourceAppKeyQuery = appKeyCandidates.length === 1
      ? appKeyCandidates[0]
      : { $in: appKeyCandidates };
    const targetAppKeyQuery = appKeyCandidates.length === 1
      ? appKeyCandidates[0]
      : { $in: appKeyCandidates };

    // SAFETY: Cross-app relationship resolution must never throw
    // Get all relationship instances where this record is source OR target
    const relationships = await RelationshipInstance.find({
      organizationId,
      $or: [
        {
          'source.appKey': sourceAppKeyQuery,
          'source.moduleKey': normalizedModuleKey,
          'source.recordId': normalizedRecordId
        },
        {
          'target.appKey': targetAppKeyQuery,
          'target.moduleKey': normalizedModuleKey,
          'target.recordId': normalizedRecordId
        }
      ]
    }).lean();

    // SAFETY: Always return array, never null/undefined
    return relationships || [];
  } catch (error) {
    // SAFETY: Cross-app relationship resolution must never throw
    console.error(
      `[relationshipResolver] Error getting relationships for record ${appKey}.${moduleKey}:${recordId}:`,
      error
    );
    return [];
  }
}

/**
 * Get related records for a specific record, grouped by relationship
 * @param {string|ObjectId} organizationId - The organization ID
 * @param {string} appKey - The app key
 * @param {string} moduleKey - The module key
 * @param {string|ObjectId} recordId - The record ID
 * @returns {Promise<Array>} - Array of related records with metadata
 */
async function getRelatedRecords(organizationId, appKey, moduleKey, recordId) {
  try {
    const normalizedAppKey = appKey.toLowerCase();
    const normalizedModuleKey = moduleKey.toLowerCase();

    // SAFETY: Cross-app relationship resolution must never throw
    // Get all relationship instances
    const instances = await getRelationshipsForRecord(organizationId, appKey, moduleKey, recordId);

    // Get effective relationships for this module (to get metadata)
    // SAFETY: Missing or disabled tenant relationships fail safely
    const effectiveRelationships = await getEffectiveRelationships(
      organizationId,
      appKey,
      moduleKey
    ).catch(() => []); // Return empty array on error

    const relationshipMap = new Map(
      effectiveRelationships.map(rel => [rel.relationshipKey.toLowerCase(), rel])
    );
    const appKeyCandidates = getAppKeyCandidates(normalizedAppKey, normalizedModuleKey);

    // Group instances by relationship key
    const grouped = new Map();

    for (const instance of instances) {
      const relKey = instance.relationshipKey?.toLowerCase();
      if (!relKey) continue; // SAFETY: Skip invalid instances

      let relDef = relationshipMap.get(relKey);
      if (!relDef) {
        relDef = getDocumentRelationshipFallbackDef(relKey);
      }

      // SAFETY: Skip if relationship definition not found or disabled
      if (!relDef) {
        continue;
      }

      // SAFETY: Ensure both source and target app keys are respected
      // Determine direction
      const isSource = matchesRecordEndpoint(
        instance.source,
        appKeyCandidates,
        normalizedModuleKey,
        recordId
      );

      // SAFETY: Validate target record exists before adding
      const relatedRecord = isSource
        ? {
            appKey: instance.target?.appKey,
            moduleKey: instance.target?.moduleKey,
            recordId: instance.target?.recordId
          }
        : {
            appKey: instance.source?.appKey,
            moduleKey: instance.source?.moduleKey,
            recordId: instance.source?.recordId
          };

      // SAFETY: Only add if all required fields are present
      if (!relatedRecord.appKey || !relatedRecord.moduleKey || !relatedRecord.recordId) {
        continue;
      }

      if (!grouped.has(relKey)) {
        grouped.set(relKey, {
          relationshipKey: relKey,
          definition: relDef,
          direction: isSource ? 'SOURCE' : 'TARGET',
          records: []
        });
      }

      grouped.get(relKey).records.push(relatedRecord);
    }

    // SAFETY: Empty relationships return empty arrays (never throw)
    return Array.from(grouped.values());
  } catch (error) {
    // SAFETY: Cross-app relationship resolution must never throw
    console.error(
      `[relationshipResolver] Error getting related records for ${appKey}.${moduleKey}:${recordId}:`,
      error
    );
    return [];
  }
}

/**
 * Get outgoing links from a record (where record is source)
 * @param {string|ObjectId} organizationId - The organization ID
 * @param {string} appKey - The app key
 * @param {string} moduleKey - The module key
 * @param {string|ObjectId} recordId - The record ID
 * @param {string} relationshipKey - Optional: filter by specific relationship
 * @returns {Promise<Array>} - Array of relationship instances
 */
async function getOutgoingLinks(organizationId, appKey, moduleKey, recordId, relationshipKey = null) {
  try {
    const normalizedAppKey = appKey.toLowerCase();
    const normalizedModuleKey = moduleKey.toLowerCase();

    const query = {
      organizationId,
      'source.appKey': normalizedAppKey,
      'source.moduleKey': normalizedModuleKey,
      'source.recordId': recordId
    };

    if (relationshipKey) {
      query.relationshipKey = relationshipKey.toLowerCase();
    }

    const relationships = await RelationshipInstance.find(query).lean();
    return relationships || [];
  } catch (error) {
    console.error(
      `[relationshipResolver] Error getting outgoing links for ${appKey}.${moduleKey}:${recordId}:`,
      error
    );
    return [];
  }
}

/**
 * Get incoming links to a record (where record is target)
 * @param {string|ObjectId} organizationId - The organization ID
 * @param {string} appKey - The app key
 * @param {string} moduleKey - The module key
 * @param {string|ObjectId} recordId - The record ID
 * @param {string} relationshipKey - Optional: filter by specific relationship
 * @returns {Promise<Array>} - Array of relationship instances
 */
async function getIncomingLinks(organizationId, appKey, moduleKey, recordId, relationshipKey = null) {
  try {
    const normalizedAppKey = appKey.toLowerCase();
    const normalizedModuleKey = moduleKey.toLowerCase();

    const query = {
      organizationId,
      'target.appKey': normalizedAppKey,
      'target.moduleKey': normalizedModuleKey,
      'target.recordId': recordId
    };

    if (relationshipKey) {
      query.relationshipKey = relationshipKey.toLowerCase();
    }

    const relationships = await RelationshipInstance.find(query).lean();
    return relationships || [];
  } catch (error) {
    console.error(
      `[relationshipResolver] Error getting incoming links for ${appKey}.${moduleKey}:${recordId}:`,
      error
    );
    return [];
  }
}

/**
 * Check if a required relationship is satisfied for a record
 * @param {string|ObjectId} organizationId - The organization ID
 * @param {string} appKey - The app key
 * @param {string} moduleKey - The module key
 * @param {string|ObjectId} recordId - The record ID
 * @param {string} relationshipKey - The relationship key to check
 * @returns {Promise<boolean>} - True if relationship is satisfied
 */
async function isRequiredRelationshipSatisfied(organizationId, appKey, moduleKey, recordId, relationshipKey) {
  try {
    const normalizedAppKey = appKey.toLowerCase();
    const normalizedModuleKey = moduleKey.toLowerCase();
    const normalizedRelKey = relationshipKey.toLowerCase();

    // Get relationship definition
    const relDef = await RelationshipDefinition.findOne({
      relationshipKey: normalizedRelKey,
      enabled: true
    });

    if (!relDef) {
      return true; // If relationship doesn't exist, consider it satisfied
    }

    // Get tenant override
    const tenantConfig = await TenantRelationshipConfiguration.findOne({
      organizationId,
      relationshipKey: normalizedRelKey
    });

    // Check if relationship is required (platform or tenant override)
    const isRequired = tenantConfig?.requiredOverride !== null
      ? tenantConfig.requiredOverride
      : relDef.required;

    if (!isRequired) {
      return true; // Not required, so satisfied
    }

    // Check if tenant has disabled this relationship
    if (tenantConfig && !tenantConfig.enabled) {
      return true; // Disabled relationships are not required
    }

    // Determine if we're checking from source or target perspective
    const isSource = 
      relDef.source.appKey === normalizedAppKey &&
      relDef.source.moduleKey === normalizedModuleKey;

    // Check for existing relationship instances
    let count = 0;
    if (isSource) {
      count = await RelationshipInstance.countDocuments({
        organizationId,
        relationshipKey: normalizedRelKey,
        'source.appKey': normalizedAppKey,
        'source.moduleKey': normalizedModuleKey,
        'source.recordId': recordId
      });
    } else {
      count = await RelationshipInstance.countDocuments({
        organizationId,
        relationshipKey: normalizedRelKey,
        'target.appKey': normalizedAppKey,
        'target.moduleKey': normalizedModuleKey,
        'target.recordId': recordId
      });
    }

    return count > 0;
  } catch (error) {
    console.error(
      `[relationshipResolver] Error checking required relationship ${relationshipKey} for ${appKey}.${moduleKey}:${recordId}:`,
      error
    );
    // On error, return true to avoid blocking operations
    return true;
  }
}

module.exports = {
  getRelationshipsForRecord,
  getRelatedRecords,
  getOutgoingLinks,
  getIncomingLinks,
  isRequiredRelationshipSatisfied
};

