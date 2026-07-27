'use strict';

const purchaseVoucherMapper = require('./purchaseVoucherMapper');

/**
 * Debit note → Tally Debit Note voucher (reuses purchase inventory/ledger shape).
 */
function toTally(billOrInvoice = {}, lines = [], opts = {}) {
  const base = purchaseVoucherMapper.toTally
    ? purchaseVoucherMapper.toTally(billOrInvoice, lines, opts)
    : {};
  return {
    ...base,
    voucherType: 'Debit Note',
    reference:
      billOrInvoice.debitNoteNumber ||
      billOrInvoice.invoiceNumber ||
      billOrInvoice.purchaseBillNumber ||
      base.reference,
    voucherNumber:
      billOrInvoice.debitNoteNumber ||
      billOrInvoice.invoiceNumber ||
      billOrInvoice.purchaseBillNumber ||
      base.voucherNumber,
  };
}

function fromTally(payload = {}) {
  return {
    debitNoteNumber: payload.REFERENCE || payload.reference || payload.VOUCHERNUMBER || null,
    date: payload.DATE || payload.date || null,
    partyGstin: payload.PARTYGSTIN || payload.partyGstin || null,
    placeOfSupply: payload.PLACEOFSUPPLY || payload.placeOfSupply || null,
    grandTotal: payload.AMOUNT != null ? Number(payload.AMOUNT) : null,
    partyLedgerName: payload.PARTYLEDGERNAME || payload.partyLedgerName || null,
    externalReferenceId: payload.GUID || payload.MASTERID || null,
    voucherType: 'Debit Note',
  };
}

module.exports = { toTally, fromTally };
