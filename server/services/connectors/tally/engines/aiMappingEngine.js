'use strict';

/**
 * ATIP AI Mapping Engine — confidence-scored field suggestions.
 * Heuristic + optional LLM assist (feature-flagged).
 */

const { getMergedSettings } = require('../tallyModuleMappingService');

/** Common Tally → Arivu synonyms for party/item/voucher fields. */
const SYNONYM_MAP = Object.freeze({
  NAME: ['name', 'displayName', 'title', 'ledgerName', 'itemName'],
  PARENT: ['types', 'parent', 'parentId', 'category', 'group'],
  GSTIN: ['gstin', 'gstNumber', 'taxId'],
  GSTREGISTRATIONTYPE: ['gstRegistrationType', 'gstType'],
  LEDGERSTATENAME: ['stateCode', 'state', 'billingAddressStructured.state'],
  ADDRESS: ['address', 'billingAddress', 'billingAddressStructured.line1'],
  LEDGERPHONE: ['phone', 'phoneNumber'],
  EMAIL: ['email', 'emailAddress'],
  PINCODE: ['postalCode', 'billingAddressStructured.postalCode', 'zip'],
  INCOMETAXNUMBER: ['pan', 'taxId', 'panNumber'],
  GUID: ['externalReferenceId', 'tallyGuid', 'externalId'],
  MASTERID: ['tallyMasterId', 'externalMasterId'],
  BASEUNITS: ['unit_of_measure', 'uom', 'baseUnit'],
  HSNCODE: ['hsnCode', 'hsn', 'hsnSac'],
  PARTYLEDGERNAME: ['partyName', 'organizationId', 'customerName', 'vendorName'],
  VOUCHERNUMBER: ['invoiceNumber', 'documentNumber', 'number'],
  DATE: ['invoiceDate', 'date', 'documentDate', 'orderDate'],
  REFERENCE: ['reference', 'referenceNumber', 'externalReference'],
  NARRATION: ['notes', 'narration', 'description', 'memo'],
  AMOUNT: ['amount', 'total', 'grandTotal'],
});

const ARIVU_FIELDS_BY_ENTITY = Object.freeze({
  party: ['name', 'types', 'gstin', 'gstRegistrationType', 'stateCode', 'address', 'phone', 'email', 'website', 'taxId', 'externalReferenceId', 'billingAddressStructured.line1', 'billingAddressStructured.city', 'billingAddressStructured.state', 'billingAddressStructured.postalCode', 'billingAddressStructured.country', 'paymentTerms'],
  item: ['name', 'sku', 'description', 'unit_of_measure', 'hsnCode', 'gstApplicable', 'externalReferenceId', 'categoryId', 'isActive'],
  invoice: ['invoiceNumber', 'invoiceDate', 'organizationId', 'notes', 'externalReferenceId', 'placeOfSupply', 'gstin'],
  payment: ['amount', 'paymentDate', 'organizationId', 'reference', 'notes', 'externalReferenceId'],
  sales_order: ['orderNumber', 'orderDate', 'organizationId', 'notes', 'externalReferenceId'],
  purchase_order: ['orderNumber', 'orderDate', 'organizationId', 'notes', 'externalReferenceId'],
  purchase_bill: ['billNumber', 'billDate', 'organizationId', 'notes', 'externalReferenceId'],
  inventory_location: ['name', 'code', 'isDefault', 'isActive', 'externalReferenceId'],
  catalog_category: ['name', 'parentId', 'isActive', 'externalReferenceId'],
  godown: ['name', 'code', 'isDefault', 'externalReferenceId'],
  cost_centre: ['name', 'parentId', 'externalReferenceId'],
  journal_entry: ['entryNumber', 'entryDate', 'notes', 'externalReferenceId'],
  delivery_note: ['noteNumber', 'noteDate', 'organizationId', 'externalReferenceId'],
  receipt_note: ['noteNumber', 'noteDate', 'organizationId', 'externalReferenceId'],
  reference: ['name', 'externalReferenceId', 'parent'],
});

function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function scorePair(tallyField, arivuField) {
  const t = normalize(tallyField);
  const a = normalize(arivuField);
  if (!t || !a) return 0;
  if (t === a) return 0.99;
  if (t.includes(a) || a.includes(t)) return 0.88;

  const synonyms = SYNONYM_MAP[String(tallyField).toUpperCase()] || [];
  for (const syn of synonyms) {
    if (normalize(syn) === a) return 0.96;
    if (normalize(syn).includes(a) || a.includes(normalize(syn))) return 0.9;
  }

  // token overlap
  const tTokens = new Set(String(tallyField).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
  const aTokens = new Set(String(arivuField).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
  let overlap = 0;
  for (const tok of tTokens) if (aTokens.has(tok)) overlap += 1;
  if (overlap > 0) return Math.min(0.75, 0.45 + overlap * 0.15);
  return 0.05;
}

function suggestForSchema(schema) {
  const entityType = schema.arivuEntityType || 'reference';
  const arivuFields = ARIVU_FIELDS_BY_ENTITY[entityType] || ARIVU_FIELDS_BY_ENTITY.reference;
  const out = [];

  for (const field of schema.fields || []) {
    let best = { arivuField: null, confidence: 0 };
    for (const af of arivuFields) {
      const confidence = scorePair(field.name, af);
      if (confidence > best.confidence) best = { arivuField: af, confidence };
    }
    out.push({
      tallyField: field.name,
      arivuField: best.confidence >= 0.45 ? best.arivuField : null,
      confidence: Number(best.confidence.toFixed(3)),
      transform: { type: 'direct' },
      entityType,
      tallyObjectKey: schema.tallyObjectKey,
      validationRecommendation: field.required ? 'required' : null,
    });
  }
  return out;
}

async function suggestAll({ organizationId, companyGuid, schemas }) {
  const list = schemas || [];
  const all = [];
  for (const schema of list) {
    all.push(...suggestForSchema(schema));
  }

  // Optional LLM assist hook (no-op unless enabled)
  try {
    const settings = await getMergedSettings(organizationId);
    if (settings.aiMappingLlmAssist) {
      // Placeholder: keep heuristic results; LLM enrichment can wrap here later.
    }
  } catch {
    /* ignore */
  }

  return all;
}

async function suggestForObject({ schema }) {
  return suggestForSchema(schema);
}

module.exports = {
  SYNONYM_MAP,
  ARIVU_FIELDS_BY_ENTITY,
  scorePair,
  suggestAll,
  suggestForObject,
};
