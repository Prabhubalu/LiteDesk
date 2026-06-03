/**
 * PAY1 — Refund workflow: cash out + optional allocation reversal via PaymentReversal.
 */

const Payment = require('../models/Payment');
const PaymentAllocation = require('../models/PaymentAllocation');
const Refund = require('../models/Refund');
const RefundAllocation = require('../models/RefundAllocation');
const Invoice = require('../models/Invoice');
const { roundMoney, PAYMENT_INSTRUMENT_METHODS } = require('../constants/paymentLifecycle');
const { assertValidRefundReason } = require('../constants/refundReasons');
const { reversePaymentAllocations } = require('./paymentReversalService');
const { recalculatePaymentRollups } = require('./paymentRollupService');
const { reduceBalanceFromRefundUnallocated } = require('./customerCreditBalanceService');
const { writePaymentActivity } = require('./paymentActivityService');
const { writeInvoiceActivity } = require('./invoiceActivityService');

function computeRefundableAmount(payment) {
  const amount = roundMoney(payment.amount);
  const amountRefunded = roundMoney(payment.amountRefunded);
  return roundMoney(Math.max(0, amount - amountRefunded));
}

async function buildPaymentRefundEligibility({ organizationId, paymentMongoId }) {
  const payment = await Payment.findOne({
    _id: paymentMongoId,
    organizationId,
    deletedAt: null
  }).lean();

  if (!payment) {
    const err = new Error('Payment not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const activeAllocations = await PaymentAllocation.find({
    organizationId,
    paymentMongoId: payment._id,
    status: 'active'
  })
    .sort({ appliedAt: 1 })
    .lean();

  const invoiceMongoIds = [...new Set(activeAllocations.map((row) => String(row.invoiceMongoId)))];
  const invoices = await Invoice.find({
    organizationId,
    _id: { $in: invoiceMongoIds }
  })
    .select('invoiceId invoiceNumber')
    .lean();
  const invoiceById = new Map(invoices.map((row) => [String(row._id), row]));

  const refunds = await Refund.find({
    organizationId,
    paymentMongoId: payment._id,
    status: 'completed'
  })
    .sort({ refundDate: -1 })
    .lean();

  return {
    payment,
    maxRefundable: computeRefundableAmount(payment),
    amountUnallocated: roundMoney(payment.amountUnallocated),
    activeAllocations: activeAllocations.map((row) => {
      const invoice = invoiceById.get(String(row.invoiceMongoId));
      return {
        paymentAllocationId: row.paymentAllocationId,
        invoiceId: row.invoiceId,
        invoiceMongoId: row.invoiceMongoId,
        invoiceNumber: invoice?.invoiceNumber || null,
        amountApplied: roundMoney(row.amountApplied),
        appliedAt: row.appliedAt
      };
    }),
    completedRefunds: refunds.map((row) => ({
      refundId: row.refundId,
      refundNumber: row.refundNumber,
      amount: roundMoney(row.amount),
      reason: row.reason,
      refundDate: row.refundDate,
      status: row.status
    }))
  };
}

async function createRefund({
  organizationId,
  paymentMongoId,
  userId,
  amount,
  reason,
  reasonNote = null,
  refundMethod = 'other',
  refundDate = null,
  referenceNumber = null,
  notes = null,
  unwindAllocationIds = [],
  unallocatedPortion = 0,
  idempotencyKey = null
}) {
  if (!organizationId || !paymentMongoId) {
    const err = new Error('organizationId and payment id are required');
    err.code = 'VALIDATION';
    throw err;
  }

  const refundReason = assertValidRefundReason(reason);
  if (refundReason === 'other' && !String(reasonNote || '').trim()) {
    const err = new Error('reasonNote is required when reason is other');
    err.code = 'VALIDATION';
    throw err;
  }

  if (idempotencyKey) {
    const existing = await Refund.findOne({
      organizationId,
      paymentMongoId,
      idempotencyKey: String(idempotencyKey).trim(),
      status: 'completed'
    }).lean();
    if (existing) {
      const refundAllocations = await RefundAllocation.find({
        organizationId,
        refundMongoId: existing._id
      }).lean();
      const payment = await Payment.findById(paymentMongoId).lean();
      return { refund: existing, refundAllocations, payment, idempotent: true };
    }
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

  const refundAmount = roundMoney(amount);
  if (refundAmount <= 0) {
    const err = new Error('amount must be greater than zero');
    err.code = 'VALIDATION';
    throw err;
  }

  const maxRefundable = computeRefundableAmount(payment);
  if (refundAmount > maxRefundable) {
    const err = new Error('Refund amount exceeds refundable balance on payment');
    err.code = 'EXCEEDS_REFUNDABLE';
    err.details = { maxRefundable, amount: refundAmount };
    throw err;
  }

  const unallocatedPart = roundMoney(unallocatedPortion);
  const allocationIds = Array.isArray(unwindAllocationIds)
    ? unwindAllocationIds.map(String).filter(Boolean)
    : [];

  if (unallocatedPart > roundMoney(payment.amountUnallocated)) {
    const err = new Error('unallocatedPortion exceeds payment unallocated balance');
    err.code = 'EXCEEDS_UNALLOCATED';
    throw err;
  }

  let allocationPart = 0;
  let targets = [];

  if (allocationIds.length > 0) {
    targets = await PaymentAllocation.find({
      organizationId,
      paymentMongoId: payment._id,
      status: 'active',
      paymentAllocationId: { $in: allocationIds }
    });

    if (targets.length !== allocationIds.length) {
      const err = new Error('One or more payment allocations are invalid or not active');
      err.code = 'VALIDATION';
      throw err;
    }

    allocationPart = roundMoney(
      targets.reduce((sum, row) => sum + (Number(row.amountApplied) || 0), 0)
    );
  }

  const expectedTotal = roundMoney(unallocatedPart + allocationPart);
  if (expectedTotal !== refundAmount) {
    const err = new Error(
      'Refund amount must equal unallocatedPortion plus selected allocation amounts'
    );
    err.code = 'REFUND_AMOUNT_MISMATCH';
    err.details = {
      amount: refundAmount,
      unallocatedPortion: unallocatedPart,
      allocationPortion: allocationPart
    };
    throw err;
  }

  const method = PAYMENT_INSTRUMENT_METHODS.includes(String(refundMethod || '').trim())
    ? String(refundMethod).trim()
    : 'other';

  const now = new Date();
  const refund = await Refund.create({
    organizationId,
    paymentId: payment.paymentId,
    paymentMongoId: payment._id,
    organizationRefId: payment.organizationRefId,
    contactId: payment.contactId || null,
    amount: refundAmount,
    unallocatedPortion: unallocatedPart,
    allocationPortion: allocationPart,
    refundCurrency: payment.paymentCurrency,
    refundDate: refundDate ? new Date(refundDate) : now,
    refundMethod: method,
    referenceNumber: referenceNumber ? String(referenceNumber).trim() : null,
    reason: refundReason,
    reasonNote: reasonNote ? String(reasonNote).trim() : null,
    status: 'pending',
    recordedAt: now,
    recordedBy: userId || null,
    notes: notes ? String(notes).trim() : null,
    idempotencyKey: idempotencyKey ? String(idempotencyKey).trim() : null,
    createdBy: userId || null,
    modifiedBy: userId || null
  });

  await writePaymentActivity({
    organizationId,
    paymentId: payment.paymentId,
    userId,
    action: 'refund_created',
    message: `Refund ${refund.refundNumber} created`,
    details: {
      refundId: refund.refundId,
      refundNumber: refund.refundNumber,
      amount: refundAmount,
      reason: refundReason
    }
  });

  let reversalResult = null;
  const refundAllocations = [];

  if (targets.length > 0) {
    reversalResult = await reversePaymentAllocations({
      organizationId,
      paymentMongoId: payment._id,
      userId,
      paymentAllocationIds: targets.map((row) => row.paymentAllocationId),
      reversalType: 'refund',
      reversalReason: reasonNote || refundReason,
      reversalReasonCode: refundReason,
      refundId: refund.refundId,
      refundMongoId: refund._id
    });

    refund.paymentReversalId = reversalResult.reversal.paymentReversalId;
    refund.paymentReversalMongoId = reversalResult.reversal._id;

    for (const row of targets) {
      const refundAllocation = await RefundAllocation.create({
        organizationId,
        refundId: refund.refundId,
        refundMongoId: refund._id,
        paymentAllocationId: row.paymentAllocationId,
        paymentId: payment.paymentId,
        invoiceId: row.invoiceId,
        invoiceMongoId: row.invoiceMongoId,
        amountReversed: roundMoney(row.amountApplied),
        invoiceCurrency: row.invoiceCurrency || payment.paymentCurrency
      });
      refundAllocations.push(refundAllocation.toObject());

      const invoice = await Invoice.findById(row.invoiceMongoId).select('invoiceId invoiceNumber').lean();
      await writeInvoiceActivity({
        organizationId,
        invoiceId: row.invoiceId,
        userId,
        action: 'payment_refunded',
        message: `Payment refunded via ${refund.refundNumber}`,
        details: {
          refundId: refund.refundId,
          refundNumber: refund.refundNumber,
          paymentId: payment.paymentId,
          paymentAllocationId: row.paymentAllocationId,
          amountReversed: roundMoney(row.amountApplied),
          invoiceNumber: invoice?.invoiceNumber || null
        }
      });
    }
  }

  refund.status = 'completed';
  await refund.save();

  await recalculatePaymentRollups({ organizationId, paymentMongoId: payment._id });

  if (unallocatedPart > 0) {
    await reduceBalanceFromRefundUnallocated({
      organizationId,
      paymentMongoId: payment._id,
      unallocatedPortion: unallocatedPart,
      userId
    });
  }

  await writePaymentActivity({
    organizationId,
    paymentId: payment.paymentId,
    userId,
    action: 'refund_completed',
    message: `Refund ${refund.refundNumber} completed`,
    details: {
      refundId: refund.refundId,
      refundNumber: refund.refundNumber,
      amount: refundAmount,
      unallocatedPortion: unallocatedPart,
      allocationPortion: allocationPart,
      paymentReversalId: refund.paymentReversalId || null
    }
  });

  const updatedPayment = await Payment.findById(payment._id).lean();

  return {
    refund: refund.toObject(),
    refundAllocations,
    reversal: reversalResult?.reversal || null,
    payment: updatedPayment
  };
}

async function getRefundById({ organizationId, refundIdOrMongoId }) {
  const refund = await Refund.findOne({
    organizationId,
    $or: [{ _id: refundIdOrMongoId }, { refundId: refundIdOrMongoId }]
  }).lean();

  if (!refund) {
    const err = new Error('Refund not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const refundAllocations = await RefundAllocation.find({
    organizationId,
    refundMongoId: refund._id
  }).lean();

  return { refund, refundAllocations };
}

async function listRefundsForPayment({ organizationId, paymentMongoId }) {
  return Refund.find({ organizationId, paymentMongoId })
    .sort({ refundDate: -1, createdAt: -1 })
    .lean();
}

module.exports = {
  computeRefundableAmount,
  buildPaymentRefundEligibility,
  createRefund,
  getRefundById,
  listRefundsForPayment
};
