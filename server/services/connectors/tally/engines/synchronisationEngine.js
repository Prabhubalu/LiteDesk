'use strict';

/**
 * ATIP Synchronisation Engine — facade over orchestrator + inbound materialization (2C).
 */

const { triggerBidirectionalSync } = require('../tallySyncOrchestrator');
const { enqueueTallySyncJob } = require('../tallySyncQueueService');
const { allowsPull } = require('../tallyModuleMappingService');
const TallyModuleMapping = require('../../../../models/TallyModuleMapping');
const { VOUCHER_MODULE_KEYS } = require('../../../../constants/atipConstants');
const changeDetectionEngine = require('./changeDetectionEngine');
const validationEngine = require('./validationEngine');
const transformationEngine = require('./transformationEngine');
const mappingEngine = require('./mappingEngine');
const conflictEngine = require('./conflictEngine');
const errorIntelligenceEngine = require('./errorIntelligenceEngine');
const auditEngine = require('./auditEngine');
const metadataEngine = require('./metadataEngine');
const schemaGenerator = require('./schemaGenerator');

async function triggerSync({
  organizationId,
  companyGuid = null,
  mode = 'incremental',
  dryRun = false,
  moduleKeys = null,
  requestedBy = null,
}) {
  const correlationId = auditEngine.newCorrelationId();
  await auditEngine.recordEvent({
    organizationId,
    code: 'SYNC_TRIGGERED',
    message: `Sync ${mode} triggered`,
    operation: 'sync_trigger',
    correlationId,
    userId: requestedBy,
    payload: { companyGuid, mode, dryRun, moduleKeys },
  });

  try {
    const result = await triggerBidirectionalSync({
      organizationId,
      companyGuid,
      mode,
      dryRun,
      moduleKeys,
    });
    return { ...result, correlationId };
  } catch (err) {
    const enriched = errorIntelligenceEngine.enrichError(err, { mode, companyGuid });
    await auditEngine.recordEvent({
      organizationId,
      level: 'error',
      code: enriched.problemCode,
      message: enriched.problem,
      correlationId,
      problemCode: enriched.problemCode,
      causeCode: enriched.causeCode,
      resolutionCode: enriched.resolutionCode,
      payload: errorIntelligenceEngine.toUserPayload(enriched),
    });
    throw err;
  }
}

function isVoucherModule(tallyModuleKey) {
  return VOUCHER_MODULE_KEYS.includes(String(tallyModuleKey || '').toLowerCase());
}

/**
 * Whether inbound voucher create into CRM is enabled (ATIP 2C).
 */
async function canInboundCreate({ organizationId, companyGuid, tallyModuleKey }) {
  const mapping = await TallyModuleMapping.findOne({
    organizationId,
    companyGuid,
    tallyModuleKey: String(tallyModuleKey).toLowerCase(),
  }).lean();

  if (!mapping || !mapping.enabled) return { allowed: false, reason: 'module_disabled' };
  if (!allowsPull(mapping.syncWay)) return { allowed: false, reason: 'sync_way' };

  const policy = mapping.inboundCreatePolicy || 'review_only';
  if (isVoucherModule(tallyModuleKey) && policy === 'review_only') {
    return { allowed: false, reason: 'review_only', policy, mapping };
  }
  return { allowed: true, policy, mapping };
}

async function prepareOutbound({ organizationId, companyGuid, entityType, arivuRecord, requiredFields = [] }) {
  const taxMappings = await mappingEngine.getTaxMappings({ organizationId, companyGuid });
  const transformed = await transformationEngine.transformOutbound({
    organizationId,
    companyGuid,
    entityType,
    arivuRecord,
  });
  const validation = validationEngine.validatePayload({
    direction: 'outbound',
    entityType,
    payload: { ...arivuRecord, ...transformed.payload },
    requiredFields,
    taxMappings,
  });
  return { transformed, validation };
}

async function prepareInbound({ organizationId, companyGuid, entityType, tallyModuleKey, tallyRecord }) {
  const gate = await canInboundCreate({ organizationId, companyGuid, tallyModuleKey: tallyModuleKey || entityType });
  const transformed = await transformationEngine.transformInbound({
    organizationId,
    companyGuid,
    entityType,
    tallyRecord,
  });
  const validation = validationEngine.validatePayload({
    direction: 'inbound',
    entityType,
    payload: { ...tallyRecord, ...transformed.payload },
  });
  return { gate, transformed, validation };
}

async function runMetadataOnboarding({ organizationId, companyGuid, userId = null }) {
  const job = await metadataEngine.enqueueMetadataDiscovery({
    organizationId,
    companyGuid,
    requestedBy: userId,
  });
  return job;
}

async function completeMetadataOnboarding({ organizationId, companyGuid, rawPayload, userId = null }) {
  const { snapshot, diff } = await metadataEngine.applyDiscoveryResult({
    organizationId,
    companyGuid,
    rawPayload,
  });
  await schemaGenerator.generateForBinding({
    organizationId,
    companyGuid,
    snapshotId: snapshot._id,
  });
  const mappingEngineMod = require('./mappingEngine');
  const draft = await mappingEngineMod.createDraftFromSchemas({
    organizationId,
    companyGuid,
    userId,
  });
  return { snapshot, diff, mappingDraft: draft };
}

async function enqueueSelectiveSync({ organizationId, companyGuid, tallyModuleKey, recordIds = [], dryRun = false }) {
  return enqueueTallySyncJob({
    organizationId,
    jobType: 'selective_sync',
    companyGuid,
    payload: { tallyModuleKey, recordIds, dryRun },
  });
}

module.exports = {
  triggerSync,
  canInboundCreate,
  isVoucherModule,
  prepareOutbound,
  prepareInbound,
  runMetadataOnboarding,
  completeMetadataOnboarding,
  enqueueSelectiveSync,
  changeDetectionEngine,
  conflictEngine,
};
