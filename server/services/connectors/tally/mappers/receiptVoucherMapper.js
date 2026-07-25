'use strict';

const { formatTallyDate } = require('./salesVoucherMapper');

/**
 * Payment (AR customer receipt) → Tally Receipt voucher
 */

function resolveCashBankLedger(instrument = {}) {
  const method = String(instrument.method || '').toLowerCase();
  if (method === 'cash') return 'Cash';
  if (method === 'upi' || method === 'card' || method === 'bank_transfer' || method === 'cheque') {
    return 'Bank';
  }
  return 'Cash';
}

/**
 * @param {object} payment - Payment
 * @param {{ partyLedgerName?: string, cashBankLedgerName?: string, allocations?: object[] }} [opts]
 */
function toTally(payment = {}, opts = {}) {
  const voucherNumber = payment.paymentNumber || null;
  const instrument = payment.paymentInstrumentSnapshot || {};
  const amount = Number(payment.amount) || 0;
  const cashBank = opts.cashBankLedgerName || resolveCashBankLedger(instrument);

  return {
    voucherType: 'Receipt',
    date: formatTallyDate(payment.paymentDate || payment.recordedAt),
    voucherNumber,
    reference: voucherNumber,
    partyLedgerName: opts.partyLedgerName || null,
    cashBankLedgerName: cashBank,
    amount,
    currency: payment.paymentCurrency || null,
    instrumentMethod: instrument.method || null,
    instrumentReference: instrument.referenceNumber || payment.externalReference || null,
    bankName: instrument.bankName || null,
    notes: payment.notes || null,
    allocations: Array.isArray(opts.allocations) ? opts.allocations : [],
    ledgerEntries: [
      {
        ledgerName: cashBank,
        isPartyLedger: false,
        amount,
      },
      {
        ledgerName: opts.partyLedgerName || 'Party',
        isPartyLedger: true,
        amount: -amount,
      },
    ],
    arivuId: payment._id ? String(payment._id) : null,
    paymentId: payment.paymentId || null,
  };
}

module.exports = {
  toTally,
  resolveCashBankLedger,
};
