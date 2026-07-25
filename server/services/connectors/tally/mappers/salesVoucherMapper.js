'use strict';

const { buildGstTaxSnapshot, splitGstComponents } = require('../../../indiaGstTaxService');

/**
 * Posted Invoice → Tally Sales voucher payload.
 * Preserves IRN / e-invoice fields when present.
 */

function formatTallyDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

function resolveGstFromInvoice(invoice = {}, lines = [], opts = {}) {
  const existing =
    invoice.taxDocumentSnapshot &&
    invoice.taxDocumentSnapshot.schemaVersion === 1 &&
    Array.isArray(invoice.taxDocumentSnapshot.lines)
      ? invoice.taxDocumentSnapshot
      : null;

  if (existing) return existing;

  try {
    const gstLines = lines.map((line) => {
      const rate =
        line.taxSnapshot?.ratePercent ??
        line.taxSnapshot?.rate ??
        opts.defaultRatePercent ??
        0;
      return {
        lineId: line.invoiceLineId || (line._id ? String(line._id) : null),
        taxableAmount: Number(line.lineSubtotal) || 0,
        ratePercent: Number(rate) || 0,
        hsnSac: line.taxSnapshot?.hsnSac || line.attributesSnapshot?.hsnSac || null,
      };
    });

    return buildGstTaxSnapshot({
      lines: gstLines,
      sellerStateCode: opts.sellerStateCode || null,
      buyerStateCode: opts.buyerStateCode || invoice.placeOfSupply || null,
      placeOfSupplyStateCode: invoice.placeOfSupply || null,
      partyGstin: invoice.partyGstin || null,
    });
  } catch (_err) {
    return null;
  }
}

/**
 * @param {object} invoice
 * @param {object[]} [lines]
 * @param {{ partyLedgerName?: string, sellerStateCode?: string, buyerStateCode?: string }} [opts]
 */
function toTally(invoice = {}, lines = [], opts = {}) {
  const gstSnapshot = resolveGstFromInvoice(invoice, lines, opts);
  const inventoryEntries = lines.map((line) => {
    const taxable = Number(line.lineSubtotal) || 0;
    const rate =
      line.taxSnapshot?.ratePercent ??
      line.taxSnapshot?.rate ??
      0;
    let components = null;
    if (gstSnapshot?.placeOfSupply) {
      components = splitGstComponents({
        taxableAmount: taxable,
        ratePercent: rate,
        placeOfSupplyIsInterstate: Boolean(gstSnapshot.placeOfSupply.isInterstate),
      });
    }

    return {
      stockItemName: line.itemNameSnapshot || line.skuSnapshot || null,
      sku: line.skuSnapshot || null,
      quantity: Number(line.quantity) || 0,
      rate: Number(line.unitPriceSnapshot) || 0,
      amount: Number(line.lineTotal) || taxable,
      discountAmount: Number(line.discountAmount) || 0,
      unit: line.unitOfMeasure || null,
      godownName: opts.defaultGodownName || null,
      hsnSac: line.taxSnapshot?.hsnSac || null,
      gstComponents: components,
      arivuLineId: line.invoiceLineId || (line._id ? String(line._id) : null),
    };
  });

  const voucherNumber = invoice.invoiceNumber || null;

  return {
    voucherType: 'Sales',
    date: formatTallyDate(invoice.invoiceDate || invoice.postedAt),
    voucherNumber,
    /** Arivu REFERENCE default — Tally REFERENCE tag = Arivu document number */
    reference: voucherNumber,
    partyLedgerName: opts.partyLedgerName || null,
    partyGstin: invoice.partyGstin || null,
    placeOfSupply: invoice.placeOfSupply || gstSnapshot?.placeOfSupply?.stateCode || null,
    isInterstate: gstSnapshot?.placeOfSupply?.isInterstate ?? null,
    currency: invoice.currency || null,
    subtotal: Number(invoice.subtotal) || 0,
    taxTotal: Number(invoice.taxTotal) || 0,
    grandTotal: Number(invoice.grandTotal) || 0,
    irn: invoice.irn || null,
    irnStatus: invoice.irnStatus || null,
    ackNo: invoice.ackNo || null,
    ackDate: invoice.ackDate || null,
    qrPayload: invoice.qrPayload || null,
    ewayBillNo: invoice.ewayBillNo || null,
    ewayBillDate: invoice.ewayBillDate || null,
    gstSnapshot,
    inventoryEntries,
    ledgerEntries: [
      {
        ledgerName: opts.partyLedgerName || 'Party',
        isPartyLedger: true,
        amount: -(Number(invoice.grandTotal) || 0),
      },
      {
        ledgerName: opts.salesLedgerName || 'Sales',
        isPartyLedger: false,
        amount: Number(invoice.subtotal) || 0,
      },
    ],
    arivuId: invoice._id ? String(invoice._id) : null,
    invoiceId: invoice.invoiceId || null,
    invoiceType: invoice.invoiceType || 'standard',
  };
}

module.exports = {
  toTally,
  formatTallyDate,
  resolveGstFromInvoice,
};
