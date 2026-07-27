'use strict';

/**
 * ATIP Mapping Engine — versioned field/module/tax maps applied at sync runtime.
 */

const TallyMappingVersion = require('../../../../models/TallyMappingVersion');
const TallyCompanyBinding = require('../../../../models/TallyCompanyBinding');
const ConnectorFieldMapping = require('../../../../models/ConnectorFieldMapping');
const TallyTaxMapping = require('../../../../models/TallyTaxMapping');
const { getMergedSettings } = require('../tallyModuleMappingService');
const schemaGenerator = require('./schemaGenerator');
const aiMappingEngine = require('./aiMappingEngine');
const auditEngine = require('./auditEngine');
const { CONNECTOR_KEYS } = require('../../connectorConstants');

async function getActiveMappingVersion({ organizationId, companyGuid }) {
  const binding = await TallyCompanyBinding.findOne({ organizationId, companyGuid }).lean();
  if (binding?.activeMappingVersionId) {
    return TallyMappingVersion.findById(binding.activeMappingVersionId);
  }
  return TallyMappingVersion.findOne({
    organizationId,
    companyGuid,
    status: 'active',
  }).sort({ version: -1 });
}

async function createDraftFromSchemas({ organizationId, companyGuid, userId = null, autoAcceptThreshold = null }) {
  const settings = await getMergedSettings(organizationId);
  const threshold = autoAcceptThreshold ?? settings.autoApproveMappingConfidence ?? 0.95;

  const generated = await schemaGenerator.listGenerated({ organizationId, companyGuid });
  if (!generated.length) {
    await schemaGenerator.generateForBinding({ organizationId, companyGuid });
  }
  const schemas = await schemaGenerator.listGenerated({ organizationId, companyGuid });

  const suggestions = await aiMappingEngine.suggestAll({
    organizationId,
    companyGuid,
    schemas,
  });

  const fieldRules = [];
  let autoAcceptedCount = 0;
  let pendingReviewCount = 0;

  for (const s of suggestions) {
    const accepted = s.confidence >= threshold;
    fieldRules.push({
      ...s,
      status: accepted ? 'accepted' : 'pending',
      autoAccepted: accepted,
    });
    if (accepted) autoAcceptedCount += 1;
    else pendingReviewCount += 1;
  }

  const latest = await TallyMappingVersion.findOne({ organizationId, companyGuid }).sort({ version: -1 });
  const version = latest ? latest.version + 1 : 1;

  if (latest && latest.status === 'draft') {
    latest.status = 'superseded';
    await latest.save();
  }

  const doc = await TallyMappingVersion.create({
    organizationId,
    companyGuid,
    version,
    status: 'draft',
    fieldRules,
    moduleRules: schemas.map((g) => ({
      tallyObjectKey: g.tallyObjectKey,
      arivuModuleKey: g.arivuModuleKey,
      arivuEntityType: g.arivuEntityType,
      supportTier: g.supportTier,
    })),
    taxRules: [],
    averageConfidence:
      fieldRules.length > 0
        ? fieldRules.reduce((a, r) => a + (r.confidence || 0), 0) / fieldRules.length
        : null,
    autoAcceptedCount,
    pendingReviewCount,
    history: [
      {
        action: 'auto_accept',
        confidence: threshold,
        actorUserId: userId,
        note: `Draft v${version} from schema + AI`,
      },
    ],
  });

  return doc;
}

async function acceptRule({ organizationId, companyGuid, versionId, tallyField, arivuField, transformRule = null, userId = null }) {
  const doc = await TallyMappingVersion.findOne({ _id: versionId, organizationId, companyGuid });
  if (!doc) throw new Error('Mapping version not found');

  const idx = doc.fieldRules.findIndex((r) => r.tallyField === tallyField && (!arivuField || r.arivuField === arivuField || !r.arivuField));
  if (idx >= 0) {
    doc.fieldRules[idx].arivuField = arivuField;
    doc.fieldRules[idx].status = 'accepted';
    if (transformRule) doc.fieldRules[idx].transform = transformRule;
  } else {
    doc.fieldRules.push({
      tallyField,
      arivuField,
      status: 'accepted',
      confidence: 1,
      transform: transformRule || { type: 'direct' },
    });
  }
  doc.history.push({ action: 'accept', tallyField, arivuField, actorUserId: userId });
  doc.pendingReviewCount = doc.fieldRules.filter((r) => r.status === 'pending').length;
  doc.markModified('fieldRules');
  doc.markModified('history');
  await doc.save();
  return doc;
}

async function activateVersion({ organizationId, companyGuid, versionId, userId = null }) {
  const doc = await TallyMappingVersion.findOne({ _id: versionId, organizationId, companyGuid });
  if (!doc) throw new Error('Mapping version not found');

  await TallyMappingVersion.updateMany(
    { organizationId, companyGuid, status: 'active', _id: { $ne: doc._id } },
    { $set: { status: 'superseded' } }
  );

  doc.status = 'active';
  doc.activatedAt = new Date();
  doc.activatedBy = userId;
  await doc.save();

  // Mirror accepted rules into ConnectorFieldMapping for compatibility
  const byEntity = new Map();
  for (const rule of doc.fieldRules.filter((r) => r.status === 'accepted' && r.arivuField)) {
    const entityType = rule.entityType || 'party';
    if (!byEntity.has(entityType)) byEntity.set(entityType, []);
    byEntity.get(entityType).push({
      arivuFieldKey: rule.arivuField,
      externalFieldKey: rule.tallyField,
      transform: typeof rule.transform === 'string'
        ? rule.transform
        : JSON.stringify(rule.transform || { type: 'direct' }),
      confidence: rule.confidence,
      approved: true,
    });
  }

  for (const [entityType, rules] of byEntity.entries()) {
    const existing = await ConnectorFieldMapping.findOne({
      organizationId,
      connectorKey: CONNECTOR_KEYS.TALLY || 'tally',
      entityType,
      companyGuid,
    }).sort({ version: -1 });

    const version = existing ? existing.version + 1 : 1;
    if (existing) {
      existing.active = false;
      await existing.save();
    }

    await ConnectorFieldMapping.create({
      organizationId,
      connectorKey: CONNECTOR_KEYS.TALLY || 'tally',
      entityType,
      companyGuid,
      version,
      active: true,
      rules,
      metadata: { mappingVersionId: String(doc._id), mappingVersion: doc.version },
    });
  }

  await TallyCompanyBinding.findOneAndUpdate(
    { organizationId, companyGuid },
    { $set: { activeMappingVersionId: doc._id, healthState: 'ready' } }
  );

  await auditEngine.recordEvent({
    organizationId,
    code: 'MAPPING_ACTIVATED',
    message: `Mapping version v${doc.version} activated`,
    operation: 'mapping_activate',
    userId,
    correlationId: String(doc._id),
  });

  return doc;
}

/**
 * Runtime: resolve field rules for transform engine (ATIP critical path).
 */
async function getRuntimeFieldRules({ organizationId, companyGuid, entityType = null }) {
  const version = await getActiveMappingVersion({ organizationId, companyGuid });
  if (version) {
    let rules = (version.fieldRules || []).filter((r) => r.status === 'accepted' && r.arivuField);
    if (entityType) rules = rules.filter((r) => !r.entityType || r.entityType === entityType);
    if (rules.length) {
      return rules.map((r) => ({
        sourceField: r.tallyField,
        targetField: r.arivuField,
        transform: r.transform || { type: 'direct' },
        direction: r.direction || 'both',
      }));
    }
  }

  // Fallback to ConnectorFieldMapping
  const filter = {
    organizationId,
    connectorKey: CONNECTOR_KEYS.TALLY || 'tally',
    active: true,
  };
  if (entityType) filter.entityType = entityType;
  if (companyGuid) filter.companyGuid = companyGuid;
  const maps = await ConnectorFieldMapping.find(filter).lean();
  const rules = [];
  for (const m of maps) {
    for (const r of m.rules || []) {
      let transform = { type: 'direct' };
      if (typeof r.transform === 'string') {
        try {
          transform = JSON.parse(r.transform);
        } catch {
          transform = { type: r.transform || 'direct' };
        }
      } else if (r.transform && typeof r.transform === 'object') {
        transform = r.transform;
      }
      rules.push({
        sourceField: r.externalFieldKey || r.sourceField || r.tallyField,
        targetField: r.arivuFieldKey || r.targetField || r.arivuField,
        transform,
        direction: r.direction || 'both',
      });
    }
  }
  return rules;
}

async function getTaxMappings({ organizationId, companyGuid = null }) {
  const filter = { organizationId };
  if (companyGuid) filter.companyGuid = companyGuid;
  return TallyTaxMapping.find(filter).lean();
}

module.exports = {
  getActiveMappingVersion,
  createDraftFromSchemas,
  acceptRule,
  activateVersion,
  getRuntimeFieldRules,
  getTaxMappings,
};
