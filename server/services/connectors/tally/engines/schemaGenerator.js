'use strict';

/**
 * ATIP Schema Generator — metadata → CRM-ready contracts (PRD §7).
 */

const TallyGeneratedSchema = require('../../../../models/TallyGeneratedSchema');
const TallyObjectSchema = require('../../../../models/TallyObjectSchema');
const TallyCompanyBinding = require('../../../../models/TallyCompanyBinding');
const { ARIVU_CAPABILITY_REGISTRY } = require('../../../../constants/atipConstants');
const metadataEngine = require('./metadataEngine');
const auditEngine = require('./auditEngine');

function resolveArivuCapability(tallyObjectKey) {
  const key = String(tallyObjectKey || '').toLowerCase();
  for (const cap of ARIVU_CAPABILITY_REGISTRY) {
    if ((cap.tallyObjectHints || []).includes(key)) return cap;
  }
  return {
    entityType: 'reference',
    moduleKey: null,
    label: 'Reference cache',
    syncDefault: 'tally_to_arivu',
    supportTier: 'reference_only',
  };
}

function mapFieldType(dataType) {
  const t = String(dataType || 'string').toLowerCase();
  if (['number', 'amount', 'qty', 'quantity', 'integer', 'float'].includes(t)) return 'number';
  if (['date', 'datetime'].includes(t)) return 'date';
  if (['bool', 'boolean', 'logical'].includes(t)) return 'boolean';
  if (['enum', 'list'].includes(t)) return 'enum';
  return 'string';
}

function buildValidationModel(fields = [], tallyObjectKey) {
  const required = fields.filter((f) => f.required || ['NAME', 'GUID'].includes(f.name)).map((f) => f.name);
  const rules = {};
  for (const f of fields) {
    const upper = String(f.name).toUpperCase();
    if (upper === 'GSTIN' || upper.includes('GSTIN')) {
      rules[f.name] = { pattern: '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$', optional: true };
    }
    if (upper.includes('PAN') || upper === 'INCOMETAXNUMBER') {
      rules[f.name] = { pattern: '^[A-Z]{5}[0-9]{4}[A-Z]{1}$', optional: true };
    }
  }
  return { required, rules, voucherBalance: ['sales', 'purchase', 'journal', 'contra', 'receipt', 'payment'].includes(tallyObjectKey) };
}

function buildMappingStubs(fields = [], cap) {
  if (!cap?.moduleKey) return [];
  return fields.map((f) => ({
    tallyField: f.name,
    arivuField: null,
    suggested: null,
    confidence: 0,
    transform: { type: 'direct' },
    entityType: cap.entityType,
  }));
}

async function generateForBinding({ organizationId, companyGuid, snapshotId = null }) {
  const snapshot = snapshotId
    ? await require('../../../../models/TallyMetadataSnapshot').findById(snapshotId)
    : await metadataEngine.getActiveSnapshot({ organizationId, companyGuid });

  if (!snapshot) {
    const err = new Error('No metadata snapshot — run metadata discovery first');
    err.code = 'METADATA_REQUIRED';
    throw err;
  }

  const objectSchemas = await TallyObjectSchema.find({
    organizationId,
    companyGuid,
    snapshotId: snapshot._id,
  });

  // Fallback: use snapshot.objects if schemas not yet materialised
  const source = objectSchemas.length
    ? objectSchemas
    : (snapshot.objects || []).map((o) => ({
        _id: null,
        objectKey: o.objectKey,
        objectName: o.objectName,
        fields: o.fields,
        supportTier: metadataEngine.inferSupportTier(o.objectKey),
      }));

  const generated = [];
  for (const obj of source) {
    const cap = resolveArivuCapability(obj.objectKey);
    const supportTier = obj.supportTier || cap.supportTier || metadataEngine.inferSupportTier(obj.objectKey);
    const fields = (obj.fields || []).map((f) => ({
      name: f.name,
      label: f.label || f.name,
      dataType: mapFieldType(f.dataType),
      required: Boolean(f.required),
      isKey: Boolean(f.isKey),
      enumValues: f.enumValues || [],
    }));

    const doc = await TallyGeneratedSchema.findOneAndUpdate(
      { organizationId, companyGuid, tallyObjectKey: obj.objectKey },
      {
        $set: {
          snapshotId: snapshot._id,
          objectSchemaId: obj._id || null,
          arivuEntityType: cap.entityType,
          arivuModuleKey: cap.moduleKey,
          supportTier,
          fields,
          relationships: [],
          constraints: { syncDefault: cap.syncDefault, inboundCreateSupported: Boolean(cap.inboundCreateSupported) },
          validationModel: buildValidationModel(fields, obj.objectKey),
          mappingDefinitionStubs: buildMappingStubs(fields, cap),
          dtoContract: {
            entityType: cap.entityType,
            moduleKey: cap.moduleKey,
            fields: fields.map((f) => ({ key: f.name, type: f.dataType })),
          },
          schemaVersion: snapshot.version,
        },
      },
      { upsert: true, new: true }
    );
    generated.push(doc);
  }

  await TallyCompanyBinding.findOneAndUpdate(
    { organizationId, companyGuid },
    { $set: { schemaVersion: snapshot.version } }
  );

  await auditEngine.recordEvent({
    organizationId,
    code: 'SCHEMA_GENERATED',
    message: `Generated ${generated.length} CRM schemas for ${companyGuid}`,
    operation: 'schema_generate',
    correlationId: String(snapshot._id),
    payload: { count: generated.length, version: snapshot.version },
  });

  return generated;
}

async function listGenerated({ organizationId, companyGuid }) {
  return TallyGeneratedSchema.find({ organizationId, companyGuid }).sort({ tallyObjectKey: 1 }).lean();
}

async function getGenerated({ organizationId, companyGuid, tallyObjectKey }) {
  return TallyGeneratedSchema.findOne({
    organizationId,
    companyGuid,
    tallyObjectKey: String(tallyObjectKey).toLowerCase(),
  }).lean();
}

module.exports = {
  resolveArivuCapability,
  generateForBinding,
  listGenerated,
  getGenerated,
  mapFieldType,
};
