/**
 * Apply tax engine to commercial document lines (Quotes, SO, Invoices, future PO).
 * Resolves defaults, builds snapshots, computes line + document tax totals.
 */

const { calculateDocumentTaxes } = require('./taxCalculationService');
const { resolveDefaultsForDocument } = require('./taxDefaultsService');
const { getActiveTaxesByIds } = require('./taxService');
const { TAX_SCOPES, isItemScope, isTransactionScope } = require('../constants/taxConstants');

function toEngineTax(tax) {
  return {
    taxId: String(tax._id || tax.taxId || tax.id || ''),
    name: tax.name,
    code: tax.code || null,
    taxType: tax.taxType,
    taxValue: Number(tax.taxValue),
    scope: tax.scope,
    applicableOn: tax.applicableOn
  };
}

function taxesFromSnapshot(taxSnapshot) {
  if (!taxSnapshot || typeof taxSnapshot !== 'object') return [];
  if (Array.isArray(taxSnapshot.taxes)) {
    return taxSnapshot.taxes.map((t) => ({
      taxId: t.taxId,
      name: t.name,
      code: t.code || null,
      taxType: t.taxType,
      taxValue: Number(t.taxValue),
      scope: t.scope || TAX_SCOPES.ITEM
    }));
  }
  if (taxSnapshot.mode === 'none' || taxSnapshot.source === 'mvp_placeholder') return [];
  return [];
}

/**
 * Resolve item-level default taxes for a new commercial line.
 */
async function resolveLineDefaultTaxes(organizationId, { side = 'SALES', lineKind = 'ITEM' } = {}) {
  const { taxes } = await resolveDefaultsForDocument(organizationId, { side, lineKind });
  return (taxes || [])
    .filter((t) => isItemScope(t.scope))
    .map(toEngineTax);
}

/**
 * Resolve transaction-level default taxes for a document header.
 */
async function resolveDocumentDefaultTaxes(organizationId, { side = 'SALES' } = {}) {
  const { taxes } = await resolveDefaultsForDocument(organizationId, { side, lineKind: null });
  // Header defaults: TRANSACTION-only (BOTH taxes stay on lines when also item-defaulted)
  return (taxes || [])
    .filter((t) => t.scope === TAX_SCOPES.TRANSACTION)
    .map(toEngineTax);
}

/**
 * Hydrate tax IDs into engine tax objects (active only).
 */
async function hydrateTaxIds(organizationId, taxIds = []) {
  if (!Array.isArray(taxIds) || !taxIds.length) return [];
  const taxes = await getActiveTaxesByIds(taxIds, organizationId);
  return taxes.map(toEngineTax);
}

/**
 * Build taxSnapshot + line money fields for a single line after discount.
 * @param {object} line - { quantity, unitPriceSnapshot, discount*, taxSnapshot? }
 * @param {object[]} [itemTaxes] - explicit taxes; if omitted, uses snapshot or defaults
 */
function applyTaxesToLine(line, itemTaxes = null) {
  const quantity = Number(line.quantity) || 0;
  const unitPrice = Number(line.unitPriceSnapshot ?? line.unitPrice) || 0;
  const gross = quantity * unitPrice;

  let discount = 0;
  const explicit = Number(line.discountAmount);
  if (Number.isFinite(explicit) && explicit > 0) {
    discount = Math.min(explicit, gross);
  } else {
    const t = String(line.discountType || '').trim().toLowerCase();
    const dv = Number(line.discountValue) || 0;
    if (t === 'percent' || t === 'percentage') discount = Math.min((gross * dv) / 100, gross);
    else if (t === 'amount' || t === 'fixed') discount = Math.min(dv, gross);
  }

  const lineSubtotal = Math.max(0, gross - discount);
  const taxes = Array.isArray(itemTaxes)
    ? itemTaxes
    : taxesFromSnapshot(line.taxSnapshot);

  const calc = calculateDocumentTaxes({
    lines: [{
      lineId: String(line._id || line.quoteLineId || line.lineId || 'line'),
      quantity: 1,
      unitPrice: lineSubtotal,
      taxes: taxes.filter((t) => isItemScope(t.scope || TAX_SCOPES.ITEM))
    }],
    chargesTotal: 0,
    transactionTaxes: []
  });

  const lineResult = calc.lines[0] || {
    taxes: [],
    lineTaxTotal: 0,
    lineTotal: lineSubtotal
  };

  const taxSnapshot = {
    mode: lineResult.taxes.length ? 'engine' : 'none',
    source: 'taxCalculationService',
    side: line.taxSide || 'SALES',
    taxes: lineResult.taxes,
    calculatedAt: new Date().toISOString()
  };

  return {
    lineSubtotal,
    lineTaxTotal: lineResult.lineTaxTotal,
    lineTotal: lineSubtotal + lineResult.lineTaxTotal,
    lineDiscount: discount,
    taxSnapshot
  };
}

/**
 * Recalculate all lines + document totals including transaction taxes and charges.
 */
function recalculateDocumentMoney({
  lines = [],
  transactionTaxes = [],
  chargesTotal = 0,
  globalDiscountType = null,
  globalDiscountValue = 0,
  globalDiscountAmount = 0,
  adjustmentTotal = 0
}) {
  const lineInputs = [];
  const updatedLines = [];

  for (const line of lines) {
    const taxes = taxesFromSnapshot(line.taxSnapshot);
    const applied = applyTaxesToLine(line, taxes);
    updatedLines.push({
      ...line,
      lineSubtotal: applied.lineSubtotal,
      lineTaxTotal: applied.lineTaxTotal,
      lineTotal: applied.lineTotal,
      taxSnapshot: applied.taxSnapshot
    });
    lineInputs.push({
      lineId: String(line._id || line.quoteLineId || ''),
      quantity: 1,
      unitPrice: applied.lineSubtotal,
      taxes
    });
  }

  const txnTaxes = (transactionTaxes || []).filter((t) =>
    isTransactionScope(t.scope || TAX_SCOPES.TRANSACTION)
  );

  const calc = calculateDocumentTaxes({
    lines: lineInputs,
    chargesTotal: Number(chargesTotal) || 0,
    transactionTaxes: txnTaxes
  });

  // Re-apply global discount on subtotal (commercial convention)
  let globalDiscountTotal = 0;
  const subtotal = calc.subtotal;
  const explicitG = Number(globalDiscountAmount);
  if (Number.isFinite(explicitG) && explicitG > 0) {
    globalDiscountTotal = Math.min(explicitG, subtotal);
  } else {
    const t = String(globalDiscountType || '').trim().toLowerCase();
    const dv = Number(globalDiscountValue) || 0;
    if (t === 'percent' || t === 'percentage') globalDiscountTotal = Math.min((subtotal * dv) / 100, subtotal);
    else if (t === 'amount' || t === 'fixed') globalDiscountTotal = Math.min(dv, subtotal);
  }

  const adj = Number(adjustmentTotal) || 0;
  const taxTotal = calc.taxTotal;
  const charges = calc.chargesTotal;
  const grandTotal = Math.max(
    0,
    subtotal - globalDiscountTotal + taxTotal + charges + adj
  );

  let lineDiscountTotal = 0;
  for (const l of updatedLines) {
    const qty = Number(l.quantity) || 0;
    const unit = Number(l.unitPriceSnapshot ?? l.unitPrice) || 0;
    lineDiscountTotal += Math.max(0, qty * unit - (Number(l.lineSubtotal) || 0));
  }

  return {
    lines: updatedLines,
    totals: {
      subtotal,
      lineDiscountTotal,
      globalDiscountTotal,
      taxTotal,
      chargesTotal: charges,
      adjustmentTotal: adj,
      grandTotal,
      itemTaxTotal: calc.itemTaxTotal,
      transactionTaxTotal: calc.transactionTaxTotal,
      itemTaxSummary: calc.itemTaxSummary,
      transactionTaxes: calc.transactionTaxes
    },
    taxDocumentSnapshot: {
      mode: 'engine',
      source: 'taxCalculationService',
      itemTaxSummary: calc.itemTaxSummary,
      transactionTaxes: calc.transactionTaxes,
      chargesTotal: charges,
      taxTotal,
      calculatedAt: new Date().toISOString()
    }
  };
}

module.exports = {
  toEngineTax,
  taxesFromSnapshot,
  resolveLineDefaultTaxes,
  resolveDocumentDefaultTaxes,
  hydrateTaxIds,
  applyTaxesToLine,
  recalculateDocumentMoney
};
