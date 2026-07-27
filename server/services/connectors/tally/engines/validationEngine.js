'use strict';

/**
 * ATIP Validation Engine — never enqueue invalid payloads to Tally / CRM.
 */

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

function issue(code, message, field = null, severity = 'error') {
  return { code, message, field, severity };
}

function validateGstin(value) {
  if (!value) return null;
  const v = String(value).trim().toUpperCase();
  if (!GSTIN_RE.test(v)) return issue('INVALID_GSTIN', `GSTIN "${value}" is invalid`, 'gstin');
  return null;
}

function validatePan(value) {
  if (!value) return null;
  const v = String(value).trim().toUpperCase();
  if (!PAN_RE.test(v)) return issue('INVALID_PAN', `PAN "${value}" is invalid`, 'pan');
  return null;
}

function validateMandatory(payload, requiredFields = []) {
  const issues = [];
  for (const f of requiredFields) {
    const val = payload?.[f] ?? payload?.[f.toLowerCase()];
    if (val === undefined || val === null || val === '') {
      issues.push(issue('MISSING_MANDATORY', `Missing mandatory field: ${f}`, f));
    }
  }
  return issues;
}

function validateVoucherBalance(payload) {
  const lines = payload?.ledgerEntries || payload?.entries || payload?.allLedgerEntries || [];
  if (!Array.isArray(lines) || !lines.length) return [];

  let debit = 0;
  let credit = 0;
  for (const line of lines) {
    const amt = Number(line.amount ?? line.AMOUNTDr ?? line.amountCr ?? 0);
    const isDebit = line.isDebit === true || line.amountDr != null || String(line.type || '').toLowerCase() === 'dr';
    if (isDebit) debit += Math.abs(amt);
    else credit += Math.abs(amt);
  }
  if (Math.abs(debit - credit) > 0.05) {
    return [issue('VOUCHER_UNBALANCED', `Voucher unbalanced: Dr ${debit} vs Cr ${credit}`)];
  }
  return [];
}

function validateParentGroup(payload, allowedParents = []) {
  if (!allowedParents.length) return [];
  const parent = payload?.parent || payload?.PARENT || payload?.parentGroup;
  if (!parent) return [issue('INVALID_PARENT', 'Parent group is required', 'parent')];
  const ok = allowedParents.some((p) => String(p).toLowerCase() === String(parent).toLowerCase());
  if (!ok) return [issue('INVALID_PARENT', `Parent group "${parent}" is not allowed`, 'parent')];
  return [];
}

function validateStockUnit(payload) {
  const unit = payload?.baseUnits || payload?.BASEUNITS || payload?.unit_of_measure || payload?.uom;
  if (payload && (payload.entityType === 'item' || payload.stockItem) && !unit) {
    return [issue('INVALID_STOCK_UNIT', 'Stock unit / UOM is required', 'unit')];
  }
  return [];
}

function validateTaxConfiguration(payload, taxMappings = []) {
  if (!payload?.gstApplicable && !payload?.gstin && !payload?.taxLines) return [];
  if (payload?.taxLines?.length && !taxMappings.length) {
    return [issue('INVALID_TAX_CONFIG', 'Tax lines present but no tax ledger mappings configured', 'tax')];
  }
  return [];
}

/**
 * Validate outbound (CRM → Tally) or inbound (Tally → CRM) payload.
 */
function validatePayload({
  direction = 'outbound',
  entityType,
  payload = {},
  requiredFields = [],
  allowedParents = [],
  taxMappings = [],
  fyLocked = false,
}) {
  const issues = [];

  if (fyLocked) {
    issues.push(issue('FY_LOCKED', 'Financial year is locked — cannot sync'));
  }

  issues.push(...validateMandatory(payload, requiredFields));

  const gstin = payload.gstin || payload.GSTIN;
  const pan = payload.pan || payload.INCOMETAXNUMBER || payload.taxId;
  const g = validateGstin(gstin);
  const p = validatePan(pan);
  if (g) issues.push(g);
  if (p) issues.push(p);

  if (['invoice', 'journal', 'payment', 'receipt', 'purchase', 'sales'].includes(entityType)) {
    issues.push(...validateVoucherBalance(payload));
  }

  if (entityType === 'party' || entityType === 'ledger') {
    issues.push(...validateParentGroup(payload, allowedParents));
  }

  if (entityType === 'item' || entityType === 'stock_item') {
    issues.push(...validateStockUnit(payload));
  }

  issues.push(...validateTaxConfiguration(payload, taxMappings));

  if (direction === 'inbound' && ['invoice', 'sales', 'purchase'].includes(entityType)) {
    if (!payload.partyName && !payload.PARTYLEDGERNAME && !payload.organizationId) {
      issues.push(issue('PARTY_UNRESOLVED', 'Party must be resolved before inbound voucher create', 'party'));
    }
  }

  const errors = issues.filter((i) => i.severity === 'error');
  return {
    ok: errors.length === 0,
    issues,
    errors,
    direction,
    entityType,
  };
}

module.exports = {
  validatePayload,
  validateGstin,
  validatePan,
  validateVoucherBalance,
  validateMandatory,
  issue,
};
