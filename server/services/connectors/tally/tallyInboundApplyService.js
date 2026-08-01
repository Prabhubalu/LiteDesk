'use strict';

/**
 * Apply inbound Tally export XML into ConnectorExternalObject catalog
 * with full field extraction (not NAME-only).
 */

const ConnectorExternalObject = require('../../../models/ConnectorExternalObject');
const { CONNECTOR_KEYS } = require('../connectorConstants');
const partyMapper = require('./mappers/partyMapper');
const stockItemMapper = require('./mappers/stockItemMapper');
const godownMapper = require('./mappers/godownMapper');
const stockGroupMapper = require('./mappers/stockGroupMapper');

/** Exact masterType → catalog entity */
const MASTER_ENTITY = Object.freeze({
  Ledger: { entityType: 'party', idPrefix: 'tally:ledger', limit: 500, mapParty: true },
  GstDutyLedger: { entityType: 'party', idPrefix: 'tally:ledger', limit: 500, mapParty: true },
  Group: { entityType: 'group', idPrefix: 'tally:group', limit: 500, referenceOnly: true },
  Currency: { entityType: 'currency', idPrefix: 'tally:currency', limit: 100, referenceOnly: true },
  VoucherType: { entityType: 'voucher_type', idPrefix: 'tally:vouchertype', limit: 200, referenceOnly: true },
  CostCategory: { entityType: 'cost_category', idPrefix: 'tally:costcategory', limit: 200, referenceOnly: true },
  CostCentre: { entityType: 'cost_centre', idPrefix: 'tally:costcentre', limit: 500, referenceOnly: true },
  Unit: { entityType: 'unit', idPrefix: 'tally:unit', limit: 200, referenceOnly: true },
  AttendanceType: { entityType: 'attendance_type', idPrefix: 'tally:attendance', limit: 100, referenceOnly: true },
  StockGroup: { entityType: 'stock_group', idPrefix: 'tally:stockgroup', limit: 300 },
  StockCategory: { entityType: 'stock_category', idPrefix: 'tally:stockcategory', limit: 300 },
  StockItem: { entityType: 'item', idPrefix: 'tally:item', limit: 500, mapItem: true },
  StockSummary: { entityType: 'item', idPrefix: 'tally:item', limit: 500, mapItem: true },
  Godown: { entityType: 'godown', idPrefix: 'tally:godown', limit: 200, mapGodown: true },
  Batch: { entityType: 'batch', idPrefix: 'tally:batch', limit: 500, referenceOnly: true },
  GSTClassification: { entityType: 'gst_classification', idPrefix: 'tally:gstclass', limit: 300, referenceOnly: true },
  TaxUnit: { entityType: 'tax_unit', idPrefix: 'tally:taxunit', limit: 100, referenceOnly: true },
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

function firstTag(xml, tag) {
  const values = extractTagValues(xml, tag);
  return values[0] || null;
}

function parseAddress(block) {
  const parts = extractTagValues(block, 'ADDRESS');
  return parts.length ? parts.join(', ') : null;
}

/**
 * Split XML into top-level object blocks for a given tag (LEDGER, STOCKITEM, …).
 */
function splitObjectBlocks(xml, tagName) {
  const re = new RegExp(`<${tagName}\\b[^>]*>[\\s\\S]*?<\\/${tagName}>`, 'gi');
  return String(xml || '').match(re) || [];
}

function parseMasterObject(block) {
  const name =
    firstTag(block, 'NAME') ||
    (block.match(/\bNAME="([^"]+)"/i) || [])[1] ||
    null;
  return {
    name,
    NAME: name,
    PARENT: firstTag(block, 'PARENT'),
    parent: firstTag(block, 'PARENT'),
    GUID: firstTag(block, 'GUID'),
    MASTERID: firstTag(block, 'MASTERID'),
    ALTERID: firstTag(block, 'ALTERID'),
    PARTYGSTIN: firstTag(block, 'PARTYGSTIN') || firstTag(block, 'GSTIN'),
    GSTIN: firstTag(block, 'GSTIN') || firstTag(block, 'PARTYGSTIN'),
    GSTREGISTRATIONTYPE: firstTag(block, 'GSTREGISTRATIONTYPE'),
    LEDGERSTATENAME: firstTag(block, 'LEDGERSTATENAME') || firstTag(block, 'LEDSTATENAME') || firstTag(block, 'STATECODE'),
    STATECODE: firstTag(block, 'STATECODE') || firstTag(block, 'LEDGERSTATENAME') || firstTag(block, 'LEDSTATENAME'),
    LEDSTATENAME: firstTag(block, 'LEDSTATENAME') || firstTag(block, 'LEDGERSTATENAME'),
    PINCODE: firstTag(block, 'PINCODE'),
    COUNTRYNAME: firstTag(block, 'COUNTRYNAME') || firstTag(block, 'COUNTRY'),
    MAILINGNAME: firstTag(block, 'MAILINGNAME'),
    EMAILCC: firstTag(block, 'EMAILCC'),
    FAX: firstTag(block, 'FAX'),
    LEDGERMOBILE: firstTag(block, 'LEDGERMOBILE') || firstTag(block, 'MOBILE'),
    CREDITLIMIT: firstTag(block, 'CREDITLIMIT'),
    BILLCREDITPERIOD: firstTag(block, 'BILLCREDITPERIOD'),
    NARRATION: firstTag(block, 'NARRATION') || firstTag(block, 'DESCRIPTION'),
    LEDGERPHONE: firstTag(block, 'LEDGERPHONE') || firstTag(block, 'PHONE'),
    EMAIL: firstTag(block, 'EMAIL'),
    WEBSITE: firstTag(block, 'WEBSITE'),
    INCOMETAXNUMBER: firstTag(block, 'INCOMETAXNUMBER'),
    ADDRESS: parseAddress(block),
    address: parseAddress(block),
    BASEUNITS: firstTag(block, 'BASEUNITS'),
    HSNCODE: firstTag(block, 'HSNCODE') || firstTag(block, 'HSN'),
    GSTRATE: firstTag(block, 'GSTRATE'),
    GSTAPPLICABLE: firstTag(block, 'GSTAPPLICABLE'),
    RATE: firstTag(block, 'RATE'),
    BARCODE: firstTag(block, 'BARCODE'),
    COSTINGMETHOD: firstTag(block, 'COSTINGMETHOD'),
    OPENINGBALANCE: firstTag(block, 'OPENINGBALANCE'),
    CLOSINGBALANCE: firstTag(block, 'CLOSINGBALANCE'),
    ORIGINALNAME: firstTag(block, 'ORIGINALNAME'),
    ISSIMPLEUNIT: firstTag(block, 'ISSIMPLEUNIT'),
    DECIMALPLACES: firstTag(block, 'DECIMALPLACES'),
    ISOCURRENCYCODE: firstTag(block, 'ISOCURRENCYCODE'),
    SYMBOL: firstTag(block, 'SYMBOL'),
    CATEGORY: firstTag(block, 'CATEGORY'),
  };
}

function parseVoucherBlock(block) {
  const inventoryBlocks = splitObjectBlocks(block, 'ALLINVENTORYENTRIES.LIST').concat(
    splitObjectBlocks(block, 'INVENTORYENTRIES.LIST')
  );
  const inventoryEntries = inventoryBlocks.map((ib) => ({
    stockItemName: firstTag(ib, 'STOCKITEMNAME'),
    quantity: firstTag(ib, 'ACTUALQTY') || firstTag(ib, 'BILLEDQTY'),
    rate: firstTag(ib, 'RATE'),
    amount: firstTag(ib, 'AMOUNT'),
    godownName: firstTag(ib, 'GODOWNNAME'),
  }));

  return {
    guid: firstTag(block, 'GUID'),
    voucherNumber: firstTag(block, 'VOUCHERNUMBER'),
    voucherType: firstTag(block, 'VOUCHERTYPENAME'),
    date: firstTag(block, 'DATE'),
    reference: firstTag(block, 'REFERENCE'),
    narration: firstTag(block, 'NARRATION'),
    partyLedgerName: firstTag(block, 'PARTYLEDGERNAME'),
    partyGstin: firstTag(block, 'PARTYGSTIN'),
    placeOfSupply: firstTag(block, 'PLACEOFSUPPLY'),
    irn: firstTag(block, 'IRN'),
    amount: firstTag(block, 'AMOUNT'),
    isCancelled: firstTag(block, 'ISCANCELLED'),
    MASTERID: firstTag(block, 'MASTERID'),
    ALTERID: firstTag(block, 'ALTERID'),
    inventoryEntries,
    companyGuid: null,
  };
}

function parseNames(xml) {
  const names = extractTagValues(xml, 'NAME');
  return [...new Set(names)].filter((n) => n.length > 1 && n.length < 200);
}

function parseVoucherKeys(xml) {
  const blocks = splitObjectBlocks(xml, 'VOUCHER');
  if (blocks.length) {
    const keys = [];
    const seen = new Set();
    for (const block of blocks) {
      const v = parseVoucherBlock(block);
      const key = (v.guid || (v.voucherNumber ? `${v.voucherType || 'vch'}:${v.voucherNumber}` : null) || '')
        .toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      keys.push({ key, ...v });
    }
    return keys;
  }
  // Fallback legacy
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
    if (key) keys.push({ key: String(key).toLowerCase(), guid, voucherNumber, voucherType });
  }
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
  };
  if (byExport[mt]) return { key: byExport[mt], spec: MASTER_ENTITY[byExport[mt]] };

  if (/ledger/i.test(mt)) return { key: 'Ledger', spec: MASTER_ENTITY.Ledger };
  if (/stock\s*group/i.test(mt)) return { key: 'StockGroup', spec: MASTER_ENTITY.StockGroup };
  if (/stock\s*item|stockitem/i.test(mt)) return { key: 'StockItem', spec: MASTER_ENTITY.StockItem };
  if (/godown/i.test(mt)) return { key: 'Godown', spec: MASTER_ENTITY.Godown };
  if (/voucher/i.test(mt)) return { key: 'Voucher', spec: MASTER_ENTITY.Voucher };
  return null;
}

function tagForMaster(key) {
  const map = {
    Ledger: 'LEDGER',
    GstDutyLedger: 'LEDGER',
    Group: 'GROUP',
    Currency: 'CURRENCY',
    VoucherType: 'VOUCHERTYPE',
    CostCategory: 'COSTCATEGORY',
    CostCentre: 'COSTCENTRE',
    Unit: 'UNIT',
    AttendanceType: 'ATTENDANCETYPE',
    StockGroup: 'STOCKGROUP',
    StockCategory: 'STOCKCATEGORY',
    StockItem: 'STOCKITEM',
    StockSummary: 'STOCKITEM',
    Godown: 'GODOWN',
    Batch: 'BATCH',
    GSTClassification: 'GSTCLASSIFICATION',
    TaxUnit: 'TAXUNIT',
  };
  return map[key] || null;
}

function mapRemotePayload(spec, raw) {
  const tallyValues = { ...raw };
  if (spec.mapParty) {
    return {
      ...tallyValues,
      ...partyMapper.fromTally(raw),
      name: raw.name || raw.NAME,
      tallyValues,
    };
  }
  if (spec.mapItem) {
    return {
      ...tallyValues,
      ...stockItemMapper.fromTally(raw),
      name: raw.name || raw.NAME,
      tallyValues,
    };
  }
  if (spec.mapGodown) {
    return {
      ...tallyValues,
      ...godownMapper.fromTally(raw),
      name: raw.name || raw.NAME,
      tallyValues,
    };
  }
  if (spec.entityType === 'stock_group' || spec.entityType === 'stock_category') {
    return {
      ...tallyValues,
      ...stockGroupMapper.fromTally(raw),
      name: raw.name || raw.NAME,
      tallyValues,
    };
  }
  return {
    name: raw.name || raw.NAME,
    parent: raw.PARENT || raw.parent,
    guid: raw.GUID,
    masterId: raw.MASTERID,
    alterId: raw.ALTERID,
    ...tallyValues,
    tallyValues,
  };
}

async function upsertExternal({
  organizationId,
  entityType,
  externalId,
  companyGuid,
  remotePayload,
  jobId,
  referenceOnly = false,
}) {
  const existing = await ConnectorExternalObject.findOne({
    organizationId,
    connectorKey: CONNECTOR_KEYS.TALLY,
    entityType,
    externalId,
  });
  if (existing) {
    existing.metadata = {
      ...(existing.metadata || {}),
      remotePayload,
      lastInboundJobId: jobId ? String(jobId) : existing.metadata?.lastInboundJobId,
      referenceOnly: referenceOnly || existing.metadata?.referenceOnly,
      companyGuid: companyGuid || existing.metadata?.companyGuid,
    };
    existing.markModified('metadata');
    await existing.save();
    return { upserted: false, row: existing };
  }

  const row = await ConnectorExternalObject.create({
    organizationId,
    connectorKey: CONNECTOR_KEYS.TALLY,
    entityType,
    externalId,
    arivuId: referenceOnly ? `ref:${externalId}` : `pending:${externalId}`,
    companyGuid: companyGuid || null,
    lastDirection: 'inbound',
    metadata: {
      remotePayload,
      lastInboundJobId: jobId ? String(jobId) : null,
      referenceOnly: Boolean(referenceOnly),
      companyGuid,
    },
  });
  return { upserted: true, row };
}

async function applyInboundExport({
  organizationId,
  companyGuid = null,
  masterType = 'Ledger',
  body = '',
  records = null,
  jobId = null,
  limitOverride = null,
  sinceAlterId = null,
} = {}) {
  const xml = String(body || '');
  const preParsed = Array.isArray(records) ? records.filter((r) => r && (r.name || r.NAME)) : [];
  if (!preParsed.length && (!xml || xml.length < 20)) {
    return { applied: 0, created: 0, skipped: true };
  }

  const resolved = resolveMasterSpec(masterType);
  if (!resolved?.spec) {
    return { applied: 0, created: 0, skipped: true, reason: 'unknown_master_type', masterType };
  }

  const { key, spec } = resolved;
  const limit = limitOverride || spec.limit || 500;
  let applied = 0;
  let created = 0;
  let updated = 0;

  if (spec.voucher) {
    const vouchers = [];
    for (const row of parseVoucherKeys(xml).slice(0, limit)) {
      const externalId = `${spec.idPrefix}:${row.key}`;
      // eslint-disable-next-line no-await-in-loop
      const r = await upsertExternal({
        organizationId,
        entityType: spec.entityType,
        externalId,
        companyGuid,
        remotePayload: row,
        jobId,
      });
      applied += 1;
      if (r.upserted) created += 1;
      else updated += 1;
      vouchers.push({ ...row, _externalObjectId: String(r.row._id) });
    }

    let materialize = null;
    try {
      const { maybeMaterializeInboundVouchers } = require('./engines/inboundVoucherMaterialize');
      materialize = await maybeMaterializeInboundVouchers({
        organizationId,
        companyGuid,
        vouchers,
        jobId,
      });
    } catch (err) {
      console.warn('[tallyInboundApply] voucher materialize failed', err.message);
    }

    return { applied, created, updated, masterType: key, vouchers, materialize };
  }

  const tag = tagForMaster(key);
  const blocks = !preParsed.length && tag ? splitObjectBlocks(xml, tag) : [];
  const objects = preParsed.length
    ? preParsed.map((o) => {
        const row = {
          ...o,
          name: o.name || o.NAME,
          NAME: o.NAME || o.name,
        };
        // Canonicalize common Tally tag aliases (LedStateName vs LedgerStateName, nested GSTIN, …)
        if (row.LEDSTATENAME && !row.LEDGERSTATENAME) row.LEDGERSTATENAME = row.LEDSTATENAME;
        if (row.LEDGERSTATENAME && !row.LEDSTATENAME) row.LEDSTATENAME = row.LEDGERSTATENAME;
        if (row.GSTIN && !row.PARTYGSTIN) row.PARTYGSTIN = row.GSTIN;
        if (row.PARTYGSTIN && !row.GSTIN) row.GSTIN = row.PARTYGSTIN;
        return row;
      })
    : blocks.length
      ? blocks.map(parseMasterObject).filter((o) => o.name)
      : parseNames(xml).map((name) => ({ name, NAME: name }));

  for (const raw of objects.slice(0, limit)) {
    const alterNum = Number(raw.ALTERID || raw.alterId);
    if (
      sinceAlterId != null &&
      String(sinceAlterId).trim() !== '' &&
      !Number.isNaN(alterNum) &&
      alterNum <= Number(sinceAlterId)
    ) {
      continue;
    }
    const nameKey = String(raw.name || raw.NAME || '').toLowerCase();
    if (!nameKey) continue;
    const externalId = `${spec.idPrefix}:${nameKey}`;
    const remotePayload = mapRemotePayload(spec, raw);
    // eslint-disable-next-line no-await-in-loop
    const r = await upsertExternal({
      organizationId,
      entityType: spec.entityType,
      externalId,
      companyGuid,
      remotePayload,
      jobId,
      referenceOnly: Boolean(spec.referenceOnly),
    });
    applied += 1;
    if (r.upserted) created += 1;
    else updated += 1;

    try {
      const { postProcessInboundRow } = require('./tallyMappingService');
      // eslint-disable-next-line no-await-in-loop
      await postProcessInboundRow({
        organizationId,
        row: r.row,
        name: raw.name || raw.NAME,
        entityType: spec.entityType,
        companyGuid,
      });
    } catch {
      /* non-fatal */
    }
  }

  // Advance AlterID watermark for change detection
  try {
    const maxAlter = objects.reduce((max, o) => {
      const n = Number(o.ALTERID || o.alterId);
      if (!Number.isNaN(n) && (max == null || n > max)) return n;
      return max;
    }, null);
    if (maxAlter != null && companyGuid) {
      const changeDetectionEngine = require('./engines/changeDetectionEngine');
      const moduleKey = String(spec.entityType || key || '')
        .toLowerCase()
        .replace(/^party$/, 'ledger')
        .replace(/^item$/, 'stock_item');
      await changeDetectionEngine.advanceWatermark({
        organizationId,
        companyGuid,
        tallyModuleKey: moduleKey,
        lastAlterId: String(maxAlter),
      });
    }
  } catch {
    /* non-fatal */
  }

  return { applied, created, updated, masterType: key };
}

module.exports = {
  applyInboundExport,
  parseNames,
  parseVoucherKeys,
  parseMasterObject,
  resolveMasterSpec,
  MASTER_ENTITY,
};
