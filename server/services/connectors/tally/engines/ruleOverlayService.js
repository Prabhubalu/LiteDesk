'use strict';

/**
 * ATIP rule overlay — merge stored field/tax mapping rules onto mapper payloads
 * before XML build. Hardcoded mappers remain the structural base; rules override fields.
 */

const mappingEngine = require('./mappingEngine');
const { applyRules, getByPath, setByPath, applyTransform } = require('./transformationEngine');

const ENTITY_FOR_OUTBOX = Object.freeze({
  party: 'party',
  ledger: 'party',
  item: 'item',
  stock: 'item',
  stock_item: 'item',
  godown: 'godown',
  inventory_location: 'godown',
  invoice: 'invoice',
  purchase_bill: 'purchase_bill',
  purchase: 'purchase_bill',
  payment: 'payment',
  receipt: 'payment',
  vendor_payment: 'payment',
  credit_note: 'invoice',
  debit_note: 'invoice',
  sales_order: 'sales_order',
  purchase_order: 'purchase_order',
  delivery_note: 'delivery_note',
  receipt_note: 'receipt_note',
  journal: 'journal_entry',
  journal_voucher: 'journal_entry',
  contra: 'journal_entry',
  contra_voucher: 'journal_entry',
});

/**
 * Apply ConnectorFieldMapping / TallyMappingVersion rules onto a tally-bound payload.
 * Rules: sourceField=tally tag, targetField=arivu field.
 * For outbound overlay we copy arivu→tally into the payload (payload is already tally-shaped
 * from mappers, so we only override keys that rules target).
 */
async function overlayFieldRules({
  organizationId,
  companyGuid = null,
  entityType,
  arivuRecord = null,
  tallyPayload = {},
}) {
  const mappedEntity = ENTITY_FOR_OUTBOX[String(entityType || '').toLowerCase()] || entityType;
  const rules = await mappingEngine.getRuntimeFieldRules({
    organizationId,
    companyGuid,
    entityType: mappedEntity,
  });

  if (!rules.length) {
    return { payload: tallyPayload, ruleCount: 0, source: 'mapper_only' };
  }

  const out = { ...tallyPayload };

  // Prefer values from arivuRecord when present; else keep mapper payload
  const source = arivuRecord && typeof arivuRecord === 'object' ? arivuRecord : tallyPayload;

  for (const rule of rules) {
    const tallyKey = rule.sourceField; // Tally XML field / payload key
    const arivuKey = rule.targetField;
    if (!tallyKey || !arivuKey) continue;

    let value = getByPath(source, arivuKey);
    if (value === undefined) value = getByPath(tallyPayload, arivuKey);
    if (value === undefined) continue;

    const transformed = applyTransform(value, rule.transform || { type: 'direct' }, 'toTally');
    // Map common arivu keys onto tally payload shape
    const payloadKey = normalizeTallyPayloadKey(tallyKey);
    setByPath(out, payloadKey, transformed);
  }

  return { payload: out, ruleCount: rules.length, source: 'mapper_plus_rules' };
}

function normalizeTallyPayloadKey(tallyField) {
  const upper = String(tallyField || '').toUpperCase();
  const map = {
    NAME: 'name',
    PARENT: 'parent',
    GSTIN: 'gstin',
    PARTYGSTIN: 'gstin',
    GSTREGISTRATIONTYPE: 'gstRegistrationType',
    LEDGERSTATENAME: 'stateCode',
    ADDRESS: 'address',
    LEDGERPHONE: 'phone',
    EMAIL: 'email',
    WEBSITE: 'website',
    INCOMETAXNUMBER: 'taxId',
    GUID: 'guid',
    BASEUNITS: 'baseUnits',
    HSNCODE: 'hsnCode',
    PARTYLEDGERNAME: 'partyLedgerName',
    VOUCHERNUMBER: 'voucherNumber',
    DATE: 'date',
    REFERENCE: 'reference',
    NARRATION: 'narration',
    PLACEOFSUPPLY: 'placeOfSupply',
    IRN: 'irn',
  };
  return map[upper] || tallyField;
}

/**
 * Attach GST duty ledger names from TallyTaxMapping onto voucher tax lines / ledgerEntries.
 */
async function overlayTaxLedgers({
  organizationId,
  companyGuid = null,
  tallyPayload = {},
}) {
  const taxMaps = await mappingEngine.getTaxMappings({ organizationId, companyGuid });
  if (!taxMaps.length) {
    return { payload: tallyPayload, taxRuleCount: 0 };
  }

  const byRate = new Map();
  const byCode = new Map();
  const byDuty = new Map();
  for (const m of taxMaps) {
    if (m.arivuTaxRatePercent != null) byRate.set(Number(m.arivuTaxRatePercent), m);
    if (m.arivuTaxCode) byCode.set(String(m.arivuTaxCode).toUpperCase(), m);
    if (m.tallyDutyHead) byDuty.set(String(m.tallyDutyHead).toUpperCase(), m);
  }

  const out = { ...tallyPayload };
  const ledgerEntries = Array.isArray(out.ledgerEntries) ? [...out.ledgerEntries] : [];
  const taxLedgers = [];

  const inventory = Array.isArray(out.inventoryEntries) ? out.inventoryEntries : [];
  for (const line of inventory) {
    const comps = line.gstComponents || {};
    const rate = Number(line.gstRatePercent ?? comps.ratePercent ?? 0) || 0;
    const mapping =
      byRate.get(rate) ||
      (line.hsnSac && byCode.get(String(line.hsnSac).toUpperCase())) ||
      null;

    if (comps.cgstAmount > 0) {
      const cgstMap = byDuty.get('CGST') || byCode.get('CGST') || mapping;
      taxLedgers.push({
        ledgerName: cgstMap?.tallyLedgerName || 'CGST',
        amount: Number(comps.cgstAmount) || 0,
        isPartyLedger: false,
        taxComponent: 'cgst',
      });
    }
    if (comps.sgstAmount > 0) {
      const sgstMap = byDuty.get('SGST') || byCode.get('SGST') || mapping;
      taxLedgers.push({
        ledgerName: sgstMap?.tallyLedgerName || 'SGST',
        amount: Number(comps.sgstAmount) || 0,
        isPartyLedger: false,
        taxComponent: 'sgst',
      });
    }
    if (comps.igstAmount > 0) {
      const igstMap = byDuty.get('IGST') || byCode.get('IGST') || mapping;
      taxLedgers.push({
        ledgerName: igstMap?.tallyLedgerName || 'IGST',
        amount: Number(comps.igstAmount) || 0,
        isPartyLedger: false,
        taxComponent: 'igst',
      });
    }
  }

  // Dedupe by ledger+component and sum
  const mergedTax = new Map();
  for (const t of taxLedgers) {
    const key = `${t.ledgerName}:${t.taxComponent}`;
    const prev = mergedTax.get(key);
    if (prev) prev.amount += t.amount;
    else mergedTax.set(key, { ...t });
  }

  const withoutOldTax = ledgerEntries.filter(
    (e) => !e.taxComponent && !/^(cgst|sgst|igst|gst)/i.test(String(e.ledgerName || ''))
  );
  out.ledgerEntries = [...withoutOldTax, ...mergedTax.values()];
  out.taxLedgerMappingsApplied = mergedTax.size;

  return { payload: out, taxRuleCount: mergedTax.size };
}

async function prepareOutboundPayload({
  organizationId,
  companyGuid = null,
  entityType,
  arivuRecord = null,
  tallyPayload = {},
}) {
  const fields = await overlayFieldRules({
    organizationId,
    companyGuid,
    entityType,
    arivuRecord,
    tallyPayload,
  });
  const isVoucher = [
    'invoice',
    'purchase_bill',
    'purchase',
    'payment',
    'receipt',
    'credit_note',
    'debit_note',
    'sales_order',
    'purchase_order',
    'delivery_note',
    'receipt_note',
  ].includes(String(entityType || '').toLowerCase());

  if (!isVoucher) {
    return fields;
  }

  const tax = await overlayTaxLedgers({
    organizationId,
    companyGuid,
    tallyPayload: fields.payload,
  });

  return {
    payload: tax.payload,
    ruleCount: fields.ruleCount,
    taxRuleCount: tax.taxRuleCount,
    source: fields.source,
  };
}

/** Normalize outbox operations to schema enum. */
function normalizeOutboxOperation(operation) {
  const op = String(operation || 'upsert').toLowerCase();
  if (op === 'push' || op === 'create' || op === 'upsert') return 'upsert';
  if (op === 'alter' || op === 'update' || op === 'cancel') return 'update';
  if (op === 'delete') return 'delete';
  return 'upsert';
}

module.exports = {
  ENTITY_FOR_OUTBOX,
  overlayFieldRules,
  overlayTaxLedgers,
  prepareOutboundPayload,
  normalizeOutboxOperation,
  normalizeTallyPayloadKey,
  applyRules,
};
