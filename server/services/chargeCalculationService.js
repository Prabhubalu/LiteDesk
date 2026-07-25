const {
  CHARGE_TYPES,
  CHARGE_SCOPES,
  isItemScope,
  isTransactionScope,
  CHARGE_CALC_STEPS
} = require('../constants/chargeConstants');

function toCents(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function fromCents(cents) {
  return Math.round(cents) / 100;
}

function assertChargeValue(charge) {
  const value = Number(charge.chargeValue);
  if (!Number.isFinite(value) || value < 0) {
    const err = new Error('Charge value cannot be negative');
    err.code = 'CHARGE_VALUE_INVALID';
    throw err;
  }
  if (charge.chargeType === CHARGE_TYPES.PERCENTAGE && value > 100) {
    const err = new Error('Percentage charges must be between 0 and 100');
    err.code = 'CHARGE_VALUE_INVALID';
    throw err;
  }
}

function calcAmountCents(baseCents, charge) {
  assertChargeValue(charge);
  if (charge.chargeType === CHARGE_TYPES.PERCENTAGE) {
    return Math.round((baseCents * Number(charge.chargeValue)) / 100);
  }
  return toCents(charge.chargeValue);
}

function normalizeChargeSnapshot(charge, amountCents, baseCents) {
  return {
    chargeId: charge.chargeId || charge._id || charge.id || null,
    name: charge.name || null,
    code: charge.code || null,
    chargeType: charge.chargeType || CHARGE_TYPES.FIXED_AMOUNT,
    chargeValue: Number(charge.chargeValue),
    scope: charge.scope || null,
    amount: fromCents(amountCents),
    amountCents,
    baseAmount: fromCents(baseCents),
    baseAmountCents: baseCents
  };
}

/**
 * @param {object} input
 * @param {Array<{ lineId?: string, quantity: number, unitPrice: number, charges?: object[] }>} input.lines
 * @param {object[]} [input.transactionCharges]
 */
function calculateDocumentCharges(input = {}) {
  const lines = Array.isArray(input.lines) ? input.lines : [];
  const transactionCharges = Array.isArray(input.transactionCharges) ? input.transactionCharges : [];

  const lineResults = [];
  let linesSubtotalCents = 0;
  let itemChargeTotalCents = 0;

  for (const line of lines) {
    const qty = Number(line.quantity);
    const unitPrice = Number(line.unitPrice);
    const lineBaseCents = toCents(
      (Number.isFinite(qty) ? qty : 0) * (Number.isFinite(unitPrice) ? unitPrice : 0)
    );
    linesSubtotalCents += lineBaseCents;

    const applied = [];
    let lineChargeCents = 0;
    for (const charge of Array.isArray(line.charges) ? line.charges : []) {
      const scope = charge.scope || CHARGE_SCOPES.ITEM;
      if (!isItemScope(scope)) {
        const err = new Error('Transaction-level charges cannot be applied on line items');
        err.code = 'CHARGE_SCOPE_INVALID';
        throw err;
      }
      const amountCents = calcAmountCents(lineBaseCents, charge);
      lineChargeCents += amountCents;
      applied.push(normalizeChargeSnapshot(charge, amountCents, lineBaseCents));
    }

    itemChargeTotalCents += lineChargeCents;
    lineResults.push({
      lineId: line.lineId || null,
      lineSubtotal: fromCents(lineBaseCents),
      charges: applied,
      lineChargeTotal: fromCents(lineChargeCents),
      lineChargeTotalCents: lineChargeCents
    });
  }

  const txnApplied = [];
  let txnChargeTotalCents = 0;
  for (const charge of transactionCharges) {
    const scope = charge.scope || CHARGE_SCOPES.TRANSACTION;
    if (!isTransactionScope(scope)) {
      const err = new Error('Item-level charges cannot be applied at document summary level');
      err.code = 'CHARGE_SCOPE_INVALID';
      throw err;
    }
    const amountCents = calcAmountCents(linesSubtotalCents, charge);
    txnChargeTotalCents += amountCents;
    txnApplied.push(normalizeChargeSnapshot(charge, amountCents, linesSubtotalCents));
  }

  const chargesTotalCents = itemChargeTotalCents + txnChargeTotalCents;

  return {
    calcSteps: CHARGE_CALC_STEPS,
    lines: lineResults,
    subtotal: fromCents(linesSubtotalCents),
    itemChargeTotal: fromCents(itemChargeTotalCents),
    itemChargeTotalCents,
    transactionCharges: txnApplied,
    transactionChargeTotal: fromCents(txnChargeTotalCents),
    transactionChargeTotalCents: txnChargeTotalCents,
    chargesTotal: fromCents(chargesTotalCents),
    chargesTotalCents
  };
}

module.exports = {
  toCents,
  fromCents,
  calculateDocumentCharges,
  assertChargeValue
};
