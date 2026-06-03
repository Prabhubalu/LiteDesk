/**
 * Invoice-centric payment summary (INV4 + PAY1 refund visibility).
 */

const Invoice = require('../models/Invoice');
const PaymentAllocation = require('../models/PaymentAllocation');
const RefundAllocation = require('../models/RefundAllocation');
const Refund = require('../models/Refund');
const Payment = require('../models/Payment');
const CustomerCreditApplication = require('../models/CustomerCreditApplication');
const { listCreditBalancesForAccount } = require('./customerCreditBalanceService');
const { roundMoney } = require('../constants/paymentLifecycle');

async function buildInvoicePaymentSummary({ organizationId, invoiceMongoId }) {
  if (!organizationId || !invoiceMongoId) {
    const err = new Error('organizationId and invoice id are required');
    err.code = 'VALIDATION';
    throw err;
  }

  const invoice = await Invoice.findOne({
    _id: invoiceMongoId,
    organizationId,
    deletedAt: null
  }).lean();

  if (!invoice) {
    const err = new Error('Invoice not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const allocations = await PaymentAllocation.find({
    organizationId,
    invoiceMongoId
  })
    .sort({ appliedAt: -1 })
    .lean();

  const activeAllocations = allocations.filter((row) => row.status === 'active');
  const amountPaidFromAllocations = roundMoney(
    activeAllocations.reduce((sum, row) => sum + (Number(row.amountApplied) || 0), 0)
  );

  const refundAllocations = await RefundAllocation.find({
    organizationId,
    invoiceMongoId,
    status: 'active'
  })
    .sort({ createdAt: -1 })
    .lean();

  const refundMongoIds = [...new Set(refundAllocations.map((row) => String(row.refundMongoId)))];
  const refunds = refundMongoIds.length
    ? await Refund.find({ organizationId, _id: { $in: refundMongoIds } }).lean()
    : [];
  const refundById = new Map(refunds.map((row) => [String(row._id), row]));

  const paymentMongoIds = [...new Set(allocations.map((row) => String(row.paymentMongoId)))];
  const payments = paymentMongoIds.length
    ? await Payment.find({ organizationId, _id: { $in: paymentMongoIds } })
        .select('paymentId paymentNumber paymentDate amount paymentCurrency status')
        .lean()
    : [];
  const paymentById = new Map(payments.map((row) => [String(row._id), row]));

  const totalRefunded = roundMoney(
    refundAllocations.reduce((sum, row) => sum + (Number(row.amountReversed) || 0), 0)
  );

  const creditApplications = await CustomerCreditApplication.find({
    organizationId,
    invoiceMongoId
  })
    .sort({ appliedAt: -1 })
    .lean();

  const totalCreditApplied = roundMoney(
    creditApplications
      .filter((row) => row.status === 'active')
      .reduce((sum, row) => sum + (Number(row.amountApplied) || 0), 0)
  );

  const availableCreditBalances = await listCreditBalancesForAccount({
    organizationId,
    organizationRefId: invoice.organizationRefId,
    currency: invoice.currency
  });

  const canApplyCredit =
    String(invoice.invoiceType || 'standard') === 'standard' &&
    roundMoney(invoice.amountDue) > 0 &&
    availableCreditBalances.some((b) => roundMoney(b.amountRemaining) > 0);

  return {
    invoiceId: invoice.invoiceId,
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    paymentStatus: invoice.paymentStatus,
    currency: invoice.currency,
    grandTotal: roundMoney(invoice.grandTotal),
    amountPaid: roundMoney(invoice.amountPaid),
    amountPaidFromAllocations,
    amountDue: roundMoney(invoice.amountDue),
    writeOffTotal: roundMoney(invoice.writeOffTotal),
    creditAppliedTotal: roundMoney(invoice.creditAppliedTotal),
    totalCreditApplied,
    totalRefunded,
    lastPaymentAt: invoice.lastPaymentAt || null,
    canReceivePayment:
      String(invoice.invoiceType || 'standard') === 'standard' &&
      ['Posted', 'Partially Paid'].includes(String(invoice.status || '')) &&
      roundMoney(invoice.amountDue) > 0,
    canApplyCredit,
    availableCreditTotal: roundMoney(
      availableCreditBalances.reduce((s, b) => s + (Number(b.amountRemaining) || 0), 0)
    ),
    allocations: allocations.map((row) => {
      const payment = paymentById.get(String(row.paymentMongoId));
      return {
        paymentAllocationId: row.paymentAllocationId,
        paymentId: row.paymentId,
        paymentNumber: payment?.paymentNumber || null,
        paymentMongoId: row.paymentMongoId,
        amountApplied: roundMoney(row.amountApplied),
        appliedAt: row.appliedAt,
        status: row.status,
        reversedAt: row.reversedAt || null,
        paymentReversalId: row.paymentReversalId || null
      };
    }),
    refunds: refundAllocations.map((row) => {
      const refund = refundById.get(String(row.refundMongoId));
      return {
        refundAllocationId: row.refundAllocationId,
        refundId: row.refundId,
        refundNumber: refund?.refundNumber || null,
        refundMongoId: row.refundMongoId,
        paymentId: row.paymentId,
        amountReversed: roundMoney(row.amountReversed),
        reason: refund?.reason || null,
        refundDate: refund?.refundDate || null,
        status: refund?.status || null
      };
    }),
    creditApplications: creditApplications.map((row) => ({
      customerCreditApplicationId: row.customerCreditApplicationId,
      customerCreditBalanceId: row.customerCreditBalanceId,
      amountApplied: roundMoney(row.amountApplied),
      appliedAt: row.appliedAt,
      status: row.status,
      reversedAt: row.reversedAt || null
    }))
  };
}

module.exports = {
  buildInvoicePaymentSummary
};
