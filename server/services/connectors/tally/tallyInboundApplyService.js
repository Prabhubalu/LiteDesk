'use strict';

/**
 * Apply inbound Tally export XML (from agent ack) into Arivu external-object catalog.
 * Creates pending links (arivuId = pending:…) until mapping review binds them.
 */

const ConnectorExternalObject = require('../../../models/ConnectorExternalObject');
const { CONNECTOR_KEYS } = require('../connectorConstants');
const partyMapper = require('./mappers/partyMapper');

/** Exact masterType → catalog entity (order matters — avoid /stock/ catching StockGroup). */
const MASTER_ENTITY = Object.freeze({
  Ledger: { entityType: 'party', idPrefix: 'tally:ledger', limit: 500, mapParty: true },
  GstDutyLedger: { entityType: 'party', idPrefix: 'tally:ledger', limit: 500, mapParty: true },
  Group: { entityType: 'group', idPrefix: 'tally:group', limit: 500 },
  Currency: { entityType: 'currency', idPrefix: 'tally:currency', limit: 100 },
  VoucherType: { entityType: 'voucher_type', idPrefix: 'tally:vouchertype', limit: 200 },
  CostCategory: { entityType: 'cost_category', idPrefix: 'tally:costcategory', limit: 200 },
  CostCentre: { entityType: 'cost_centre', idPrefix: 'tally:costcentre', limit: 500 },
  Unit: { entityType: 'unit', idPrefix: 'tally:unit', limit: 200 },
  AttendanceType: { entityType: 'attendance_type', idPrefix: 'tally:attendance', limit: 100 },
  StockGroup: { entityType: 'stock_group', idPrefix: 'tally:stockgroup', limit: 300 },
  StockCategory: { entityType: 'stock_category', idPrefix: 'tally:stockcategory', limit: 300 },
  StockItem: { entityType: 'item', idPrefix: 'tally:item', limit: 500 },
  StockSummary: { entityType: 'item', idPrefix: 'tally:item', limit: 500 },
  Godown: { entityType: 'godown', idPrefix: 'tally:godown', limit: 200 },
  Batch: { entityType: 'batch', idPrefix: 'tally:batch', limit: 500 },
  GSTClassification: { entityType: 'gst_classification', idPrefix: 'tally:gstclass', limit: 300 },
  TaxUnit: { entityType: 'tax_unit', idPrefix: 'tally:taxunit', limit: 100 },
  Voucher: { entityType: 'voucher', idPrefix: 'tally:voucher', limit: 1000, voucher: true },
});

function extractTagValues(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'gi');
  const values = [];
  let m;
  while ((m = re.exec(String(xml || ''))) !== null) {
    const v = String(m[1] || '').trim();
    if (v) values.push(v);
  }
  return values;
}

function parseNames(xml) {
  const names = extractTagValues(xml, 'NAME');
  return [...new Set(names)].filter((n) => n.length > 1 && n.length < 200);
}

function parseVoucherKeys(xml) {
  const guids = extractTagValues(xml, 'GUID');
  const numbers = extractTagValues(xml, 'VOUCHERNUMBER');
  const types = extractTagValues(xml, 'VOUCHERTYPENAME');
  const keys = [];
  const n = Math.max(guids.length, numbers.length);
  for (let i = 0; i < n; i += 1) {
    const guid = guids[i] || null;
    const voucherNumber = numbers[i] || null;
    const voucherType = types[i] || null;
    const key = guid || (voucherNumber ? `${voucherType || 'vch'}:${voucherNumber}` : null);
    if (key) {
      keys.push({
        key: String(key).toLowerCase(),
        guid,
        voucherNumber,
        voucherType,
      });
    }
  }
  // De-dupe by key
  const seen = new Set();
  return keys.filter((k) => {
    if (seen.has(k.key)) return false;
    seen.add(k.key);
    return true;
  });
}

function resolveMasterSpec(masterType) {
  const mt = String(masterType || '').trim();
  if (MASTER_ENTITY[mt]) return { key: mt, spec: MASTER_ENTITY[mt] };

  // Collection ID fallbacks (exportId passed as masterType)
  const byExport = {
    'Arivu List of Ledgers': 'Ledger',
    'Arivu List of GST Duty Ledgers': 'GstDutyLedger',
    'Arivu List of Groups': 'Group',
    'Arivu List of Currencies': 'Currency',
    'Arivu List of Voucher Types': 'VoucherType',
    'Arivu List of Cost Categories': 'CostCategory',
    'Arivu List of Cost Centres': 'CostCentre',
    'Arivu List of Units': 'Unit',
    'Arivu List of Attendance Types': 'AttendanceType',
    'Arivu List of Stock Groups': 'StockGroup',
    'Arivu List of Stock Categories': 'StockCategory',
    'Arivu List of Stock Items': 'StockItem',
    'Arivu Stock Summary': 'StockSummary',
    'Arivu List of Godowns': 'Godown',
    'Arivu List of Batches': 'Batch',
    'Arivu List of GST Classifications': 'GSTClassification',
    'Arivu List of Tax Units': 'TaxUnit',
    'Arivu List of Vouchers': 'Voucher',
    'Arivu Sales Vouchers': 'Voucher',
    'Arivu Purchase Vouchers': 'Voucher',
    'Arivu Payment Vouchers': 'Voucher',
    'Arivu Receipt Vouchers': 'Voucher',
    'Arivu Journal Vouchers': 'Voucher',
    'Arivu Contra Vouchers': 'Voucher',
    'Arivu Credit Note Vouchers': 'Voucher',
    'Arivu Debit Note Vouchers': 'Voucher',
    'Arivu Stock Journal Vouchers': 'Voucher',
    'Arivu Delivery Note Vouchers': 'Voucher',
    'Arivu Receipt Note Vouchers': 'Voucher',
  };
  if (byExport[mt]) {
    const key = byExport[mt];
    return { key, spec: MASTER_ENTITY[key] };
  }

  if (/voucher/i.test(mt)) return { key: 'Voucher', spec: MASTER_ENTITY.Voucher };
  if (/ledger/i.test(mt)) return { key: 'Ledger', spec: MASTER_ENTITY.Ledger };
  if (/godown/i.test(mt)) return { key: 'Godown', spec: MASTER_ENTITY.Godown };
  if (/stock\s*item|stockitem/i.test(mt)) return { key: 'StockItem', spec: MASTER_ENTITY.StockItem };
  return null;
}

async function upsertExternal({
  organizationId,
  entityType,
  externalId,
  companyGuid,
  remotePayload,
  jobId,
}) {
  const pendingArivuId = `pending:${externalId}`;
  const existing = await ConnectorExternalObject.findOne({
    organizationId,
    connectorKey: CONNECTOR_KEYS.TALLY,
    entityType,
    externalId,
    companyGuid: companyGuid || null,
  });
  if (existing) {
    existing.lastSyncedAt = new Date();
    existing.lastDirection = 'inbound';
    existing.metadata = {
      ...(existing.metadata || {}),
      remotePayload,
      lastJobId: jobId,
    };
    await existing.save();
    const { postProcessInboundRow } = require('./tallyMappingService');
    await postProcessInboundRow({
      organizationId,
      row: existing,
      name: remotePayload?.name || remotePayload?.NAME,
      entityType,
      companyGuid,
    });
    return { upserted: false, row: existing };
  }

  const row = await ConnectorExternalObject.create({
    organizationId,
    connectorKey: CONNECTOR_KEYS.TALLY,
    entityType,
    arivuId: pendingArivuId,
    externalId,
    companyGuid: companyGuid || null,
    lastSyncedAt: new Date(),
    lastDirection: 'inbound',
    metadata: { remotePayload, source: 'inbound_export', jobId },
  });
  const { postProcessInboundRow } = require('./tallyMappingService');
  await postProcessInboundRow({
    organizationId,
    row,
    name: remotePayload?.name || remotePayload?.NAME,
    entityType,
    companyGuid,
  });
  return { upserted: true, row };
}

async function applyInboundExport({
  organizationId,
  companyGuid = null,
  masterType = 'Ledger',
  body = '',
  jobId = null,
} = {}) {
  const xml = String(body || '');
  if (!xml || xml.length < 20) {
    return { applied: 0, created: 0, skipped: true };
  }

  const resolved = resolveMasterSpec(masterType);
  if (!resolved?.spec) {
    return { applied: 0, created: 0, skipped: true, reason: 'unknown_master_type', masterType };
  }

  const { key, spec } = resolved;
  let applied = 0;
  let created = 0;

  if (spec.voucher) {
    for (const row of parseVoucherKeys(xml).slice(0, spec.limit)) {
      const externalId = `${spec.idPrefix}:${row.key}`;
      // eslint-disable-next-line no-await-in-loop
      const r = await upsertExternal({
        organizationId,
        entityType: spec.entityType,
        externalId,
        companyGuid,
        remotePayload: {
          guid: row.guid,
          voucherNumber: row.voucherNumber,
          voucherType: row.voucherType,
        },
        jobId,
      });
      applied += 1;
      if (r.upserted) created += 1;
    }
    return { applied, created, masterType: key };
  }

  for (const name of parseNames(xml).slice(0, spec.limit)) {
    const externalId = `${spec.idPrefix}:${name.toLowerCase()}`;
    const remotePayload = spec.mapParty
      ? partyMapper.fromTally({ name, NAME: name })
      : { name };
    // eslint-disable-next-line no-await-in-loop
    const r = await upsertExternal({
      organizationId,
      entityType: spec.entityType,
      externalId,
      companyGuid,
      remotePayload,
      jobId,
    });
    applied += 1;
    if (r.upserted) created += 1;
  }

  return { applied, created, masterType: key };
}

module.exports = {
  applyInboundExport,
  parseNames,
  parseVoucherKeys,
  resolveMasterSpec,
  MASTER_ENTITY,
};
