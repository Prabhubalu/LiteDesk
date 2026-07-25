'use strict';

const ConnectorFieldMapping = require('../../../models/ConnectorFieldMapping');
const { CONNECTOR_KEYS } = require('../connectorConstants');

const DEFAULT_FIELD_CATALOGS = Object.freeze({
  party: {
    arivu: [
      'name',
      'gstin',
      'gstRegistrationType',
      'stateCode',
      'address',
      'phone',
      'website',
      'taxId',
      'types',
    ],
    external: [
      'NAME',
      'GSTIN',
      'GSTREGISTRATIONTYPE',
      'STATECODE',
      'ADDRESS',
      'LEDGERPHONE',
      'WEBSITE',
      'INCOMETAXNUMBER',
      'PARENT',
    ],
  },
  item: {
    arivu: [
      'variant_code',
      'unit_of_measure',
      'hsnSac',
      'gstRatePercent',
      'gstTaxability',
      'selling_price',
      'cost_price',
      'barcode',
    ],
    external: [
      'NAME',
      'BASEUNITS',
      'HSNCODE',
      'GSTRATE',
      'GSTAPPLICABLE',
      'RATE',
      'COSTINGMETHOD',
      'BARCODE',
      'PARENT',
    ],
  },
  godown: {
    arivu: ['name', 'locationCode', 'description', 'parentLocationId'],
    external: ['NAME', 'ADDRESS', 'PARENT'],
  },
  stock_group: {
    arivu: ['name', 'slug', 'parentId', 'path'],
    external: ['NAME', 'PARENT'],
  },
  invoice: {
    arivu: [
      'invoiceNumber',
      'invoiceDate',
      'partyGstin',
      'placeOfSupply',
      'grandTotal',
      'irn',
      'subtotal',
      'taxTotal',
    ],
    external: [
      'VOUCHERNUMBER',
      'DATE',
      'PARTYGSTIN',
      'PLACEOFSUPPLY',
      'AMOUNT',
      'IRN',
      'REFERENCE',
      'PARTYLEDGERNAME',
    ],
  },
  payment: {
    arivu: ['paymentNumber', 'amount', 'paymentDate', 'reference'],
    external: ['VOUCHERNUMBER', 'AMOUNT', 'DATE', 'REFERENCE', 'PARTYLEDGERNAME'],
  },
  receipt: {
    arivu: ['paymentNumber', 'amount', 'paymentDate', 'reference'],
    external: ['VOUCHERNUMBER', 'AMOUNT', 'DATE', 'REFERENCE', 'PARTYLEDGERNAME'],
  },
  purchase: {
    arivu: ['billNumber', 'billDate', 'partyGstin', 'grandTotal', 'reference'],
    external: ['VOUCHERNUMBER', 'DATE', 'PARTYGSTIN', 'AMOUNT', 'REFERENCE', 'PARTYLEDGERNAME'],
  },
  credit_note: {
    arivu: ['creditNoteNumber', 'date', 'partyGstin', 'grandTotal', 'reference'],
    external: ['VOUCHERNUMBER', 'DATE', 'PARTYGSTIN', 'AMOUNT', 'REFERENCE', 'PARTYLEDGERNAME'],
  },
  debit_note: {
    arivu: ['debitNoteNumber', 'date', 'partyGstin', 'grandTotal', 'reference'],
    external: ['VOUCHERNUMBER', 'DATE', 'PARTYGSTIN', 'AMOUNT', 'REFERENCE', 'PARTYLEDGERNAME'],
  },
  stock_journal: {
    arivu: ['transactionNumber', 'date', 'narration'],
    external: ['VOUCHERNUMBER', 'DATE', 'NARRATION', 'REFERENCE'],
  },
});

const MANUAL_ALIASES = Object.freeze({
  name: ['NAME', 'LEDGERNAME', 'PARTYNAME'],
  gstin: ['GSTIN', 'PARTYGSTIN'],
  statecode: ['STATECODE', 'STATENAME', 'PLACEOFSUPPLY'],
  placeofsupply: ['PLACEOFSUPPLY', 'STATECODE'],
  address: ['ADDRESS', 'LEDGERADDRESS'],
  phone: ['LEDGERPHONE', 'PHONE', 'MOBILE'],
  hsnsac: ['HSNCODE', 'HSN', 'SAC'],
  gstratepercent: ['GSTRATE', 'RATE'],
  unit_of_measure: ['BASEUNITS', 'UNITS', 'UOM'],
  variant_code: ['NAME', 'PARTNO'],
  selling_price: ['RATE', 'MRP'],
  locationcode: ['NAME'],
  invoicenumber: ['VOUCHERNUMBER', 'REFERENCE'],
  partygstin: ['PARTYGSTIN', 'GSTIN'],
  irn: ['IRN', 'IRNNUMBER'],
  grandtotal: ['AMOUNT', 'TOTAL'],
  parentid: ['PARENT'],
});

function normalizeKey(key) {
  return String(key || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function scoreMatch(arivuKey, externalKey) {
  const a = normalizeKey(arivuKey);
  const e = normalizeKey(externalKey);
  if (!a || !e) return 0;
  if (a === e) return 1;

  const aliases = MANUAL_ALIASES[a] || [];
  for (const alias of aliases) {
    if (normalizeKey(alias) === e) return 0.95;
  }

  if (a.includes(e) || e.includes(a)) return 0.8;

  // token overlap
  const aTokens = new Set(a.split(/(?=[A-Z])|_|-/).map(normalizeKey).filter(Boolean));
  // already normalized — split camel remnants by common words length heuristic
  const eTokens = new Set(
    e
      .replace(/(gstin|gst|hsn|sac|code|name|date|total|amount|phone|address)/g, ' $1 ')
      .split(/\s+/)
      .map(normalizeKey)
      .filter(Boolean)
  );

  let overlap = 0;
  for (const t of aTokens) {
    if (eTokens.has(t)) overlap += 1;
  }
  if (overlap > 0) {
    return Math.min(0.75, 0.4 + overlap * 0.15);
  }

  return 0;
}

/**
 * Suggest field mappings with confidence scores (heuristic name match).
 *
 * @param {{
 *   organizationId: string,
 *   entityType: string,
 *   arivuFields?: string[],
 *   externalFields?: string[],
 *   companyGuid?: string|null,
 *   minConfidence?: number
 * }} input
 */
function suggestMappings(input = {}) {
  const entityType = String(input.entityType || '').trim().toLowerCase();
  const catalog = DEFAULT_FIELD_CATALOGS[entityType] || { arivu: [], external: [] };
  const arivuFields = Array.isArray(input.arivuFields) && input.arivuFields.length
    ? input.arivuFields
    : catalog.arivu;
  const externalFields = Array.isArray(input.externalFields) && input.externalFields.length
    ? input.externalFields
    : catalog.external;
  const minConfidence = input.minConfidence != null ? Number(input.minConfidence) : 0.4;

  const suggestions = [];
  const usedExternal = new Set();

  for (const arivuFieldKey of arivuFields) {
    let best = null;
    for (const externalFieldKey of externalFields) {
      if (usedExternal.has(externalFieldKey)) continue;
      const confidence = scoreMatch(arivuFieldKey, externalFieldKey);
      if (!best || confidence > best.confidence) {
        best = { arivuFieldKey, externalFieldKey, confidence, transform: null };
      }
    }
    if (best && best.confidence >= minConfidence) {
      usedExternal.add(best.externalFieldKey);
      suggestions.push({
        ...best,
        approved: false,
        autoAccept: best.confidence >= 0.9,
      });
    } else {
      suggestions.push({
        arivuFieldKey,
        externalFieldKey: null,
        confidence: best ? best.confidence : 0,
        transform: null,
        approved: false,
        autoAccept: false,
      });
    }
  }

  return {
    organizationId: input.organizationId ? String(input.organizationId) : null,
    connectorKey: CONNECTOR_KEYS.TALLY,
    entityType,
    companyGuid: input.companyGuid || null,
    suggestions: suggestions.sort((a, b) => (b.confidence || 0) - (a.confidence || 0)),
  };
}

/**
 * Persist accepted mapping rules onto ConnectorFieldMapping.
 *
 * @param {{
 *   organizationId: string,
 *   entityType: string,
 *   companyGuid?: string|null,
 *   rules: Array<{ arivuFieldKey: string, externalFieldKey: string, transform?: string|null, confidence?: number }>,
 *   version?: number
 * }} input
 */
async function acceptMappings(input = {}) {
  const { organizationId, entityType, rules } = input;
  if (!organizationId || !entityType) {
    throw new Error('organizationId and entityType required');
  }
  if (!Array.isArray(rules) || !rules.length) {
    throw new Error('rules required');
  }

  const companyGuid = input.companyGuid || null;
  const version = input.version != null ? Number(input.version) : 1;

  const normalizedRules = rules
    .filter((r) => r && r.arivuFieldKey && r.externalFieldKey)
    .map((r) => ({
      arivuFieldKey: String(r.arivuFieldKey),
      externalFieldKey: String(r.externalFieldKey),
      transform: r.transform || null,
      confidence: r.confidence != null ? Number(r.confidence) : null,
      approved: true,
    }));

  const doc = await ConnectorFieldMapping.findOneAndUpdate(
    {
      organizationId,
      connectorKey: CONNECTOR_KEYS.TALLY,
      entityType: String(entityType).toLowerCase(),
      companyGuid,
      version,
    },
    {
      $set: {
        rules: normalizedRules,
        active: true,
        metadata: {
          ...(input.metadata || {}),
          acceptedAt: new Date().toISOString(),
        },
      },
      $setOnInsert: {
        organizationId,
        connectorKey: CONNECTOR_KEYS.TALLY,
        entityType: String(entityType).toLowerCase(),
        companyGuid,
        version,
      },
    },
    { upsert: true, new: true }
  );

  return doc;
}

module.exports = {
  suggestMappings,
  acceptMappings,
  scoreMatch,
  DEFAULT_FIELD_CATALOGS,
};
