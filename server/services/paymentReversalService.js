/**
 * PAY0 — Reverse PaymentAllocation rows via PaymentReversal document.
 */

const Payment = require('../models/Payment');
const PaymentAllocation = require('../models/PaymentAllocation');
const PaymentReversal = require('../models/PaymentReversal');
const { roundMoney } = require('../constants/paymentLifecycle');
const { recalculateInvoicePaymentRollups } = require('./invoicePaymentRollupService');
const { recalculatePaymentRollups } = require('./paymentRollupService');
const { writePaymentActivity } = require('./paymentActivityService');

async function reversePaymentAllocations({
  organizationId,
  paymentMongoId,
  userId,
  paymentAllocationIds = null,
  reversalType = 'other',
  reversalReason,
  reversalReasonCode = null,
  refundId = null,
  refundMongoId = null
}) {
  if (!organizationId || !paymentMongoId) {
    const err = new Error('organizationId and payment id are required');
    err.code = 'VALIDATION';
    throw err;
  }

  const reason = String(reversalReason || '').trim();
  if (!reason) {
    const err = new Error('reversalReason is required');
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

  const query = {
    organizationId,
    paymentMongoId: payment._id,
    status: 'active'
  };

  if (Array.isArray(paymentAllocationIds) && paymentAllocationIds.length > 0) {
    query.paymentAllocationId = { $in: paymentAllocationIds.map(String) };
  }

  const targets = await PaymentAllocation.find(query);
  if (!targets.length) {
    const err = new Error('No active payment allocations to reverse');
    err.code = 'NOTHING_TO_REVERSE';
    throw err;
  }

  const now = new Date();
  const reversal = await PaymentReversal.create({
    organizationId,
    paymentId: payment.paymentId,
    paymentMongoId: payment._id,
    refundId: refundId || null,
    refundMongoId: refundMongoId || null,
    reversalType: reversalType || 'other',
    reversalReason: reason,
    reversalReasonCode: reversalReasonCode || null,
    allocationReversals: targets.map((row) => ({
      paymentAllocationId: row.paymentAllocationId,
      amountReversed: roundMoney(row.amountApplied)
    })),
    status: 'completed',
    reversedAt: now,
    reversedBy: userId || null,
    sourceContext: 'manual'
  });

  const affectedInvoiceMongoIds = new Set();

  for (const row of targets) {
    row.status = 'reversed';
    row.reversedAt = now;
    row.reversedBy = userId || null;
    row.reversalReason = reason;
    row.paymentReversalId = reversal.paymentReversalId;
    await row.save();
    affectedInvoiceMongoIds.add(String(row.invoiceMongoId));
  }

  await recalculatePaymentRollups({ organizationId, paymentMongoId: payment._id });

  for (const invoiceMongoId of affectedInvoiceMongoIds) {
    await recalculateInvoicePaymentRollups({
      organizationId,
      invoiceMongoId,
      userId,
      activityContext: {
        action: 'payment_reversed',
        message: 'Payment allocation reversed',
        paymentId: payment.paymentId,
        paymentReversalId: reversal.paymentReversalId,
        details: { reversalReason: reason }
      }
    });
  }

  await writePaymentActivity({
    organizationId,
    paymentId: payment.paymentId,
    userId,
    action: 'payment_reversal_completed',
    message: `Payment reversal ${reversal.paymentReversalNumber} completed`,
    details: {
      paymentReversalId: reversal.paymentReversalId,
      paymentReversalNumber: reversal.paymentReversalNumber,
      reversalReason: reason,
      allocationReversals: reversal.allocationReversals
    }
  });

  const updatedPayment = await Payment.findById(payment._id).lean();
  return {
    payment: updatedPayment,
    reversal: reversal.toObject(),
    reversedAllocations: targets.map((row) => row.toObject())
  };
}

module.exports = {
  reversePaymentAllocations
};
