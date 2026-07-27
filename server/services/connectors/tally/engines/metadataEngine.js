'use strict';

/**
 * ATIP Metadata Engine (1B) — live discovery → versioned snapshots + object schemas.
 */

const crypto = require('crypto');
const TallyMetadataSnapshot = require('../../../../models/TallyMetadataSnapshot');
const TallyObjectSchema = require('../../../../models/TallyObjectSchema');
const TallyCompanyBinding = require('../../../../models/TallyCompanyBinding');
const { enqueueTallySyncJob } = require('../tallySyncQueueService');
const { SUPPORT_TIERS } = require('../../../../constants/atipConstants');
const { ARIVU_CAPABILITY_REGISTRY } = require('../../../../constants/atipConstants');
const auditEngine = require('./auditEngine');

/** Bootstrap object catalogue used when agent returns thin introspection (still dynamic storage). */
const BOOTSTRAP_OBJECTS = Object.freeze([
  { objectKey: 'ledger', objectName: 'Ledger', collectionName: 'Ledger', fields: ['NAME', 'PARENT', 'GUID', 'MASTERID', 'ALTERID', 'EMAIL', 'LEDGERPHONE', 'PINCODE', 'INCOMETAXNUMBER', 'GSTIN', 'GSTREGISTRATIONTYPE', 'LEDGERSTATENAME', 'ADDRESS'] },
  { objectKey: 'group', objectName: 'Group', collectionName: 'Group', fields: ['NAME', 'PARENT', 'GUID', 'MASTERID', 'ALTERID'] },
  { objectKey: 'stock_item', objectName: 'Stock Item', collectionName: 'StockItem', fields: ['NAME', 'PARENT', 'GUID', 'MASTERID', 'ALTERID', 'BASEUNITS', 'GSTAPPLICABLE', 'HSNCODE', 'GSTTYPEOFSUPPLY'] },
  { objectKey: 'stock_group', objectName: 'Stock Group', collectionName: 'StockGroup', fields: ['NAME', 'PARENT', 'GUID', 'MASTERID', 'ALTERID'] },
  { objectKey: 'stock_category', objectName: 'Stock Category', collectionName: 'StockCategory', fields: ['NAME', 'PARENT', 'GUID', 'MASTERID', 'ALTERID'] },
  { objectKey: 'unit', objectName: 'Unit', collectionName: 'Unit', fields: ['NAME', 'GUID', 'MASTERID', 'ALTERID', 'ISSIMPLEUNIT', 'ORIGINALNAME'] },
  { objectKey: 'godown', objectName: 'Godown', collectionName: 'Godown', fields: ['NAME', 'PARENT', 'GUID', 'MASTERID', 'ALTERID', 'ADDRESS'] },
  { objectKey: 'currency', objectName: 'Currency', collectionName: 'Currency', fields: ['NAME', 'GUID', 'MASTERID', 'ALTERID', 'MAILINGNAME', 'ORIGINALNAME'] },
  { objectKey: 'cost_centre', objectName: 'Cost Centre', collectionName: 'CostCentre', fields: ['NAME', 'PARENT', 'GUID', 'MASTERID', 'ALTERID'] },
  { objectKey: 'cost_category', objectName: 'Cost Category', collectionName: 'CostCategory', fields: ['NAME', 'GUID', 'MASTERID', 'ALTERID'] },
  { objectKey: 'voucher_type', objectName: 'Voucher Type', collectionName: 'VoucherType', fields: ['NAME', 'GUID', 'MASTERID', 'ALTERID', 'PARENT', 'NUMBERINGMETHOD'] },
  { objectKey: 'batch', objectName: 'Batch', collectionName: 'Batch', fields: ['NAME', 'GUID', 'MASTERID', 'ALTERID', 'PARENT'] },
  { objectKey: 'tax_unit', objectName: 'Tax Unit', collectionName: 'TaxUnit', fields: ['NAME', 'GUID', 'MASTERID', 'ALTERID'] },
  { objectKey: 'gst_classification', objectName: 'GST Classification', collectionName: 'GSTClassification', fields: ['NAME', 'GUID', 'MASTERID', 'ALTERID', 'HSNCODE'] },
  { objectKey: 'price_level', objectName: 'Price Level', collectionName: 'PriceLevel', fields: ['NAME', 'GUID', 'MASTERID', 'ALTERID'] },
  { objectKey: 'sales', objectName: 'Sales', collectionName: 'Voucher', fields: ['VOUCHERNUMBER', 'DATE', 'GUID', 'MASTERID', 'ALTERID', 'PARTYLEDGERNAME', 'VOUCHERTYPENAME', 'REFERENCE', 'NARRATION'] },
  { objectKey: 'purchase', objectName: 'Purchase', collectionName: 'Voucher', fields: ['VOUCHERNUMBER', 'DATE', 'GUID', 'MASTERID', 'ALTERID', 'PARTYLEDGERNAME', 'VOUCHERTYPENAME', 'REFERENCE'] },
  { objectKey: 'receipt', objectName: 'Receipt', collectionName: 'Voucher', fields: ['VOUCHERNUMBER', 'DATE', 'GUID', 'MASTERID', 'ALTERID', 'PARTYLEDGERNAME', 'VOUCHERTYPENAME'] },
  { objectKey: 'payment', objectName: 'Payment', collectionName: 'Voucher', fields: ['VOUCHERNUMBER', 'DATE', 'GUID', 'MASTERID', 'ALTERID', 'PARTYLEDGERNAME', 'VOUCHERTYPENAME'] },
  { objectKey: 'credit_note', objectName: 'Credit Note', collectionName: 'Voucher', fields: ['VOUCHERNUMBER', 'DATE', 'GUID', 'MASTERID', 'ALTERID', 'PARTYLEDGERNAME'] },
  { objectKey: 'debit_note', objectName: 'Debit Note', collectionName: 'Voucher', fields: ['VOUCHERNUMBER', 'DATE', 'GUID', 'MASTERID', 'ALTERID', 'PARTYLEDGERNAME'] },
  { objectKey: 'journal', objectName: 'Journal', collectionName: 'Voucher', fields: ['VOUCHERNUMBER', 'DATE', 'GUID', 'MASTERID', 'ALTERID', 'NARRATION'] },
  { objectKey: 'contra', objectName: 'Contra', collectionName: 'Voucher', fields: ['VOUCHERNUMBER', 'DATE', 'GUID', 'MASTERID', 'ALTERID'] },
  { objectKey: 'stock_journal', objectName: 'Stock Journal', collectionName: 'Voucher', fields: ['VOUCHERNUMBER', 'DATE', 'GUID', 'MASTERID', 'ALTERID'] },
  { objectKey: 'delivery_note', objectName: 'Delivery Note', collectionName: 'Voucher', fields: ['VOUCHERNUMBER', 'DATE', 'GUID', 'MASTERID', 'ALTERID', 'PARTYLEDGERNAME'] },
  { objectKey: 'receipt_note', objectName: 'Receipt Note', collectionName: 'Voucher', fields: ['VOUCHERNUMBER', 'DATE', 'GUID', 'MASTERID', 'ALTERID', 'PARTYLEDGERNAME'] },
  { objectKey: 'sales_order', objectName: 'Sales Order', collectionName: 'Voucher', fields: ['VOUCHERNUMBER', 'DATE', 'GUID', 'MASTERID', 'ALTERID', 'PARTYLEDGERNAME', 'REFERENCE'] },
  { objectKey: 'purchase_order', objectName: 'Purchase Order', collectionName: 'Voucher', fields: ['VOUCHERNUMBER', 'DATE', 'GUID', 'MASTERID', 'ALTERID', 'PARTYLEDGERNAME', 'REFERENCE'] },
  { objectKey: 'employee', objectName: 'Employee', collectionName: 'Employee', fields: ['NAME', 'GUID', 'MASTERID', 'ALTERID'] },
  { objectKey: 'quotation', objectName: 'Quotation', collectionName: 'Voucher', fields: ['VOUCHERNUMBER', 'DATE', 'GUID', 'MASTERID', 'ALTERID'] },
  { objectKey: 'manufacturing_journal', objectName: 'Manufacturing Journal', collectionName: 'Voucher', fields: ['VOUCHERNUMBER', 'DATE', 'GUID', 'MASTERID', 'ALTERID'] },
  { objectKey: 'physical_stock', objectName: 'Physical Stock', collectionName: 'Voucher', fields: ['VOUCHERNUMBER', 'DATE', 'GUID', 'MASTERID', 'ALTERID'] },
  { objectKey: 'bank_transaction', objectName: 'Bank Transaction', collectionName: 'Voucher', fields: ['VOUCHERNUMBER', 'DATE', 'GUID', 'MASTERID', 'ALTERID'] },
  { objectKey: 'attendance', objectName: 'Attendance', collectionName: 'Attendance', fields: ['NAME', 'GUID', 'MASTERID', 'ALTERID'] },
  { objectKey: 'payroll', objectName: 'Payroll Masters', collectionName: 'PayHead', fields: ['NAME', 'GUID', 'MASTERID', 'ALTERID'] },
]);

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

function normalizeDiscoveryPayload(raw = {}) {
  const objectsIn = Array.isArray(raw.objects) && raw.objects.length
    ? raw.objects
    : BOOTSTRAP_OBJECTS.map((o) => ({
        objectKey: o.objectKey,
        objectName: o.objectName,
        collectionName: o.collectionName,
        fields: o.fields.map((name) => ({ name, dataType: 'string' })),
        methods: [],
        parents: [],
        children: [],
      }));

  const objects = objectsIn.map((o) => {
    const objectKey = String(o.objectKey || o.name || o.objectName || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_');
    const fields = (o.fields || []).map((f) => {
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
    }).filter((f) => f.name);

    return {
      objectKey,
      objectName: o.objectName || o.name || objectKey,
      collectionName: o.collectionName || null,
      fields,
      methods: o.methods || [],
      parents: o.parents || [],
      children: o.children || [],
      keys: fields.filter((f) => f.isKey).map((f) => f.name),
    };
  });

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
      exportId: 'Arivu.Metadata.Introspect',
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

  const latest = await TallyMetadataSnapshot.findOne({
    organizationId,
    companyGuid,
  }).sort({ version: -1 });

  if (latest && latest.contentHash === contentHash && latest.status === 'ready') {
    return { snapshot: latest, unchanged: true, diff: null };
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

  return { snapshot, unchanged: false, diff };
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

async function getObjectSchema({ organizationId, companyGuid, objectKey }) {
  return TallyObjectSchema.findOne({
    organizationId,
    companyGuid,
    objectKey: String(objectKey).toLowerCase(),
  }).lean();
}

module.exports = {
  BOOTSTRAP_OBJECTS,
  SUPPORT_TIERS,
  normalizeDiscoveryPayload,
  enqueueMetadataDiscovery,
  applyDiscoveryResult,
  getActiveSnapshot,
  listObjectSchemas,
  getObjectSchema,
  inferSupportTier,
  hashPayload,
};
