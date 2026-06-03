/**
 * Payment header rollups from PaymentAllocation rows.
 */

const Payment = require('../models/Payment');
const PaymentAllocation = require('../models/PaymentAllocation');
const Refund = require('../models/Refund');
const { roundMoney, derivePaymentStatus } = require('../constants/paymentLifecycle');
const { syncCreditBalanceFromPayment } = require('./customerCreditBalanceService');

async function recalculatePaymentRollups({ organizationId, paymentMongoId }) {
  if (!organizationId || !paymentMongoId) {
    const err = new Error('organizationId and paymentMongoId are required');
    err.code = 'VALIDATION';
    throw err;
  }

  const payment = await Payment.findOne({
    _id: paymentMongoId,
    organizationId,
    deletedAt: null
  });

  if (!payment) {
    const err = new Error('Payment not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const activeRows = await PaymentAllocation.find({
    organizationId,
    paymentMongoId,
    status: 'active'
  }).lean();

  const amountAllocated = roundMoney(
    activeRows.reduce((sum, row) => sum + (Number(row.amountApplied) || 0), 0)
  );
  const amount = roundMoney(payment.amount);
  const completedRefunds = await Refund.find({
    organizationId,
    paymentMongoId,
    status: 'completed'
  }).lean();
  const amountRefunded = roundMoney(
    completedRefunds.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
  );
  const amountUnallocated = roundMoney(Math.max(0, amount - amountAllocated - amountRefunded));

  payment.amountAllocated = amountAllocated;
  payment.amountUnallocated = amountUnallocated;
  payment.amountRefunded = amountRefunded;
  payment.status = derivePaymentStatus({
    amount,
    amountAllocated,
    amountRefunded
  });

  await payment.save();

  await syncCreditBalanceFromPayment({
    organizationId,
    payment: payment.toObject(),
    userId: null
  });

  return payment.toObject();
}

module.exports = {
  recalculatePaymentRollups
};
