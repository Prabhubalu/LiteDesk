/**
 * Apply document-level transaction taxes / charges snapshots (Quote/SO/Invoice).
 */

async function applyDocumentTaxesChargesSnapshots(doc, body, { organizationId, LineModel, parentIdField }) {
  const { hydrateTaxIds } = require('../services/commercialTaxApplicationService');
  const { getActiveChargesByIds } = require('../services/chargeService');
  const { calculateDocumentCharges } = require('../services/chargeCalculationService');
  const { CHARGE_SCOPES, isTransactionScope } = require('../constants/chargeConstants');

  let touched = false;

  if (Array.isArray(body?.transactionTaxIds)) {
    const taxes = await hydrateTaxIds(organizationId, body.transactionTaxIds);
    doc.transactionTaxSnapshot = {
      taxes: taxes.map((t) => ({
        taxId: t.taxId,
        name: t.name,
        code: t.code,
        taxType: t.taxType,
        taxValue: t.taxValue,
        scope: t.scope
      }))
    };
    if (typeof doc.markModified === 'function') doc.markModified('transactionTaxSnapshot');
    touched = true;
  }

  if (Array.isArray(body?.transactionChargeIds)) {
    const charges = await getActiveChargesByIds(body.transactionChargeIds, organizationId);
    const txnCharges = charges
      .filter((c) => isTransactionScope(c.scope || CHARGE_SCOPES.TRANSACTION))
      .map((c) => ({
        chargeId: String(c._id),
        name: c.name,
        code: c.code,
        chargeType: c.chargeType,
        chargeValue: c.chargeValue,
        scope: c.scope
      }));
    const lines = await LineModel.find({ organizationId, [parentIdField]: doc._id }).lean();
    const calc = calculateDocumentCharges({
      lines: lines.map((l) => ({
        quantity: 1,
        unitPrice: Number(l.lineSubtotal) || 0,
        charges: []
      })),
      transactionCharges: txnCharges
    });
    doc.chargeDocumentSnapshot = { charges: calc.transactionCharges };
    doc.chargesTotal = calc.transactionChargeTotal;
    if (typeof doc.markModified === 'function') doc.markModified('chargeDocumentSnapshot');
    touched = true;
  }

  return touched;
}

/**
 * Enrich section-aware totals with document txn tax + charges (quote parity).
 */
function enrichTotalsWithDocumentMoney({
  baseTotals,
  lines,
  transactionTaxSnapshot,
  chargesTotal,
  globalDiscountType,
  globalDiscountValue,
  globalDiscountAmount,
  adjustmentTotal
}) {
  const { recalculateDocumentMoney } = require('../services/commercialTaxApplicationService');
  const txnTaxes = Array.isArray(transactionTaxSnapshot?.taxes) ? transactionTaxSnapshot.taxes : [];
  const money = recalculateDocumentMoney({
    lines,
    transactionTaxes: txnTaxes,
    chargesTotal: Number(chargesTotal) || 0,
    globalDiscountType,
    globalDiscountValue,
    globalDiscountAmount,
    adjustmentTotal
  });

  return {
    ...baseTotals,
    taxTotal: money.totals.taxTotal,
    chargesTotal: money.totals.chargesTotal,
    grandTotal: money.totals.grandTotal,
    taxDocumentSnapshot: money.taxDocumentSnapshot
  };
}

module.exports = {
  applyDocumentTaxesChargesSnapshots,
  enrichTotalsWithDocumentMoney
};
