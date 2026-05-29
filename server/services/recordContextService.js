/**
 * ============================================================================
 * PLATFORM CORE: Record Context Service
 * ============================================================================
 * 
 * This service provides a single source of truth for record context including:
 * - Record metadata
 * - Enabled relationships
 * - Required relationships
 * - Linked records grouped by relationship
 * - UI hints (TAB, EMBED, INLINE)
 * 
 * This is the contract for:
 * - UI rendering
 * - Automation rules
 * - Process Designer (future)
 * 
 * Key Features:
 * - App-agnostic
 * - Tenant-aware
 * - Metadata-driven
 * - Never throws (returns safe defaults)
 * 
 * ⚠️ This is READ-ONLY - no mutations
 * ⚠️ Single source of truth for record relationships
 * 
 * See PLATFORM_ARCHITECTURE.md for details.
 * ============================================================================
 */

const { getEffectiveRelationships } = require('../utils/tenantMetadata');
const { getRelatedRecords } = require('./relationshipResolver');
const { isRequiredRelationshipSatisfied } = require('./relationshipResolver');
const ModuleDefinition = require('../models/ModuleDefinition');
const mongoose = require('mongoose');
const FormResponse = require('../models/FormResponse');
const People = require('../models/People');
const Event = require('../models/Event');
const Form = require('../models/Form');
// Phase 0I.3: Import review actions metadata
const { RESPONSE_REVIEW_ACTIONS, getAvailableReviewActions } = require('../constants/reviewActions');
// Phase 0I.4: Import execution capabilities registry
const { getCapabilitiesForRecordContext } = require('../utils/executionCapabilityRegistry');
// Phase 1C: Import execution feedback resolver and access resolution
const { resolveExecutionFeedback } = require('../utils/executionFeedbackResolver');
const { resolveAppAccess } = require('./accessResolutionService');
// Phase 2A.1: Import projection resolver
const {
  getProjection,
  getAllowedTypes,
  isReadOnlyProjection,
  getDefaultType,
  getBasePrimitive,
  isPlatformOwnedPrimitive
} = require('../utils/moduleProjectionResolver');

function normalizeIdString(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  // Native BSON ObjectId shape
  if (typeof value?.toHexString === 'function') {
    return String(value.toHexString());
  }
  // Some BSON values expose Buffer id; convert to stable hex
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value?.id)) {
    return value.id.toString('hex');
  }
  if (typeof value === 'object') {
    const id = value._id ?? value.id ?? value.recordId;
    if (id != null) return String(id);
  }
  return String(value);
}

function toObjectIdOrNull(value) {
  const normalized = normalizeIdString(value);
  if (!normalized) return null;
  if (!mongoose.Types.ObjectId.isValid(normalized)) return null;
  return new mongoose.Types.ObjectId(normalized);
}

function getLookupFieldKeysForTarget(moduleDef, targetModuleKey) {
  const targetLower = String(targetModuleKey || '').toLowerCase();
  const singularTarget = targetLower.endsWith('s') ? targetLower.slice(0, -1) : targetLower;
  const targetAliases = new Set([
    targetLower,
    singularTarget,
    `${targetLower}id`,
    `${singularTarget}id`
  ]);
  const fields = Array.isArray(moduleDef?.fields) ? moduleDef.fields : [];
  return fields
    .filter((field) => {
      const dataType = String(field?.dataType || '').toLowerCase();
      if (!dataType.includes('lookup')) return false;
      const target = String(field?.lookupSettings?.targetModule || '').toLowerCase();
      if (target && target === targetLower) return true;

      // Fallback for legacy/partial module metadata where lookupSettings.targetModule is missing.
      // Example: People.organization should still resolve as a lookup to Organizations.
      const key = String(field?.key || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return key && targetAliases.has(key);
    })
    .map((field) => String(field?.key || '').trim())
    .filter(Boolean);
}

function extractLinkedIds(value) {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value.flatMap((entry) => extractLinkedIds(entry));
  }
  if (typeof value?.toHexString === 'function') {
    return [String(value.toHexString())];
  }
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value?.id)) {
    return [value.id.toString('hex')];
  }
  if (typeof value === 'object') {
    const id = value._id ?? value.id ?? value.recordId ?? null;
    return id == null ? [] : [String(id)];
  }
  return [String(value)];
}

function mergeRecordRefs(existing = [], additions = []) {
  const out = [];
  const seen = new Set();
  for (const rec of [...existing, ...additions]) {
    const recId = normalizeIdString(rec?.recordId ?? rec?.id ?? rec?._id);
    const recApp = String(rec?.appKey || '').toLowerCase();
    const recMod = String(rec?.moduleKey || '').toLowerCase();
    if (!recId || !recMod) continue;
    const dedupeKey = `${recApp}:${recMod}:${recId}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    out.push({
      ...rec,
      appKey: String(rec?.appKey || '').toLowerCase(),
      moduleKey: recMod,
      recordId: recId
    });
  }
  return out;
}

async function getModuleDefinitionForContext(organizationId, appKey, moduleKey) {
  const appLower = String(appKey || '').toLowerCase();
  const moduleLower = String(moduleKey || '').toLowerCase();
  if (!moduleLower) return null;

  if (organizationId) {
    const tenant = await ModuleDefinition.findOne({
      organizationId,
      $or: [
        { key: moduleLower },
        { moduleKey: moduleLower }
      ]
    }).select('fields').lean();
    if (tenant) return tenant;
  }

  const platform = await ModuleDefinition.findOne({
    appKey: appLower,
    moduleKey: moduleLower,
    $or: [
      { organizationId: null },
      { organizationId: { $exists: false } }
    ]
  }).select('fields').lean();
  if (platform) return platform;

  return ModuleDefinition.findOne({
    appKey: appLower,
    moduleKey: moduleLower
  }).select('fields').lean();
}

async function getRecordLookupLinks(
  organizationId,
  queryAppKey,
  queryModuleKey,
  recordId,
  lookupFieldKeys = [],
  linkedAppKey = queryAppKey,
  linkedModuleKey = queryModuleKey
) {
  if (!Array.isArray(lookupFieldKeys) || lookupFieldKeys.length === 0) return [];
  const collection = mongoose.connection?.db?.collection(String(queryModuleKey || '').toLowerCase());
  if (!collection) return [];

  const objectId = toObjectIdOrNull(recordId);
  const idString = normalizeIdString(recordId);
  const query = objectId
    ? { _id: objectId }
    : { _id: idString };

  const projection = lookupFieldKeys.reduce((acc, key) => {
    acc[key] = 1;
    return acc;
  }, { _id: 1 });

  const record = await collection.findOne(query, { projection });
  if (!record) return [];

  const refs = [];
  for (const key of lookupFieldKeys) {
    const ids = extractLinkedIds(record[key]).map((id) => normalizeIdString(id)).filter(Boolean);
    for (const id of ids) {
      refs.push({
        appKey: String(linkedAppKey || '').toLowerCase(),
        moduleKey: String(linkedModuleKey || '').toLowerCase(),
        recordId: id
      });
    }
  }
  return refs;
}

async function getReverseLookupLinks(organizationId, sourceAppKey, sourceModuleKey, sourceLookupFieldKeys = [], targetRecordId) {
  if (!Array.isArray(sourceLookupFieldKeys) || sourceLookupFieldKeys.length === 0) return [];
  const collection = mongoose.connection?.db?.collection(String(sourceModuleKey || '').toLowerCase());
  if (!collection) return [];

  const objectId = toObjectIdOrNull(targetRecordId);
  const idString = normalizeIdString(targetRecordId);
  const fieldOrClauses = sourceLookupFieldKeys.flatMap((fieldKey) => {
    const clauses = [];
    if (objectId) clauses.push({ [fieldKey]: objectId });
    if (idString) clauses.push({ [fieldKey]: idString });
    if (objectId) clauses.push({ [`${fieldKey}._id`]: objectId });
    if (idString) clauses.push({ [`${fieldKey}._id`]: idString });
    return clauses;
  });
  if (fieldOrClauses.length === 0) return [];

  const cursor = collection.find({ $or: fieldOrClauses }, { projection: { _id: 1 } });
  const docs = await cursor.toArray();
  return docs
    .map((doc) => normalizeIdString(doc?._id))
    .filter(Boolean)
    .map((id) => ({
      appKey: String(sourceAppKey || '').toLowerCase(),
      moduleKey: String(sourceModuleKey || '').toLowerCase(),
      recordId: id
    }));
}

/**
 * Get record context for a specific record
 * @param {string|ObjectId} organizationId - Organization ID
 * @param {string} appKey - App key
 * @param {string} moduleKey - Module key
 * @param {string|ObjectId} recordId - Record ID
 * @param {Object} options - Optional context options (e.g., { requestingAppKey, user, organization })
 * @returns {Promise<Object>} - Record context object
 */
async function getRecordContext(organizationId, appKey, moduleKey, recordId, options = {}) {
  try {
    const normAppKey = appKey.toLowerCase();
    const normModuleKey = moduleKey.toLowerCase();

    // Get platform module definition (same rule as getTenantModuleConfig: organizationId null or missing)
    let moduleDef = await ModuleDefinition.findOne({
      appKey: normAppKey,
      moduleKey: normModuleKey,
      $or: [
        { organizationId: null },
        { organizationId: { $exists: false } }
      ]
    });
    if (!moduleDef) {
      moduleDef = await ModuleDefinition.findOne({ appKey: normAppKey, moduleKey: normModuleKey });
    }

    // Current module's relationship config (tenant override wins) for isLookup pass-through
    let currentModuleRelationships = (moduleDef && Array.isArray(moduleDef.relationships)) ? moduleDef.relationships : [];
    if (organizationId) {
      try {
        const tenantMod = await ModuleDefinition.findOne({ organizationId, key: moduleKey.toLowerCase() })
          .select('relationships')
          .lean();
        if (tenantMod && Array.isArray(tenantMod.relationships) && tenantMod.relationships.length > 0) {
          currentModuleRelationships = tenantMod.relationships;
        }
      } catch (_) { /* ignore */ }
    }

    // SAFETY: Cross-app relationship resolution must never throw
    // Get effective relationships for this module
    const effectiveRelationships = await getEffectiveRelationships(
      organizationId,
      appKey,
      moduleKey
    ).catch(() => []); // Return empty array on error

    // SAFETY: Missing or disabled tenant relationships fail safely
    // Get related records
    const relatedRecords = await getRelatedRecords(
      organizationId,
      appKey,
      moduleKey,
      recordId
    ).catch(() => []); // Return empty array on error

    // Build relationship groups with UI hints
    const relationships = effectiveRelationships.map(rel => {
      const related = relatedRecords.find(r => r.relationshipKey === rel.relationshipKey.toLowerCase());
      
      // Determine direction from this record's perspective
      const isSource = 
        rel.source.appKey.toLowerCase() === appKey.toLowerCase() &&
        rel.source.moduleKey.toLowerCase() === moduleKey.toLowerCase();

      const direction = isSource ? 'SOURCE' : 'TARGET';
      const uiConfig = isSource ? rel.ui.source : rel.ui.target;

      let isLookup = false;
      if (isSource && currentModuleRelationships.length > 0) {
        const targetModKey = (rel.target && rel.target.moduleKey) || '';
        const match = currentModuleRelationships.find(function (r) {
          const keyMatch = r.relationshipKey && String(r.relationshipKey).toLowerCase() === String(rel.relationshipKey).toLowerCase();
          const targetMatch = r.targetModuleKey && String(r.targetModuleKey).toLowerCase() === String(targetModKey).toLowerCase();
          return keyMatch || targetMatch;
        });
        if (match) isLookup = !!match.isLookup;
      }

      // Determine target based on direction
      const target = isSource
        ? {
            appKey: rel.target.appKey,
            moduleKey: rel.target.moduleKey
          }
        : {
            appKey: rel.source.appKey,
            moduleKey: rel.source.moduleKey
          };

      return {
        relationshipKey: rel.relationshipKey,
        label: uiConfig.label || rel.relationshipKey,
        direction,
        cardinality: rel.cardinality,
        relationshipType: rel.relationshipType || rel.cardinality,
        required: rel.required,
        requiredSatisfied: true,
        ownership: rel.ownership,
        userLinkable: rel.userLinkable !== undefined ? rel.userLinkable : true,
        display: rel.display || null,
        constraints: rel.constraints || null,
        isDefault: !!rel.isDefault,
        isAdvanced: !!rel.isAdvanced,
        activateWhenModuleExists: !!rel.activateWhenModuleExists,
        status: rel.status || 'ACTIVE',
        localField: rel.localField || null,
        foreignField: rel.foreignField || null,
        cascade: rel.cascade,
        target: target,
        records: related ? related.records : [],
        isLookup,
        ui: {
          showAs: uiConfig.showAs || 'TAB',
          label: uiConfig.label || rel.relationshipKey,
          picker: rel.ui.picker
        }
      };
    });

    // Metadata-driven lookup reconciliation:
    // include lookup-backed links in relationship groups (both source and reverse target directions)
    for (const relOut of relationships) {
      const relDef = effectiveRelationships.find((e) => e.relationshipKey === relOut.relationshipKey);
      if (!relDef) continue;

      if (relOut.direction === 'SOURCE') {
        const sourceDef = await getModuleDefinitionForContext(
          organizationId,
          relDef.source.appKey,
          relDef.source.moduleKey
        );
        const sourceLookupKeys = getLookupFieldKeysForTarget(sourceDef, relDef.target.moduleKey);
        const srcMod = String(relDef.source?.moduleKey || '').toLowerCase();
        const tgtMod = String(relDef.target?.moduleKey || '').toLowerCase();
        let effectiveLookupKeys = sourceLookupKeys;
        if (sourceLookupKeys.length === 0) {
          if (srcMod === 'people' && tgtMod === 'organizations') {
            effectiveLookupKeys = ['organization', 'organizationId'];
          } else if (srcMod === 'cases' && tgtMod === 'people') {
            effectiveLookupKeys = ['contactId'];
          } else if (srcMod === 'cases' && tgtMod === 'organizations') {
            effectiveLookupKeys = ['organizationRefId'];
          } else if (srcMod === 'quotes' && tgtMod === 'people') {
            effectiveLookupKeys = ['contactId'];
          } else if (srcMod === 'quotes' && tgtMod === 'organizations') {
            effectiveLookupKeys = ['organizationRefId'];
          } else if (srcMod === 'quotes' && tgtMod === 'deals') {
            effectiveLookupKeys = ['dealId'];
          } else if (srcMod === 'quotes' && tgtMod === 'cases') {
            effectiveLookupKeys = ['caseId'];
          }
        }
        const lookupRefs = await getRecordLookupLinks(
          organizationId,
          relDef.source.appKey,
          relDef.source.moduleKey,
          recordId,
          effectiveLookupKeys,
          relDef.target.appKey,
          relDef.target.moduleKey
        );
        relOut.records = mergeRecordRefs(relOut.records, lookupRefs);
      } else {
        const sourceDef = await getModuleDefinitionForContext(
          organizationId,
          relDef.source.appKey,
          relDef.source.moduleKey
        );
        const sourceLookupKeys = getLookupFieldKeysForTarget(sourceDef, moduleKey);
        const srcModRev = String(relDef.source?.moduleKey || '').toLowerCase();
        const curMod = String(moduleKey || '').toLowerCase();
        let effectiveSourceLookupKeys = sourceLookupKeys;
        if (sourceLookupKeys.length === 0) {
          if (srcModRev === 'people' && curMod === 'organizations') {
            effectiveSourceLookupKeys = ['organization', 'organizationId'];
          } else if (srcModRev === 'cases' && curMod === 'people') {
            effectiveSourceLookupKeys = ['contactId'];
          } else if (srcModRev === 'cases' && curMod === 'organizations') {
            effectiveSourceLookupKeys = ['organizationRefId'];
          } else if (srcModRev === 'quotes' && curMod === 'people') {
            effectiveSourceLookupKeys = ['contactId'];
          } else if (srcModRev === 'quotes' && curMod === 'organizations') {
            effectiveSourceLookupKeys = ['organizationRefId'];
          } else if (srcModRev === 'quotes' && curMod === 'deals') {
            effectiveSourceLookupKeys = ['dealId'];
          } else if (srcModRev === 'quotes' && curMod === 'cases') {
            effectiveSourceLookupKeys = ['caseId'];
          }
        }
        const reverseRefs = await getReverseLookupLinks(
          organizationId,
          relDef.source.appKey,
          relDef.source.moduleKey,
          effectiveSourceLookupKeys,
          recordId
        );
        relOut.records = mergeRecordRefs(relOut.records, reverseRefs);
      }
    }

    // Enrich TARGET-direction relationships with isLookup from source module's relationship config (UI-only; no schema change)
    for (let i = 0; i < relationships.length; i++) {
      const out = relationships[i];
      if (out.direction !== 'TARGET') continue;
      const eff = effectiveRelationships.find((e) => e.relationshipKey === out.relationshipKey);
      if (!eff || !eff.source) continue;
      const srcApp = (eff.source.appKey || '').toString().toLowerCase();
      const srcMod = (eff.source.moduleKey || '').toString().toLowerCase();
      if (!srcMod) continue;
      let sourceDef = null;
      try {
        if (organizationId) {
          sourceDef = await ModuleDefinition.findOne({
            organizationId,
            key: srcMod
          })
            .select('relationships')
            .lean();
        }
        if (!sourceDef) {
          sourceDef = await ModuleDefinition.findOne({
            organizationId: null,
            appKey: srcApp,
            moduleKey: srcMod
          })
            .select('relationships')
            .lean();
        }
      } catch (_) { /* ignore */ }
      if (sourceDef && Array.isArray(sourceDef.relationships)) {
        const match = sourceDef.relationships.find(
          (r) =>
            (r.relationshipKey && String(r.relationshipKey).toLowerCase() === String(out.relationshipKey).toLowerCase()) ||
            (r.targetModuleKey && String(r.targetModuleKey).toLowerCase() === moduleKey.toLowerCase())
        );
        if (match) out.isLookup = !!match.isLookup;
      }
    }

    // Check required relationships satisfaction
    for (const rel of relationships) {
      if (rel.required) {
        rel.requiredSatisfied = await isRequiredRelationshipSatisfied(
          organizationId,
          appKey,
          moduleKey,
          recordId,
          rel.relationshipKey
        );
        if (Array.isArray(rel.records) && rel.records.length > 0) {
          rel.requiredSatisfied = true;
        }
      }
    }

    // Phase 2A.1: Get projection metadata (metadata only, no behavior changes)
    const projectionMetadata = getProjection(appKey, moduleKey);
    const basePrimitive = getBasePrimitive(moduleKey);
    const isPlatformOwned = isPlatformOwnedPrimitive(moduleKey);

    // Phase 2C: Determine currentType from actual record
    let currentType = null;
    if (projectionMetadata && basePrimitive) {
      try {
        // Fetch minimal record data to determine type
        let record = null;
        const normalizedModuleKey = moduleKey.toLowerCase();
        
        if (normalizedModuleKey === 'people') {
          record = await People.findOne({ _id: recordId, organizationId }).select('participations').lean();
          const role = record?.participations?.SALES?.role;
          if (role) {
            // Map 'Lead'/'Contact' to 'LEAD'/'CONTACT'
            currentType = role.toUpperCase();
          }
        } else if (normalizedModuleKey === 'events') {
          record = await Event.findOne({ 
            $or: [{ _id: recordId }, { eventId: recordId }],
            organizationId 
          }).select('eventType').lean();
          if (record?.eventType) {
            // Map eventType to projection type
            // 'Meeting' -> 'MEETING'
            // 'Internal Audit' -> 'INTERNAL_AUDIT'
            // 'External Audit — Single Org' -> 'EXTERNAL_AUDIT_SINGLE'
            // 'External Audit Beat' -> 'EXTERNAL_AUDIT_BEAT'
            // 'Field Sales Beat' -> 'FIELD_SALES_BEAT'
            const eventTypeMap = {
              'Meeting': 'MEETING',
              'Meeting / Appointment': 'MEETING',
              'Internal Audit': 'INTERNAL_AUDIT',
              'External Audit — Single Org': 'EXTERNAL_AUDIT_SINGLE',
              'External Audit Beat': 'EXTERNAL_AUDIT_BEAT',
              'Field Sales Beat': 'FIELD_SALES_BEAT'
            };
            currentType = eventTypeMap[record.eventType] || record.eventType.toUpperCase().replace(/\s+/g, '_');
          }
        } else if (normalizedModuleKey === 'forms') {
          record = await Form.findOne({ _id: recordId, organizationId }).select('formType').lean();
          if (record?.formType) {
            // Map formType to projection type
            // 'Survey' -> 'SURVEY'
            // 'Audit' -> 'AUDIT'
            // 'Feedback' -> 'FEEDBACK'
            currentType = record.formType.toUpperCase();
          }
        }
      } catch (error) {
        console.error('[recordContextService] Error determining currentType:', error);
        // Safe fallback - continue without currentType
      }
    }

    // Build record metadata
    const recordMetadata = {
      appKey: appKey.toUpperCase(),
      moduleKey: moduleKey.toLowerCase(),
      recordId,
      entityType: moduleDef?.entityType || 'record',
      primaryField: moduleDef?.primaryField || 'name',
      supports: moduleDef?.supports || {}
    };

    // Phase 2A.1: Add projection metadata to record context (descriptive only)
    // Phase 2A.3: Include create defaults for UI use
    // Phase 2C: Include currentType derived from actual record
    if (projectionMetadata || isPlatformOwned) {
      recordMetadata.projection = {
        baseModule: projectionMetadata?.baseModuleKey || moduleKey.toLowerCase(),
        basePrimitive: basePrimitive || null,
        platformOwned: isPlatformOwned,
        currentType: currentType || null,
        allowedTypes: projectionMetadata?.allowedTypes || [],
        defaultType: projectionMetadata?.defaultType || null,
        readOnly: projectionMetadata?.readOnly || false,
        appKey: appKey.toUpperCase(),
        allowedInApp: projectionMetadata !== null
      };

      // Phase 2A.3: Expose create defaults for UI use (descriptive only)
      recordMetadata.createDefaults = {
        defaultType: projectionMetadata?.defaultType || null,
        allowedTypes: projectionMetadata?.allowedTypes || [],
        platformOwned: isPlatformOwned
      };
    }

    // Phase 0I.1: Include Response aggregation for Forms and Events
    let responseContext = null;
    if ((appKey.toLowerCase() === 'sales' && moduleKey.toLowerCase() === 'forms') ||
        (appKey.toLowerCase() === 'sales' && moduleKey.toLowerCase() === 'events')) {
      responseContext = await getResponseContext(organizationId, appKey, moduleKey, recordId);
    }

    const context = {
      record: recordMetadata,
      relationships,
      enabledRelationships: relationships.filter(r => r.records.length > 0 || !r.required),
      requiredRelationships: relationships.filter(r => r.required),
      unsatisfiedRequired: relationships.filter(r => r.required && !r.requiredSatisfied)
    };

    // Add response context if applicable
    if (responseContext) {
      context.responses = responseContext;
    }

    // Phase 0I.3: Include review actions metadata for Response records
    // ⚠️ SAFETY: This is descriptive metadata only, not actionable.
    // All actions are Sales-owned. Audit App and Portal are read-only.
    if (appKey.toLowerCase() === 'sales' && moduleKey.toLowerCase() === 'responses') {
      const response = await FormResponse.findOne({
        _id: recordId,
        organizationId
      }).select('executionStatus reviewStatus').lean();

      if (response) {
        // Compute review status safely (using the model's method if available)
        let computedReviewStatus = response.reviewStatus;
        if (response.executionStatus === 'Submitted' && !computedReviewStatus) {
          // If no reviewStatus but executionStatus is Submitted, compute it
          try {
            const responseDoc = await FormResponse.findById(recordId);
            if (responseDoc && typeof responseDoc.computeReviewStatus === 'function') {
              computedReviewStatus = responseDoc.computeReviewStatus();
            }
          } catch (error) {
            console.error('[recordContextService] Error computing review status:', error);
            // Keep existing reviewStatus on error
          }
        }

        // Get available review actions for current state (metadata only)
        const availableActions = getAvailableReviewActions(computedReviewStatus || null);

        context.reviewActions = RESPONSE_REVIEW_ACTIONS;
        context.availableReviewActions = availableActions;
        context.reviewStatus = computedReviewStatus || null;
        context.executionStatus = response.executionStatus || 'Not Started';

        // Phase 0I.4: Include execution capabilities metadata
        // Phase 1C: Enhance with execution feedback metadata
        // ⚠️ SAFETY: This is descriptive metadata only, not actionable.
        // Do not evaluate permissions, do not check ownership, do not mutate anything.
        const requestingAppKey = options.requestingAppKey || appKey;
        const executionCapabilities = getCapabilitiesForRecordContext('RESPONSE', requestingAppKey);
        
        // Phase 1C: Resolve execution feedback for each capability
        if (executionCapabilities && executionCapabilities.length > 0 && options.user && options.organization) {
          const capabilitiesWithFeedback = await Promise.all(
            executionCapabilities.map(async (capability) => {
              // Resolve execution entitlement for this capability
              const entitlementResult = await resolveAppAccess({
                user: options.user,
                organization: options.organization,
                appKey: capability.executionOwnerApp,
                intent: 'EXECUTE'
              });
              
              // Resolve feedback from entitlement result
              const feedback = resolveExecutionFeedback(entitlementResult);
              
              return {
                ...capability,
                executable: entitlementResult.allowed && capability.allowedToExecute,
                feedback: {
                  code: feedback.code,
                  severity: feedback.severity,
                  title: feedback.title,
                  message: feedback.message
                }
              };
            })
          );
          
          context.executionCapabilities = capabilitiesWithFeedback;
        } else {
          context.executionCapabilities = executionCapabilities;
        }
      }
    }

    // Phase 0I.4: Include execution capabilities for other domains
    // Determine domain from module/app combination
    let executionDomain = null;
    if (appKey.toLowerCase() === 'sales') {
      if (moduleKey.toLowerCase() === 'events') {
        executionDomain = 'EVENT';
      }
      // Add other domain mappings as needed
    }

    if (executionDomain) {
      const requestingAppKey = options.requestingAppKey || appKey;
      const executionCapabilities = getCapabilitiesForRecordContext(executionDomain, requestingAppKey);
      
      // Phase 1C: Resolve execution feedback for each capability
      if (executionCapabilities && executionCapabilities.length > 0 && options.user && options.organization) {
        const capabilitiesWithFeedback = await Promise.all(
          executionCapabilities.map(async (capability) => {
            // Resolve execution entitlement for this capability
            const entitlementResult = await resolveAppAccess({
              user: options.user,
              organization: options.organization,
              appKey: capability.executionOwnerApp,
              intent: 'EXECUTE'
            });
            
            // Resolve feedback from entitlement result
            const feedback = resolveExecutionFeedback(entitlementResult);
            
            return {
              ...capability,
              executable: entitlementResult.allowed && capability.allowedToExecute,
              feedback: {
                code: feedback.code,
                severity: feedback.severity,
                title: feedback.title,
                message: feedback.message
              }
            };
          })
        );
        
        context.executionCapabilities = capabilitiesWithFeedback;
      } else if (executionCapabilities && executionCapabilities.length > 0) {
        context.executionCapabilities = executionCapabilities;
      }
    }

    return context;
  } catch (error) {
    console.error(
      `[recordContextService] Error getting record context for ${appKey}.${moduleKey}:${recordId}:`,
      error
    );
    
    // Return safe defaults on error
    // Phase 2A.1: Include projection metadata in safe defaults
    const projectionMetadata = getProjection(appKey, moduleKey);
    const basePrimitive = getBasePrimitive(moduleKey);
    const isPlatformOwned = isPlatformOwnedPrimitive(moduleKey);

    const recordMetadata = {
      appKey: appKey.toUpperCase(),
      moduleKey: moduleKey.toLowerCase(),
      recordId,
      entityType: 'record',
      primaryField: 'name',
      supports: {}
    };

    // Add projection metadata if applicable
    // Phase 2C: Include currentType in safe defaults (null if record not found)
    if (projectionMetadata || isPlatformOwned) {
      recordMetadata.projection = {
        baseModule: projectionMetadata?.baseModuleKey || moduleKey.toLowerCase(),
        basePrimitive: basePrimitive || null,
        platformOwned: isPlatformOwned,
        currentType: null, // Safe fallback - record not found
        allowedTypes: projectionMetadata?.allowedTypes || [],
        defaultType: projectionMetadata?.defaultType || null,
        readOnly: projectionMetadata?.readOnly || false,
        appKey: appKey.toUpperCase(),
        allowedInApp: projectionMetadata !== null
      };

      // Phase 2A.3: Expose create defaults for UI use (descriptive only)
      recordMetadata.createDefaults = {
        defaultType: projectionMetadata?.defaultType || null,
        allowedTypes: projectionMetadata?.allowedTypes || [],
        platformOwned: isPlatformOwned
      };
    }

    return {
      record: recordMetadata,
      relationships: [],
      enabledRelationships: [],
      requiredRelationships: [],
      unsatisfiedRequired: []
    };
  }
}

/**
 * Get simplified record context for UI rendering
 * Returns only what UI needs to render related records
 * @param {string|ObjectId} organizationId - Organization ID
 * @param {string} appKey - App key
 * @param {string} moduleKey - Module key
 * @param {string|ObjectId} recordId - Record ID
 * @returns {Promise<Object>} - Simplified record context for UI
 */
async function getRecordContextForUI(organizationId, appKey, moduleKey, recordId) {
  try {
    const context = await getRecordContext(organizationId, appKey, moduleKey, recordId);

    // Transform to UI-friendly format
    const uiRelationships = context.relationships
      .filter(rel => rel.ui.showAs !== 'NONE')
      .map(rel => ({
        relationshipKey: rel.relationshipKey,
        label: rel.ui.label,
        direction: rel.direction,
        cardinality: rel.cardinality,
        required: rel.required,
        requiredSatisfied: rel.requiredSatisfied,
        cascade: rel.cascade,
        target: rel.target ? {
          appKey: rel.target.appKey?.toUpperCase() || 'SALES',
          moduleKey: rel.target.moduleKey || 'unknown'
        } : null,
        records: rel.records.map(rec => ({
          id: rec.recordId,
          appKey: rec.appKey.toUpperCase(),
          moduleKey: rec.moduleKey,
          // Note: label would need to be fetched from actual record
          // This is a placeholder - UI will need to fetch record details
        })),
        ui: {
          showAs: rel.ui.showAs,
          picker: rel.ui.picker
        }
      }));

    return {
      record: {
        appKey: context.record.appKey,
        moduleKey: context.record.moduleKey,
        recordId: context.record.recordId
      },
      relationships: uiRelationships,
      hasRequiredUnsatisfied: context.unsatisfiedRequired.length > 0
    };
  } catch (error) {
    console.error(
      `[recordContextService] Error getting UI record context for ${appKey}.${moduleKey}:${recordId}:`,
      error
    );
    
    return {
      record: {
        appKey: appKey.toUpperCase(),
        moduleKey: moduleKey.toLowerCase(),
        recordId
      },
      relationships: [],
      hasRequiredUnsatisfied: false
    };
  }
}

/**
 * Phase 0I.1: Get Response context for Forms and Events
 * Returns aggregated Response information including executionStatus, reviewStatus, and corrective action counts
 * @param {string|ObjectId} organizationId - Organization ID
 * @param {string} appKey - App key (should be 'SALES')
 * @param {string} moduleKey - Module key ('forms' or 'events')
 * @param {string|ObjectId} recordId - Record ID (Form ID or Event ID)
 * @returns {Promise<Object|null>} - Response context or null if not applicable
 */
async function getResponseContext(organizationId, appKey, moduleKey, recordId) {
  try {
    // Phase 0I.1: This is read-only aggregation - no workflow logic
    const query = {
      organizationId,
      executionStatus: { $in: ['Not Started', 'In Progress', 'Submitted'] }
    };

    // Determine the linking field based on module
    if (moduleKey.toLowerCase() === 'forms') {
      query.formId = recordId;
    } else if (moduleKey.toLowerCase() === 'events') {
      query['linkedTo.type'] = 'Event';
      query['linkedTo.id'] = recordId;
    } else {
      // Not applicable for other modules
      return null;
    }

    const responses = await FormResponse.find(query)
      .select('_id executionStatus reviewStatus correctiveActions submittedAt submittedBy')
      .lean();

    // Aggregate response information
    const responseCounts = {
      total: responses.length,
      byExecutionStatus: {
        'Not Started': responses.filter(r => r.executionStatus === 'Not Started').length,
        'In Progress': responses.filter(r => r.executionStatus === 'In Progress').length,
        'Submitted': responses.filter(r => r.executionStatus === 'Submitted').length
      },
      byReviewStatus: {
        'Pending Corrective Action': responses.filter(r => r.reviewStatus === 'Pending Corrective Action').length,
        'Needs Auditor Review': responses.filter(r => r.reviewStatus === 'Needs Auditor Review').length,
        'Approved': responses.filter(r => r.reviewStatus === 'Approved').length,
        'Rejected': responses.filter(r => r.reviewStatus === 'Rejected').length,
        'Closed': responses.filter(r => r.reviewStatus === 'Closed').length
      }
    };

    // Count corrective actions (embedded in responses)
    const correctiveActionCounts = {
      total: 0,
      open: 0,
      inProgress: 0,
      completed: 0
    };

    responses.forEach(response => {
      if (response.correctiveActions && Array.isArray(response.correctiveActions)) {
        response.correctiveActions.forEach(action => {
          correctiveActionCounts.total++;
          const status = action.managerAction?.status || 'open';
          if (status === 'open') correctiveActionCounts.open++;
          else if (status === 'in_progress') correctiveActionCounts.inProgress++;
          else if (status === 'completed') correctiveActionCounts.completed++;
        });
      }
    });

    return {
      responses: responses.map(r => ({
        id: r._id,
        executionStatus: r.executionStatus,
        reviewStatus: r.reviewStatus,
        submittedAt: r.submittedAt,
        correctiveActionCount: r.correctiveActions?.length || 0
      })),
      counts: responseCounts,
      correctiveActions: correctiveActionCounts
    };
  } catch (error) {
    console.error(
      `[recordContextService] Error getting response context for ${appKey}.${moduleKey}:${recordId}:`,
      error
    );
    // Return null on error - don't break the main context
    return null;
  }
}

module.exports = {
  getRecordContext,
  getRecordContextForUI,
  getResponseContext
};
