/**
 * ============================================================================
 * PLATFORM CORE: Configuration Registry Service
 * ============================================================================
 * 
 * Centralized configuration registry for entity behavior in a data-driven way.
 * 
 * Key Features:
 * - Entity Types (People, Organization, Deal)
 * - Lifecycles per Type
 * - Lifecycle → Status mappings
 * - App-aware but not hardcoded
 * - Computes derivedStatus from lifecycle state
 * 
 * Usage:
 *   const { getEntityTypes, getLifecycles, computeDerivedStatus } = require('./configRegistry');
 *   const types = await getEntityTypes('people', 'SALES');
 *   const status = await computeDerivedStatus('people', recordData, 'SALES');
 * 
 * ============================================================================
 */

const EntityType = require('../models/EntityType');
const Lifecycle = require('../models/Lifecycle');
const LifecycleStatusMap = require('../models/LifecycleStatusMap');
const { getSalesParticipationValues } = require('../utils/getSalesParticipationValues');

/**
 * Get entity types for a given entity and app
 * 
 * @param {string} entity - Entity name ('people', 'organization', 'deal')
 * @param {string} [appKey] - Optional app key filter
 * @returns {Promise<Array>} - Array of entity types
 */
async function getEntityTypes(entity, appKey = null) {
  try {
    const query = {
      entity: entity.toLowerCase(),
      isActive: true
    };
    
    if (appKey) {
      query.appKey = appKey.toLowerCase();
    }
    
    const types = await EntityType.find(query)
      .sort({ order: 1, label: 1 })
      .lean();
    
    return types;
  } catch (error) {
    console.error(`[configRegistry] Error fetching entity types for ${entity}:`, error);
    return [];
  }
}

/**
 * Get lifecycles for a given entity type
 * 
 * @param {string} entityTypeKey - Entity type key
 * @param {string} [appKey] - Optional app key filter
 * @returns {Promise<Array>} - Array of lifecycles
 */
async function getLifecycles(entityTypeKey, appKey = null) {
  try {
    const query = {
      entityTypeKey: entityTypeKey.toLowerCase(),
      isActive: true
    };
    
    if (appKey) {
      query.appKey = appKey.toLowerCase();
    }
    
    const lifecycles = await Lifecycle.find(query)
      .sort({ order: 1, label: 1 })
      .lean();
    
    return lifecycles;
  } catch (error) {
    console.error(`[configRegistry] Error fetching lifecycles for ${entityTypeKey}:`, error);
    return [];
  }
}

/**
 * Get lifecycle status mappings for a given lifecycle
 * 
 * @param {string} lifecycleKey - Lifecycle key
 * @param {string} [appKey] - Optional app key filter
 * @returns {Promise<Array>} - Array of status mappings
 */
async function getLifecycleStatusMappings(lifecycleKey, appKey = null) {
  try {
    if (lifecycleKey == null || typeof lifecycleKey !== 'string') {
      return [];
    }
    const query = {
      lifecycleKey: lifecycleKey.toLowerCase(),
      isActive: true
    };
    
    if (appKey) {
      query.appKey = appKey.toLowerCase();
    }
    
    const mappings = await LifecycleStatusMap.find(query)
      .sort({ sourceStatusField: 1, sourceStatusValue: 1 })
      .lean();
    
    return mappings;
  } catch (error) {
    console.error(`[configRegistry] Error fetching status mappings for ${lifecycleKey}:`, error);
    return [];
  }
}

/** Entity type key used for deal pipelines in config */
const DEAL_ENTITY_TYPE_KEY = 'default';

/**
 * Get pipelines (lifecycles) for deals, per appKey.
 * No hardcoded pipelines; all come from config.
 *
 * @param {string} [appKey] - Optional app key filter
 * @returns {Promise<Array>} - Array of pipeline configs { key, label, order, ... }
 */
async function getPipelines(appKey = null) {
  return getLifecycles(DEAL_ENTITY_TYPE_KEY, appKey);
}

/**
 * Get stages for a pipeline. Stages are lifecycle status mappings with sourceStatusField === 'stage'.
 *
 * @param {string} pipelineKey - Lifecycle (pipeline) key
 * @param {string} [appKey] - Optional app key filter
 * @returns {Promise<Array>} - Array of stage configs { sourceStatusValue, derivedStatus, probability, ... }
 */
async function getStagesForPipeline(pipelineKey, appKey = null) {
  try {
    const mappings = await getLifecycleStatusMappings(pipelineKey, appKey);
    return mappings.filter((m) => (m.sourceStatusField || '').toLowerCase() === 'stage');
  } catch (error) {
    console.error(`[configRegistry] Error fetching stages for pipeline ${pipelineKey}:`, error);
    return [];
  }
}

/**
 * Check whether deal pipeline config exists (at least one pipeline with at least one stage).
 *
 * @param {string} [appKey] - Optional app key
 * @returns {Promise<boolean>}
 */
async function hasDealPipelineConfig(appKey = null) {
  try {
    const pipelines = await getPipelines(appKey);
    for (const p of pipelines) {
      const stages = await getStagesForPipeline(p.key, appKey);
      if (stages.length > 0) return true;
    }
    return false;
  } catch (error) {
    console.error('[configRegistry] Error checking deal pipeline config:', error);
    return false;
  }
}

/**
 * Find a pipeline by key or label (for matching deal.pipeline string).
 *
 * @param {string} pipelineValue - Deal's pipeline string (key or label)
 * @param {string} [appKey] - Optional app key
 * @returns {Promise<Object|null>} - Pipeline config or null
 */
async function findPipelineByKeyOrLabel(pipelineValue, appKey = null) {
  if (!pipelineValue || typeof pipelineValue !== 'string') return null;
  const normalized = pipelineValue.trim().toLowerCase();
  const pipelines = await getPipelines(appKey);
  return (
    pipelines.find((p) => (p.key || '').toLowerCase() === normalized) ||
    pipelines.find((p) => (p.label || '').toLowerCase() === normalized) ||
    null
  );
}

/**
 * Check if a stage belongs to a pipeline (when config exists).
 *
 * @param {string} pipelineKey - Pipeline lifecycle key
 * @param {string} stage - Stage value
 * @param {string} [appKey] - Optional app key
 * @returns {Promise<boolean>}
 */
async function isStageInPipeline(pipelineKey, stage, appKey = null) {
  if (!pipelineKey || !stage) return false;
  const stages = await getStagesForPipeline(pipelineKey, appKey);
  const s = (stage || '').toString().trim();
  return stages.some((m) => (m.sourceStatusValue || '').toString() === s);
}

/**
 * Get stage config (derivedStatus, probability) for a pipeline + stage.
 *
 * @param {string} pipelineKey - Pipeline lifecycle key
 * @param {string} stage - Stage value
 * @param {string} [appKey] - Optional app key
 * @returns {Promise<Object|null>} - { derivedStatus, probability } or null
 */
async function getStageConfig(pipelineKey, stage, appKey = null) {
  const stages = await getStagesForPipeline(pipelineKey, appKey);
  const s = (stage || '').toString().trim();
  const m = stages.find((x) => (x.sourceStatusValue || '').toString() === s);
  if (!m) return null;
  return {
    derivedStatus: m.derivedStatus,
    probability: m.probability != null && !Number.isNaN(Number(m.probability)) ? Number(m.probability) : null
  };
}

/**
 * Compute legacy deal status from stage (fallback when no config exists).
 *
 * @param {string} stage - Deal stage
 * @returns {string|null} - Legacy status mapping or null
 */
function computeLegacyDealStatus(stage) {
  const { DEAL_STATUS } = require('../constants/dealStatus');
  const stageToStatusMap = {
    'Closed Won': DEAL_STATUS.WON,
    'Closed Lost': DEAL_STATUS.LOST,
    'Qualification': DEAL_STATUS.OPEN,
    'Proposal': DEAL_STATUS.OPEN,
    'Negotiation': DEAL_STATUS.OPEN,
    'Contract Sent': DEAL_STATUS.OPEN,
    'Lead': DEAL_STATUS.OPEN,
    'Qualified': DEAL_STATUS.OPEN
  };
  if (stageToStatusMap[stage]) return stageToStatusMap[stage];
  // Unknown stage labels: treat as Open (still in pipeline)
  return stage ? DEAL_STATUS.OPEN : null;
}

/**
 * Normalize stage-config / derived outcome labels to canonical Deal Status (Open|Won|Lost).
 * Maps legacy stalled/active/abandoned into the minimal set.
 */
function normalizeDealDerivedStatusValue(value) {
  const { normalizeDealStatus } = require('../constants/dealStatus');
  if (value == null || value === '') return null;
  return normalizeDealStatus(value);
}

/**
 * Legacy stage → probability fallback when no config exists.
 *
 * @param {string} stage - Deal stage
 * @returns {number|null} - 0–100 or null
 */
function computeLegacyDealProbability(stage) {
  const map = {
    Qualification: 25,
    Proposal: 50,
    Negotiation: 70,
    'Contract Sent': 85,
    'Closed Won': 100,
    'Closed Lost': 0,
    Lead: 25,
    Qualified: 50
  };
  return map[stage] != null ? map[stage] : null;
}

/**
 * Compute derived status and probability for a deal from pipeline + stage config.
 * Uses config when available; falls back to legacy stage → status / stage → probability.
 * Non-blocking: returns null on error; never throws.
 *
 * @param {Object} recordData - Deal record { pipeline, stage, ... }
 * @param {string} [appKey] - Optional app key
 * @returns {Promise<{ derivedStatus: string | null, probability: number | null } | null>}
 */
async function computeDealDerivedStatus(recordData, appKey = null) {
  try {
    if (!recordData || !recordData.stage) {
      return { derivedStatus: null, probability: null };
    }
    const stage = (recordData.stage || '').toString().trim();
    const pipelineValue = recordData.pipeline;
    
    const hasConfig = await hasDealPipelineConfig(appKey);
    if (!hasConfig) {
      return {
        derivedStatus: computeLegacyDealStatus(stage),
        probability: computeLegacyDealProbability(stage)
      };
    }
    
    const pipeline = await findPipelineByKeyOrLabel(pipelineValue, appKey);
    if (!pipeline) {
      return {
        derivedStatus: computeLegacyDealStatus(stage),
        probability: computeLegacyDealProbability(stage)
      };
    }
    
    const stageConfig = await getStageConfig(pipeline.key, stage, appKey);
    if (!stageConfig) {
      return {
        derivedStatus: computeLegacyDealStatus(stage),
        probability: computeLegacyDealProbability(stage)
      };
    }
    
    return {
      derivedStatus: normalizeDealDerivedStatusValue(stageConfig.derivedStatus),
      probability: stageConfig.probability != null ? stageConfig.probability : computeLegacyDealProbability(stage)
    };
  } catch (error) {
    console.error('[configRegistry] Error computing deal derived status:', error);
    return null;
  }
}

/**
 * Compute derived status from record data based on lifecycle mappings
 * 
 * @param {string} entity - Entity name ('people', 'organization', 'deal')
 * @param {Object} recordData - Record data with status fields
 * @param {string} [appKey] - Optional app key
 * @returns {Promise<string|null>} - Derived status or null if not computable
 */
async function computeDerivedStatus(entity, recordData, appKey = null) {
  try {
    if (!recordData) {
      return null;
    }
    
    // Get entity types for this entity
    const entityTypes = await getEntityTypes(entity, appKey);
    
    if (entity === 'deal') {
      const res = await computeDealDerivedStatus(recordData, appKey);
      return res ? res.derivedStatus : null;
    }
    
    if (entityTypes.length === 0) {
      return null;
    }
    
    // Determine which entity type this record belongs to
    let entityTypeKey = null;
    let dataForMapping = recordData;

    if (entity === 'people') {
      const { role, lead_status, contact_status } = getSalesParticipationValues(recordData);
      dataForMapping = { ...recordData, type: role, lead_status, contact_status };

      if (role) {
        entityTypeKey = role.toLowerCase();
      } else {
        if (lead_status) entityTypeKey = 'lead';
        else if (contact_status) entityTypeKey = 'contact';
      }
    } else if (entity === 'organization') {
      if (recordData.types && Array.isArray(recordData.types) && recordData.types.length > 0) {
        entityTypeKey = recordData.types[0].toLowerCase();
      }
    }
    
    if (!entityTypeKey) return null;
    
    const entityType = entityTypes.find((et) => et.key === entityTypeKey);
    if (!entityType) return null;
    
    const lifecycles = await getLifecycles(entityType.key, appKey);
    if (lifecycles.length === 0) return null;
    
    const lifecycle = lifecycles[0];
    const mappings = await getLifecycleStatusMappings(lifecycle.key, appKey);
    if (mappings.length === 0) return null;
    
    for (const mapping of mappings) {
      const sourceValue = dataForMapping[mapping.sourceStatusField];
      if (sourceValue && sourceValue.toString() === mapping.sourceStatusValue) {
        return mapping.derivedStatus;
      }
    }
    
    return null;
  } catch (error) {
    console.error(`[configRegistry] Error computing derived status for ${entity}:`, error);
    return null;
  }
}

/**
 * Get all configuration for a given entity and app
 * 
 * @param {string} entity - Entity name ('people', 'organization', 'deal')
 * @param {string} [appKey] - Optional app key filter
 * @returns {Promise<Object>} - Complete configuration object
 */
async function getEntityConfiguration(entity, appKey = null) {
  try {
    const entityTypes = await getEntityTypes(entity, appKey);
    
    const configuration = {
      entity,
      appKey: appKey || null,
      entityTypes: []
    };
    
    // For each entity type, get its lifecycles and mappings
    for (const entityType of entityTypes) {
      const lifecycles = await getLifecycles(entityType.key, appKey);
      
      const entityTypeConfig = {
        ...entityType,
        lifecycles: []
      };
      
      for (const lifecycle of lifecycles) {
        const mappings = await getLifecycleStatusMappings(lifecycle.key, appKey);
        
        entityTypeConfig.lifecycles.push({
          ...lifecycle,
          statusMappings: mappings
        });
      }
      
      configuration.entityTypes.push(entityTypeConfig);
    }
    
    return configuration;
  } catch (error) {
    console.error(`[configRegistry] Error fetching configuration for ${entity}:`, error);
    return {
      entity,
      appKey: appKey || null,
      entityTypes: []
    };
  }
}

/**
 * Get all configurations for all entities (for admin/overview)
 * 
 * @param {string} [appKey] - Optional app key filter
 * @returns {Promise<Object>} - All configurations
 */
async function getAllConfigurations(appKey = null) {
  try {
    const entities = ['people', 'organization', 'deal'];
    const configurations = {};
    
    for (const entity of entities) {
      configurations[entity] = await getEntityConfiguration(entity, appKey);
    }
    
    return configurations;
  } catch (error) {
    console.error('[configRegistry] Error fetching all configurations:', error);
    return {};
  }
}

module.exports = {
  getEntityTypes,
  getLifecycles,
  getLifecycleStatusMappings,
  computeDerivedStatus,
  getEntityConfiguration,
  getAllConfigurations,
  getPipelines,
  getStagesForPipeline,
  hasDealPipelineConfig,
  findPipelineByKeyOrLabel,
  isStageInPipeline,
  getStageConfig,
  computeDealDerivedStatus,
  computeLegacyDealStatus,
  computeLegacyDealProbability,
  normalizeDealDerivedStatusValue
};
