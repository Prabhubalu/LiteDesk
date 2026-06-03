/**
 * Customer credit balance — materialize from payment unallocated surplus.
 */

const CustomerCreditBalance = require('../models/CustomerCreditBalance');
const CustomerCreditApplication = require('../models/CustomerCreditApplication');
const { roundMoney } = require('../constants/paymentLifecycle');
const { writePaymentActivity } = require('./paymentActivityService');

async function sumActiveApplicationsForBalance({ organizationId, balanceMongoId }) {
  const rows = await CustomerCreditApplication.find({
    organizationId,
    customerCreditBalanceMongoId: balanceMongoId,
    status: 'active'
  }).lean();

  return roundMoney(rows.reduce((sum, row) => sum + (Number(row.amountApplied) || 0), 0));
}

async function recalculateCreditBalanceRollups({ organizationId, balanceMongoId }) {
  const balance = await CustomerCreditBalance.findOne({
    _id: balanceMongoId,
    organizationId
  });

  if (!balance) {
    const err = new Error('Customer credit balance not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const amountAppliedTotal = await sumActiveApplicationsForBalance({
    organizationId,
    balanceMongoId: balance._id
  });

  balance.amountAppliedTotal = amountAppliedTotal;
  balance.amountRemaining = roundMoney(Math.max(0, Number(balance.amount) - amountAppliedTotal));

  if (balance.amountRemaining <= 0 && amountAppliedTotal > 0) {
    balance.status = 'fully_applied';
  } else if (balance.status === 'fully_applied' && balance.amountRemaining > 0) {
    balance.status = 'active';
  }

  await balance.save();
  return balance.toObject();
}

async function syncCreditBalanceFromPayment({ organizationId, payment, userId = null }) {
  if (!organizationId || !payment) return null;

  const unallocated = roundMoney(payment.amountUnallocated);
  if (unallocated <= 0) {
    const existing = await CustomerCreditBalance.findOne({
      organizationId,
      sourcePaymentMongoId: payment._id,
      status: { $in: ['active', 'fully_applied'] }
    });
    if (existing && existing.amountAppliedTotal <= 0) {
      existing.status = 'void';
      existing.amount = 0;
      existing.amountRemaining = 0;
      await existing.save();
    }
    return existing ? existing.toObject() : null;
  }

  let balance = await CustomerCreditBalance.findOne({
    organizationId,
    sourcePaymentMongoId: payment._id
  });

  if (!balance) {
    balance = await CustomerCreditBalance.create({
      organizationId,
      organizationRefId: payment.organizationRefId,
      contactId: payment.contactId || null,
      sourcePaymentId: payment.paymentId,
      sourcePaymentMongoId: payment._id,
      amount: unallocated,
      amountRemaining: unallocated,
      amountAppliedTotal: 0,
      currency: payment.paymentCurrency || 'USD',
      status: 'active',
      createdBy: userId || null,
      modifiedBy: userId || null
    });

    await writePaymentActivity({
      organizationId,
      paymentId: payment.paymentId,
      userId,
      action: 'customer_credit_balance_created',
      message: `Customer credit balance created from payment ${payment.paymentNumber}`,
      details: {
        customerCreditBalanceId: balance.customerCreditBalanceId,
        amount: unallocated,
        currency: balance.currency
      }
    });

    return balance.toObject();
  }

  const applied = await sumActiveApplicationsForBalance({
    organizationId,
    balanceMongoId: balance._id
  });

  balance.amount = unallocated + applied;
  balance.amountAppliedTotal = applied;
  balance.amountRemaining = roundMoney(Math.max(0, unallocated));
  balance.currency = payment.paymentCurrency || balance.currency;
  balance.status = balance.amountRemaining <= 0 && applied > 0 ? 'fully_applied' : 'active';
  balance.modifiedBy = userId || balance.modifiedBy;
  await balance.save();

  return balance.toObject();
}

async function reduceBalanceFromRefundUnallocated({
  organizationId,
  paymentMongoId,
  unallocatedPortion,
  userId = null
}) {
  const portion = roundMoney(unallocatedPortion);
  if (portion <= 0) return null;

  const balance = await CustomerCreditBalance.findOne({
    organizationId,
    sourcePaymentMongoId: paymentMongoId,
    status: { $in: ['active', 'fully_applied'] }
  });

  if (!balance) return null;

  balance.amount = roundMoney(Math.max(0, Number(balance.amount) - portion));
  balance.amountRemaining = roundMoney(Math.max(0, Number(balance.amountRemaining) - portion));
  if (balance.amount <= 0 || balance.amountRemaining <= 0) {
    balance.status = balance.amountAppliedTotal > 0 ? 'fully_applied' : 'void';
    balance.amountRemaining = 0;
  }
  balance.modifiedBy = userId || balance.modifiedBy;
  await balance.save();
  return balance.toObject();
}

async function listCreditBalancesForAccount({ organizationId, organizationRefId, currency = null }) {
  const filter = {
    organizationId,
    organizationRefId,
    status: { $in: ['active', 'fully_applied'] },
    amountRemaining: { $gt: 0 }
  };
  if (currency) filter.currency = String(currency).trim();

  return CustomerCreditBalance.find(filter).sort({ createdAt: 1 }).lean();
}

module.exports = {
  sumActiveApplicationsForBalance,
  recalculateCreditBalanceRollups,
  syncCreditBalanceFromPayment,
  reduceBalanceFromRefundUnallocated,
  listCreditBalancesForAccount
};
