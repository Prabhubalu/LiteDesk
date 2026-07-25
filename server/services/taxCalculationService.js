const {
  TAX_TYPES,
  TAX_SCOPES,
  isItemScope,
  isTransactionScope,
  TAX_CALC_STEPS
} = require('../constants/taxConstants');

/**
 * Centralized tax calculation (pure). Reused by Inventory + Sales + Billing.
 *
 * MVP order: line → item taxes → subtotal → charges → txn taxes → grand.
 * Money math uses integer cents to avoid float drift.
 */

function toCents(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function fromCents(cents) {
  return Math.round(cents) / 100;
}

function assertPercentageTax(tax) {
  if (tax.taxType && tax.taxType !== TAX_TYPES.PERCENTAGE) {
    const err = new Error(`Tax type ${tax.taxType} is not supported in MVP calculation`);
    err.code = 'TAX_TYPE_UNSUPPORTED';
    throw err;
  }
  const value = Number(tax.taxValue);
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    const err = new Error('Percentage tax value must be between 0 and 100');
    err.code = 'TAX_VALUE_INVALID';
    throw err;
  }
}

function percentageOfCents(baseCents, percent) {
  return Math.round((baseCents * Number(percent)) / 100);
}

function normalizeTaxSnapshot(tax, amountCents, baseCents) {
  return {
    taxId: tax.taxId || tax._id || tax.id || null,
    name: tax.name || null,
    code: tax.code || null,
    taxType: tax.taxType || TAX_TYPES.PERCENTAGE,
    taxValue: Number(tax.taxValue),
    scope: tax.scope || null,
    amount: fromCents(amountCents),
    amountCents,
    baseAmount: fromCents(baseCents),
    baseAmountCents: baseCents
  };
}

/**
 * @param {object} input
 * @param {Array<{ lineId?: string, quantity: number, unitPrice: number, taxes?: object[] }>} input.lines
 * @param {number} [input.chargesTotal=0] — Charges module hook (sum of additional charges)
 * @param {object[]} [input.transactionTaxes=[]] — TRANSACTION / BOTH scope taxes
 * @returns {object} document tax breakdown + snapshots for persistence
 */
function calculateDocumentTaxes(input = {}) {
  const lines = Array.isArray(input.lines) ? input.lines : [];
  const chargesTotalCents = toCents(input.chargesTotal ?? 0);
  const transactionTaxes = Array.isArray(input.transactionTaxes) ? input.transactionTaxes : [];

  const lineResults = [];
  let linesSubtotalCents = 0;
  let itemTaxTotalCents = 0;
  const itemTaxSummaryMap = new Map();

  for (const line of lines) {
    const qty = Number(line.quantity);
    const unitPrice = Number(line.unitPrice);
    const lineBaseCents = toCents(
      (Number.isFinite(qty) ? qty : 0) * (Number.isFinite(unitPrice) ? unitPrice : 0)
    );
    linesSubtotalCents += lineBaseCents;

    const applied = [];
    let lineTaxCents = 0;
    const taxes = Array.isArray(line.taxes) ? line.taxes : [];

    for (const tax of taxes) {
      const scope = tax.scope || TAX_SCOPES.ITEM;
      if (!isItemScope(scope)) {
        const err = new Error('Transaction-level taxes cannot be applied on line items');
        err.code = 'TAX_SCOPE_INVALID';
        throw err;
      }
      assertPercentageTax(tax);
      const amountCents = percentageOfCents(lineBaseCents, tax.taxValue);
      lineTaxCents += amountCents;
      const snap = normalizeTaxSnapshot(tax, amountCents, lineBaseCents);
      applied.push(snap);

      const key = String(snap.taxId || snap.name || '');
      const prev = itemTaxSummaryMap.get(key) || {
        ...snap,
        amount: 0,
        amountCents: 0,
        baseAmount: 0,
        baseAmountCents: 0
      };
      prev.amountCents += amountCents;
      prev.baseAmountCents += lineBaseCents;
      prev.amount = fromCents(prev.amountCents);
      prev.baseAmount = fromCents(prev.baseAmountCents);
      itemTaxSummaryMap.set(key, prev);
    }

    itemTaxTotalCents += lineTaxCents;
    lineResults.push({
      lineId: line.lineId || null,
      quantity: qty,
      unitPrice,
      lineSubtotal: fromCents(lineBaseCents),
      lineSubtotalCents: lineBaseCents,
      taxes: applied,
      lineTaxTotal: fromCents(lineTaxCents),
      lineTaxTotalCents: lineTaxCents,
      lineTotal: fromCents(lineBaseCents + lineTaxCents),
      lineTotalCents: lineBaseCents + lineTaxCents
    });
  }

  const taxableForTxnCents = linesSubtotalCents + chargesTotalCents;
  const txnApplied = [];
  let txnTaxTotalCents = 0;

  for (const tax of transactionTaxes) {
    const scope = tax.scope || TAX_SCOPES.TRANSACTION;
    if (!isTransactionScope(scope)) {
      const err = new Error('Item-level taxes cannot be applied at document summary level');
      err.code = 'TAX_SCOPE_INVALID';
      throw err;
    }
    assertPercentageTax(tax);
    const amountCents = percentageOfCents(taxableForTxnCents, tax.taxValue);
    txnTaxTotalCents += amountCents;
    txnApplied.push(normalizeTaxSnapshot(tax, amountCents, taxableForTxnCents));
  }

  const grandTotalCents = linesSubtotalCents + itemTaxTotalCents + chargesTotalCents + txnTaxTotalCents;

  return {
    calcSteps: TAX_CALC_STEPS,
    lines: lineResults,
    subtotal: fromCents(linesSubtotalCents),
    subtotalCents: linesSubtotalCents,
    itemTaxTotal: fromCents(itemTaxTotalCents),
    itemTaxTotalCents,
    itemTaxSummary: Array.from(itemTaxSummaryMap.values()),
    chargesTotal: fromCents(chargesTotalCents),
    chargesTotalCents,
    transactionTaxes: txnApplied,
    transactionTaxTotal: fromCents(txnTaxTotalCents),
    transactionTaxTotalCents: txnTaxTotalCents,
    taxTotal: fromCents(itemTaxTotalCents + txnTaxTotalCents),
    taxTotalCents: itemTaxTotalCents + txnTaxTotalCents,
    grandTotal: fromCents(grandTotalCents),
    grandTotalCents
  };
}

/**
 * Expand a tax group membership into tax snapshots (caller supplies hydrated taxes).
 */
function expandTaxGroup(taxes = []) {
  return taxes.map((tax) => ({
    taxId: tax._id || tax.taxId || tax.id,
    name: tax.name,
    code: tax.code || null,
    taxType: tax.taxType || TAX_TYPES.PERCENTAGE,
    taxValue: Number(tax.taxValue),
    scope: tax.scope,
    applicableOn: tax.applicableOn,
    status: tax.status
  }));
}

module.exports = {
  toCents,
  fromCents,
  calculateDocumentTaxes,
  expandTaxGroup,
  assertPercentageTax
};
