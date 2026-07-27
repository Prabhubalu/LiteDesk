'use strict';

const salesVoucherMapper = require('./salesVoucherMapper');

/**
 * Credit note invoice → Tally Credit Note voucher (reuses sales inventory/ledger shape).
 */
function toTally(invoice = {}, lines = [], opts = {}) {
  const base = salesVoucherMapper.toTally(invoice, lines, opts);
  return {
    ...base,
    voucherType: 'Credit Note',
    reference: invoice.creditNoteNumber || invoice.invoiceNumber || base.reference,
    voucherNumber: invoice.creditNoteNumber || invoice.invoiceNumber || base.voucherNumber,
  };
}

function fromTally(payload = {}) {
  return {
    creditNoteNumber: payload.REFERENCE || payload.reference || payload.VOUCHERNUMBER || null,
    date: payload.DATE || payload.date || null,
    partyGstin: payload.PARTYGSTIN || payload.partyGstin || null,
    placeOfSupply: payload.PLACEOFSUPPLY || payload.placeOfSupply || null,
    grandTotal: payload.AMOUNT != null ? Number(payload.AMOUNT) : null,
    partyLedgerName: payload.PARTYLEDGERNAME || payload.partyLedgerName || null,
    externalReferenceId: payload.GUID || payload.MASTERID || null,
    voucherType: 'Credit Note',
  };
}

module.exports = { toTally, fromTally };
