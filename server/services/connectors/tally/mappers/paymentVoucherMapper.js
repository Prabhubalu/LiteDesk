'use strict';

const { formatTallyDate } = require('./salesVoucherMapper');
const { resolveCashBankLedger } = require('./receiptVoucherMapper');

/**
 * VendorPayment → Tally Payment voucher
 */

/**
 * @param {object} vendorPayment - VendorPayment
 * @param {{ partyLedgerName?: string, cashBankLedgerName?: string, allocations?: object[] }} [opts]
 */
function toTally(vendorPayment = {}, opts = {}) {
  const voucherNumber = vendorPayment.vendorPaymentNumber || null;
  const instrument = vendorPayment.paymentInstrumentSnapshot || {};
  const amount = Number(vendorPayment.amount) || 0;
  const cashBank = opts.cashBankLedgerName || resolveCashBankLedger(instrument);

  return {
    voucherType: 'Payment',
    date: formatTallyDate(vendorPayment.paymentDate || vendorPayment.recordedAt),
    voucherNumber,
    reference: voucherNumber,
    partyLedgerName: opts.partyLedgerName || null,
    cashBankLedgerName: cashBank,
    amount,
    currency: vendorPayment.currency || null,
    instrumentMethod: instrument.method || null,
    instrumentReference: instrument.referenceNumber || null,
    bankName: instrument.bankName || null,
    notes: vendorPayment.notes || null,
    allocations: Array.isArray(opts.allocations) ? opts.allocations : [],
    ledgerEntries: [
      {
        ledgerName: opts.partyLedgerName || 'Party',
        isPartyLedger: true,
        amount,
      },
      {
        ledgerName: cashBank,
        isPartyLedger: false,
        amount: -amount,
      },
    ],
    arivuId: vendorPayment._id ? String(vendorPayment._id) : null,
    vendorPaymentId: vendorPayment.vendorPaymentId || null,
  };
}

module.exports = {
  toTally,
};
