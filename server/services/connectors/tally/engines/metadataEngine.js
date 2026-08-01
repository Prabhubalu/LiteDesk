'use strict';

/**
 * ATIP Metadata Engine (1B) — live discovery → versioned snapshots + object schemas.
 * Empty agent payloads are thin/failed — never invent BOOTSTRAP_OBJECTS at runtime.
 */

const crypto = require('crypto');
const TallyMetadataSnapshot = require('../../../../models/TallyMetadataSnapshot');
const TallyObjectSchema = require('../../../../models/TallyObjectSchema');
const TallyCompanyBinding = require('../../../../models/TallyCompanyBinding');
const { enqueueTallySyncJob } = require('../tallySyncQueueService');
const { SUPPORT_TIERS } = require('../../../../constants/atipConstants');
const { ARIVU_CAPABILITY_REGISTRY } = require('../../../../constants/atipConstants');
const auditEngine = require('./auditEngine');

function hashPayload(payload) {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function inferSupportTier(objectKey) {
  const key = String(objectKey || '').toLowerCase();
  for (const cap of ARIVU_CAPABILITY_REGISTRY) {
    if ((cap.tallyObjectHints || []).includes(key)) {
      if (cap.supportTier) return cap.supportTier;
      if (cap.syncDefault === 'discover_only') return 'discover_only';
      if (cap.entityType === 'reference') return 'reference_only';
      return 'supported';
    }
  }
  return 'discover_only';
}

/**
 * Normalize agent discovery payload. Does not invent objects when empty.
 */
function normalizeDiscoveryPayload(raw = {}) {
  const objectsIn = Array.isArray(raw.objects) ? raw.objects : [];

  const objects = objectsIn.map((o) => {
    const objectKey = String(o.objectKey || o.name || o.objectName || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_');
    const fields = (o.fields || [])
      .map((f) => {
        if (typeof f === 'string') {
          return { name: f, label: f, dataType: 'string', required: ['NAME', 'GUID'].includes(f) };
        }
        return {
          name: String(f.name || f.NAME || '').trim(),
          label: f.label || f.name || null,
          dataType: f.dataType || f.type || 'string',
          required: Boolean(f.required),
          isKey: Boolean(f.isKey) || ['GUID', 'MASTERID', 'NAME'].includes(String(f.name || '').toUpperCase()),
          isEnum: Boolean(f.isEnum),
          enumValues: f.enumValues || [],
          sampleValues: f.sampleValues || [],
          metadata: f.metadata || {},
        };
      })
      .filter((f) => f.name);

    return {
      objectKey,
      objectName: o.objectName || o.name || objectKey,
      collectionName: o.collectionName || null,
      fields,
      methods: o.methods || [],
      parents: o.parents || [],
      children: o.children || [],
      keys: fields.filter((f) => f.isKey).map((f) => f.name),
      source: o.source || null,
      probeError: o.probeError || null,
      recordNames: Array.isArray(o.recordNames)
        ? o.recordNames.map((n) => String(n).trim()).filter(Boolean)
        : [],
    };
  }).filter((o) => o.objectKey);

  return {
    objects,
    collections: raw.collections || objects.map((o) => ({ name: o.collectionName || o.objectKey, objectKey: o.objectKey })),
    enumerations: raw.enumerations || [],
    relationships: raw.relationships || [],
    features: raw.features || {
      gst: true,
      multiCurrency: Boolean(raw.multiCurrency),
      payroll: Boolean(raw.payroll),
      inventory: true,
    },
    tallyVersion: raw.tallyVersion || null,
    tdlFingerprint: raw.tdlFingerprint || raw.tdlPackVersion || null,
    tdlPackVersion: raw.tdlPackVersion || null,
    financialYear: raw.financialYear || null,
    thin: objects.length === 0,
  };
}

async function enqueueMetadataDiscovery({ organizationId, companyGuid, requestedBy = null }) {
  if (!organizationId || !companyGuid) throw new Error('organizationId and companyGuid required');

  await TallyCompanyBinding.findOneAndUpdate(
    { organizationId, companyGuid },
    { $set: { healthState: 'metadata_pending' } }
  );

  const job = await enqueueTallySyncJob({
    organizationId,
    jobType: 'discover_metadata',
    companyGuid,
    payload: {
      exportId: 'Arivu Metadata Introspect',
      requestedBy,
    },
    priority: 1,
  });

  return job;
}

async function applyDiscoveryResult({
  organizationId,
  companyGuid,
  connectionId = null,
  rawPayload = {},
  discoveredBy = 'agent',
}) {
  const normalized = normalizeDiscoveryPayload(rawPayload);
  const contentHash = hashPayload(normalized);

  if (normalized.thin) {
    const latest = await TallyMetadataSnapshot.findOne({
      organizationId,
      companyGuid,
    }).sort({ version: -1 });

    const version = latest ? latest.version + 1 : 1;
    if (latest && latest.status === 'ready') {
      latest.status = 'superseded';
      await latest.save();
    }

    const snapshot = await TallyMetadataSnapshot.create({
      organizationId,
      companyGuid,
      connectionId,
      version,
      contentHash,
      tallyVersion: normalized.tallyVersion,
      tdlFingerprint: normalized.tdlFingerprint,
      tdlPackVersion: normalized.tdlPackVersion,
      financialYear: normalized.financialYear,
      features: normalized.features,
      objects: [],
      collections: [],
      enumerations: [],
      relationships: [],
      rawPayload,
      discoveredBy,
      status: 'failed',
    });

    await TallyCompanyBinding.findOneAndUpdate(
      { organizationId, companyGuid },
      {
        $set: {
          activeMetadataSnapshotId: snapshot._id,
          schemaVersion: version,
          healthState: 'degraded',
          financialYear: normalized.financialYear || undefined,
        },
      }
    );

    await auditEngine.recordEvent({
      organizationId,
      code: 'METADATA_THIN',
      message: `Metadata discovery returned no objects for ${companyGuid}`,
      level: 'warn',
      operation: 'metadata_discover',
      correlationId: String(snapshot._id),
      payload: { version, contentHash, probeErrors: rawPayload.probeErrors || [] },
    });

    return { snapshot, unchanged: false, diff: null, thin: true };
  }

  const latest = await TallyMetadataSnapshot.findOne({
    organizationId,
    companyGuid,
  }).sort({ version: -1 });

  if (latest && latest.contentHash === contentHash && latest.status === 'ready') {
    return { snapshot: latest, unchanged: true, diff: null, thin: false };
  }

  if (latest && latest.status === 'ready') {
    latest.status = 'superseded';
    await latest.save();
  }

  const version = latest ? latest.version + 1 : 1;
  const snapshot = await TallyMetadataSnapshot.create({
    organizationId,
    companyGuid,
    connectionId,
    version,
    contentHash,
    tallyVersion: normalized.tallyVersion,
    tdlFingerprint: normalized.tdlFingerprint,
    tdlPackVersion: normalized.tdlPackVersion,
    financialYear: normalized.financialYear,
    features: normalized.features,
    objects: normalized.objects,
    collections: normalized.collections,
    enumerations: normalized.enumerations,
    relationships: normalized.relationships,
    rawPayload,
    discoveredBy,
    status: 'ready',
  });

  const diff = await upsertObjectSchemas({
    organizationId,
    companyGuid,
    snapshot,
    previous: latest,
  });

  await TallyCompanyBinding.findOneAndUpdate(
    { organizationId, companyGuid },
    {
      $set: {
        activeMetadataSnapshotId: snapshot._id,
        schemaVersion: version,
        healthState: 'metadata_pending',
        financialYear: normalized.financialYear || undefined,
      },
    }
  );

  await auditEngine.recordEvent({
    organizationId,
    code: 'METADATA_DISCOVERED',
    message: `Metadata snapshot v${version} for ${companyGuid}`,
    level: 'info',
    operation: 'metadata_discover',
    correlationId: String(snapshot._id),
    payload: { version, contentHash, objectCount: normalized.objects.length, diff },
  });

  return { snapshot, unchanged: false, diff, thin: false };
}

async function upsertObjectSchemas({ organizationId, companyGuid, snapshot, previous = null }) {
  const prevByKey = new Map();
  if (previous?.objects) {
    for (const o of previous.objects) prevByKey.set(o.objectKey, o);
  }

  const added = [];
  const removed = [];
  const changed = [];
  const nextKeys = new Set();

  for (const obj of snapshot.objects || []) {
    nextKeys.add(obj.objectKey);
    const prev = prevByKey.get(obj.objectKey);
    const fieldNames = new Set((obj.fields || []).map((f) => f.name));
    if (prev) {
      const prevFields = new Set((prev.fields || []).map((f) => (typeof f === 'string' ? f : f.name)));
      const addedFields = [...fieldNames].filter((f) => !prevFields.has(f));
      const removedFields = [...prevFields].filter((f) => !fieldNames.has(f));
      if (addedFields.length || removedFields.length) {
        changed.push({ objectKey: obj.objectKey, addedFields, removedFields });
      }
    } else {
      added.push(obj.objectKey);
    }

    await TallyObjectSchema.findOneAndUpdate(
      { organizationId, companyGuid, objectKey: obj.objectKey },
      {
        $set: {
          snapshotId: snapshot._id,
          objectName: obj.objectName,
          collectionName: obj.collectionName,
          fields: obj.fields,
          keys: obj.keys || [],
          parents: obj.parents || [],
          children: obj.children || [],
          methods: obj.methods || [],
          supportTier: inferSupportTier(obj.objectKey),
          metadata: {
            ...(obj.metadata && typeof obj.metadata === 'object' ? obj.metadata : {}),
            ...(Array.isArray(obj.recordNames) && obj.recordNames.length
              ? { recordNames: obj.recordNames }
              : {}),
          },
        },
      },
      { upsert: true, new: true }
    );
  }

  for (const key of prevByKey.keys()) {
    if (!nextKeys.has(key)) removed.push(key);
  }

  return { added, removed, changed };
}

async function getActiveSnapshot({ organizationId, companyGuid }) {
  const binding = await TallyCompanyBinding.findOne({ organizationId, companyGuid }).lean();
  if (binding?.activeMetadataSnapshotId) {
    return TallyMetadataSnapshot.findById(binding.activeMetadataSnapshotId);
  }
  return TallyMetadataSnapshot.findOne({ organizationId, companyGuid, status: 'ready' }).sort({
    version: -1,
  });
}

async function listObjectSchemas({ organizationId, companyGuid }) {
  return TallyObjectSchema.find({ organizationId, companyGuid }).sort({ objectKey: 1 }).lean();
}

/**
 * Live Tally ledger group names (from last metadata discovery of objectKey=group).
 */
async function listLedgerGroups({ organizationId, companyGuid }) {
  const schema = await TallyObjectSchema.findOne({
    organizationId,
    companyGuid,
    objectKey: 'group',
  }).lean();
  const names = Array.isArray(schema?.metadata?.recordNames) ? schema.metadata.recordNames : [];
  return {
    groups: names.map((name) => ({ name, value: name })),
    count: names.length,
    updatedAt: schema?.updatedAt || null,
  };
}

/**
 * Enqueue full ledger dump (all field values incl. User Space) from live Tally.
 */
async function enqueueLedgerDump({ organizationId, companyGuid, requestedBy = null }) {
  if (!organizationId || !companyGuid) throw new Error('organizationId and companyGuid required');

  const binding = await TallyCompanyBinding.findOne({ organizationId, companyGuid }).lean();
  const companyName = binding?.companyName || null;

  return enqueueTallySyncJob({
    organizationId,
    jobType: 'dump_ledgers',
    companyGuid,
    payload: {
      masterType: 'Ledger',
      exportId: 'Ledger',
      company: companyName,
      companyGuid,
      fullFields: true,
      limit: 5000,
      requestedBy,
    },
    priority: 2,
  });
}

async function getObjectSchema({ organizationId, companyGuid, objectKey }) {
  return TallyObjectSchema.findOne({
    organizationId,
    companyGuid,
    objectKey: String(objectKey).toLowerCase(),
  }).lean();
}

module.exports = {
  SUPPORT_TIERS,
  normalizeDiscoveryPayload,
  enqueueMetadataDiscovery,
  enqueueLedgerDump,
  applyDiscoveryResult,
  getActiveSnapshot,
  listObjectSchemas,
  listLedgerGroups,
  getObjectSchema,
  inferSupportTier,
  hashPayload,
};
