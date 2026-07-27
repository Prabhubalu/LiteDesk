'use strict';

const ConnectorFieldMapping = require('../../../models/ConnectorFieldMapping');
const { CONNECTOR_KEYS } = require('../connectorConstants');
const {
  TALLY_FIELD_CATALOGS,
  FIELD_MAP_ENTITY_OPTIONS,
  ARIVU_EXTRA_FIELDS,
} = require('./tallyFieldCatalog');

/** Legacy short catalogs kept for backward compat; prefer TALLY_FIELD_CATALOGS. */
const DEFAULT_FIELD_CATALOGS = Object.freeze(
  Object.fromEntries(
    Object.entries(TALLY_FIELD_CATALOGS).map(([entityType, external]) => [
      entityType,
      {
        arivu: ARIVU_EXTRA_FIELDS[entityType] || [],
        external,
      },
    ])
  )
);

const MANUAL_ALIASES = Object.freeze({
  name: ['NAME', 'LEDGERNAME', 'PARTYNAME'],
  gstin: ['GSTIN', 'PARTYGSTIN'],
  gstregistrationtype: ['GSTREGISTRATIONTYPE'],
  statecode: ['STATECODE', 'STATENAME', 'LEDGERSTATENAME', 'PLACEOFSUPPLY'],
  placeofsupply: ['PLACEOFSUPPLY', 'STATECODE'],
  address: ['ADDRESS', 'LEDGERADDRESS'],
  billingaddressstructured: ['ADDRESS'],
  phone: ['LEDGERPHONE', 'PHONE', 'MOBILE'],
  email: ['EMAIL'],
  website: ['WEBSITE'],
  taxid: ['INCOMETAXNUMBER', 'INCOMETAXNO'],
  types: ['PARENT'],
  hsnsac: ['HSNCODE', 'HSN', 'SAC'],
  gstratepercent: ['GSTRATE', 'RATE'],
  gsttaxability: ['GSTAPPLICABLE'],
  unit_of_measure: ['BASEUNITS', 'UNITS', 'UOM'],
  variant_code: ['NAME', 'PARTNO'],
  item_name: ['NAME'],
  selling_price: ['RATE', 'MRP'],
  cost_price: ['COSTINGMETHOD', 'OPENINGRATE'],
  barcode: ['BARCODE', 'PARTNO'],
  locationcode: ['NAME'],
  description: ['ADDRESS', 'DESCRIPTION', 'NARRATION'],
  parentlocationid: ['PARENT'],
  parentid: ['PARENT'],
  category: ['PARENT', 'CATEGORY'],
  categoryid: ['PARENT'],
  invoicenumber: ['REFERENCE', 'VOUCHERNUMBER'],
  invoicedate: ['DATE'],
  partygstin: ['PARTYGSTIN', 'GSTIN'],
  irn: ['IRN', 'IRNNUMBER'],
  ackno: ['IRNACKNO'],
  ackdate: ['IRNACKDATE'],
  grandtotal: ['AMOUNT', 'TOTAL'],
  subtotal: ['AMOUNT'],
  taxtotal: ['AMOUNT'],
  paymentnumber: ['REFERENCE', 'VOUCHERNUMBER'],
  paymentdate: ['DATE'],
  amount: ['AMOUNT'],
  reference: ['REFERENCE'],
  partyledgername: ['PARTYLEDGERNAME'],
  billnumber: ['REFERENCE', 'VOUCHERNUMBER'],
  billdate: ['DATE'],
  journalnumber: ['REFERENCE', 'VOUCHERNUMBER'],
  journaldate: ['DATE'],
  narration: ['NARRATION'],
  transactionnumber: ['REFERENCE', 'VOUCHERNUMBER'],
  date: ['DATE'],
  externalreferenceid: ['GUID', 'MASTERID'],
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

  const aTokens = new Set(
    a
      .replace(/(gstin|gst|hsn|sac|code|name|date|total|amount|phone|address)/g, ' $1 ')
      .split(/\s+/)
      .map(normalizeKey)
      .filter(Boolean)
  );
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

function resolveArivuModuleKey(entityType) {
  const opt = FIELD_MAP_ENTITY_OPTIONS.find((o) => o.entityType === entityType);
  return opt?.arivuModuleKey || null;
}

function listArivuFieldsForEntity(entityType) {
  const et = String(entityType || '').toLowerCase();
  const ordered = [];
  const seen = new Set();
  const excludePrefix = /^(ai|encrypted|password|token|hash|internal)/i;
  const extras = ARIVU_EXTRA_FIELDS[et] || DEFAULT_FIELD_CATALOGS[et]?.arivu || [];
  const itemExtras = [
    'variant_code',
    'barcode',
    'unit_of_measure',
    'selling_price',
    'cost_price',
    'hsnSac',
    'gstRatePercent',
    'gstTaxability',
    'tax_type',
    'tax_percentage',
  ];

  const pushKey = (key) => {
    const k = String(key || '').trim();
    if (!k || seen.has(k)) return;
    if (k.includes('.')) return;
    if (excludePrefix.test(k)) return;
    seen.add(k);
    ordered.push(k);
  };

  const moduleKey = resolveArivuModuleKey(et);
  if (moduleKey) {
    try {
      const { getBaseFieldsForKey } = require('../../../controllers/moduleController');
      const base = getBaseFieldsForKey(moduleKey) || [];
      for (const f of base) {
        const key = f?.key ? String(f.key) : '';
        if (!key) continue;
        if (
          /Id$/.test(key) &&
          !['organizationRefId', 'customerId', 'parentLocationId', 'categoryId', 'parentId'].includes(key)
        ) {
          if (!extras.includes(key) && !(et === 'item' && itemExtras.includes(key))) continue;
        }
        pushKey(key);
      }
    } catch (_err) {
      // extras still apply
    }
  }

  for (const key of extras) {
    pushKey(key);
  }
  if (et === 'item') {
    for (const key of itemExtras) {
      pushKey(key);
    }
  }

  return ordered;
}

/** Optional display labels keyed by Arivu field key (module config order). */
function humanizeFieldKey(key) {
  return String(key || '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function isLookupLikeDataType(dataType) {
  const dt = String(dataType || '').toLowerCase();
  return (
    dt.includes('lookup') ||
    dt.includes('relationship') ||
    dt.includes('user') ||
    dt === 'file' ||
    dt === 'files'
  );
}

/** Meta for listed Arivu fields: label + whether mapping is mandatory. */
function listArivuFieldMetaForEntity(entityType) {
  const et = String(entityType || '').toLowerCase();
  const metaByKey = {};
  const moduleKey = resolveArivuModuleKey(et);
  if (moduleKey) {
    try {
      const { getBaseFieldsForKey } = require('../../../controllers/moduleController');
      for (const f of getBaseFieldsForKey(moduleKey) || []) {
        const key = f?.key ? String(f.key) : '';
        if (!key) continue;
        const label = f.label || f.name || f.title;
        const moduleRequired = Boolean(f.required || f.mandatory);
        // Lookups (e.g. Assigned To) are module-required but not Tally-mappable
        const required = moduleRequired && !isLookupLikeDataType(f.dataType);
        metaByKey[key] = {
          label: label ? String(label) : humanizeFieldKey(key),
          required,
        };
      }
    } catch (_err) {
      // ignore
    }
  }

  const ordered = listArivuFieldsForEntity(et);
  return ordered.map((key) => {
    const existing = metaByKey[key];
    return {
      key,
      label: existing?.label || humanizeFieldKey(key),
      required: Boolean(existing?.required),
    };
  });
}

function listArivuFieldLabelsForEntity(entityType) {
  const labels = {};
  for (const row of listArivuFieldMetaForEntity(entityType)) {
    labels[row.key] = row.label;
  }
  return labels;
}

function getUnmappedRequiredFields(entityType, rules = []) {
  const meta = listArivuFieldMetaForEntity(entityType);
  const mapped = new Map(
    (rules || [])
      .filter((r) => r && r.arivuFieldKey)
      .map((r) => [String(r.arivuFieldKey), r.externalFieldKey])
  );
  return meta
    .filter((m) => m.required)
    .filter((m) => !mapped.get(m.key))
    .map((m) => ({ key: m.key, label: m.label }));
}

function listTallyFieldsForEntity(entityType) {
  const et = String(entityType || '').toLowerCase();
  return [...(TALLY_FIELD_CATALOGS[et] || DEFAULT_FIELD_CATALOGS[et]?.external || [])];
}

function getEntityOptions() {
  return FIELD_MAP_ENTITY_OPTIONS.map((o) => ({
    entityType: o.entityType,
    label: `${o.tallyLabel} → ${o.arivuLabel}`,
    tallyLabel: o.tallyLabel,
    arivuLabel: o.arivuLabel,
    arivuModuleKey: o.arivuModuleKey,
  }));
}

function suggestMappings(input = {}) {
  const entityType = String(input.entityType || '').trim().toLowerCase();
  const arivuFields =
    Array.isArray(input.arivuFields) && input.arivuFields.length
      ? input.arivuFields
      : listArivuFieldsForEntity(entityType);
  const externalFields =
    Array.isArray(input.externalFields) && input.externalFields.length
      ? input.externalFields
      : listTallyFieldsForEntity(entityType);
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
        externalFieldKey: best && best.confidence > 0 ? best.externalFieldKey : null,
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
    // Keep module / catalog field order (do not re-sort by confidence)
    suggestions,
    arivuFields,
    tallyFields: externalFields,
  };
}

async function acceptMappings(input = {}) {
  const { organizationId, entityType, rules } = input;
  if (!organizationId || !entityType) {
    throw new Error('organizationId and entityType required');
  }
  if (!Array.isArray(rules) || !rules.length) {
    throw new Error('rules required');
  }

  const unmappedRequired = getUnmappedRequiredFields(entityType, rules);
  if (unmappedRequired.length) {
    const err = new Error(
      `Map all mandatory fields before saving: ${unmappedRequired.map((f) => f.label).join(', ')}`
    );
    err.code = 'MANDATORY_FIELDS_UNMAPPED';
    err.unmappedRequired = unmappedRequired;
    throw err;
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
  TALLY_FIELD_CATALOGS,
  listArivuFieldsForEntity,
  listArivuFieldLabelsForEntity,
  listArivuFieldMetaForEntity,
  getUnmappedRequiredFields,
  listTallyFieldsForEntity,
  getEntityOptions,
  FIELD_MAP_ENTITY_OPTIONS,
};
