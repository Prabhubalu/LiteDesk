/**
 * CustomerCreditApplication — credit authority apply/reverse.
 */

const Invoice = require('../models/Invoice');
const CustomerCreditBalance = require('../models/CustomerCreditBalance');
const CustomerCreditApplication = require('../models/CustomerCreditApplication');
const { roundMoney, PAYABLE_INVOICE_STATUSES } = require('../constants/paymentLifecycle');
const {
  recalculateCreditBalanceRollups,
  listCreditBalancesForAccount
} = require('./customerCreditBalanceService');
const { recalculateInvoicePaymentRollups } = require('./invoicePaymentRollupService');
const { writePaymentActivity } = require('./paymentActivityService');
const { writeInvoiceActivity } = require('./invoiceActivityService');

function assertCreditApplicableInvoice(invoice, { organizationRefId, currency } = {}) {
  if (!invoice) {
    const err = new Error('Invoice not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (String(invoice.invoiceType || 'standard') !== 'standard') {
    const err = new Error('Only standard Posted invoices can receive customer credit');
    err.code = 'VALIDATION';
    throw err;
  }
  if (!PAYABLE_INVOICE_STATUSES.includes(String(invoice.status || '').trim())) {
    const err = new Error(`Invoice status "${invoice.status}" is not credit-applicable`);
    err.code = 'INVOICE_NOT_PAYABLE';
    throw err;
  }
  if (organizationRefId && String(invoice.organizationRefId || '') !== String(organizationRefId)) {
    const err = new Error('Invoice account does not match credit balance account');
    err.code = 'ACCOUNT_MISMATCH';
    throw err;
  }
  if (currency && invoice.currency && currency !== invoice.currency) {
    const err = new Error('Invoice currency does not match credit balance currency');
    err.code = 'CURRENCY_MISMATCH';
    throw err;
  }
  if (roundMoney(invoice.amountDue) <= 0) {
    const err = new Error('Invoice has no amount due');
    err.code = 'NOTHING_TO_APPLY';
    throw err;
  }
}

async function applyCustomerCredit({
  organizationId,
  userId,
  customerCreditBalanceMongoId,
  invoiceMongoId,
  amountApplied
}) {
  if (!organizationId || !customerCreditBalanceMongoId || !invoiceMongoId) {
    const err = new Error('organizationId, balance id, and invoice id are required');
    err.code = 'VALIDATION';
    throw err;
  }

  const applyAmount = roundMoney(amountApplied);
  if (applyAmount <= 0) {
    const err = new Error('amountApplied must be greater than zero');
    err.code = 'VALIDATION';
    throw err;
  }

  const balance = await CustomerCreditBalance.findOne({
    _id: customerCreditBalanceMongoId,
    organizationId,
    status: { $in: ['active', 'fully_applied'] }
  });

  if (!balance) {
    const err = new Error('Customer credit balance not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  if (applyAmount > roundMoney(balance.amountRemaining)) {
    const err = new Error('amountApplied exceeds credit balance remaining');
    err.code = 'EXCEEDS_CREDIT_BALANCE';
    throw err;
  }

  const invoice = await Invoice.findOne({
    _id: invoiceMongoId,
    organizationId,
    deletedAt: null
  });

  assertCreditApplicableInvoice(invoice, {
    organizationRefId: balance.organizationRefId,
    currency: balance.currency
  });

  if (applyAmount > roundMoney(invoice.amountDue)) {
    const err = new Error('amountApplied exceeds invoice amount due');
    err.code = 'EXCEEDS_AMOUNT_DUE';
    throw err;
  }

  const application = await CustomerCreditApplication.create({
    organizationId,
    customerCreditBalanceId: balance.customerCreditBalanceId,
    customerCreditBalanceMongoId: balance._id,
    invoiceId: invoice.invoiceId,
    invoiceMongoId: invoice._id,
    amountApplied: applyAmount,
    invoiceCurrency: invoice.currency || balance.currency,
    appliedBy: userId || null
  });

  await recalculateCreditBalanceRollups({ organizationId, balanceMongoId: balance._id });

  await recalculateInvoicePaymentRollups({
    organizationId,
    invoiceMongoId: invoice._id,
    userId,
    activityContext: {
      action: 'customer_credit_applied',
      message: 'Customer credit applied to invoice',
      details: {
        customerCreditApplicationId: application.customerCreditApplicationId,
        customerCreditBalanceId: balance.customerCreditBalanceId,
        amountApplied: applyAmount
      }
    }
  });

  if (balance.sourcePaymentId) {
    await writePaymentActivity({
      organizationId,
      paymentId: balance.sourcePaymentId,
      userId,
      action: 'customer_credit_applied',
      message: 'Customer credit applied from balance',
      details: {
        customerCreditApplicationId: application.customerCreditApplicationId,
        customerCreditBalanceId: balance.customerCreditBalanceId,
        invoiceId: invoice.invoiceId,
        amountApplied: applyAmount
      }
    });
  }

  await writeInvoiceActivity({
    organizationId,
    invoiceId: invoice.invoiceId,
    userId,
    action: 'customer_credit_applied',
    message: `Customer credit applied (${applyAmount})`,
    details: {
      customerCreditApplicationId: application.customerCreditApplicationId,
      customerCreditBalanceId: balance.customerCreditBalanceId,
      amountApplied: applyAmount
    }
  });

  const updatedBalance = await CustomerCreditBalance.findById(balance._id).lean();
  const updatedInvoice = await Invoice.findById(invoice._id).lean();

  return {
    application: application.toObject(),
    balance: updatedBalance,
    invoice: updatedInvoice
  };
}

async function applyCustomerCreditAuto({
  organizationId,
  userId,
  invoiceMongoId,
  amountApplied = null
}) {
  const invoice = await Invoice.findOne({
    _id: invoiceMongoId,
    organizationId,
    deletedAt: null
  });

  if (!invoice) {
    const err = new Error('Invoice not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const due = roundMoney(invoice.amountDue);
  const targetAmount = amountApplied != null ? roundMoney(amountApplied) : due;
  if (targetAmount <= 0) {
    const err = new Error('Nothing to apply');
    err.code = 'NOTHING_TO_APPLY';
    throw err;
  }

  const balances = await listCreditBalancesForAccount({
    organizationId,
    organizationRefId: invoice.organizationRefId,
    currency: invoice.currency
  });

  let remaining = Math.min(targetAmount, due);
  const applications = [];

  for (const balanceRow of balances) {
    if (remaining <= 0) break;
    const applyAmount = roundMoney(Math.min(remaining, balanceRow.amountRemaining));
    if (applyAmount <= 0) continue;

    const result = await applyCustomerCredit({
      organizationId,
      userId,
      customerCreditBalanceMongoId: balanceRow._id,
      invoiceMongoId: invoice._id,
      amountApplied: applyAmount
    });
    applications.push(result.application);
    remaining = roundMoney(remaining - applyAmount);
  }

  if (!applications.length) {
    const err = new Error('No customer credit balance available');
    err.code = 'NO_CREDIT_BALANCE';
    throw err;
  }

  return {
    applications,
    invoice: await Invoice.findById(invoice._id).lean()
  };
}

async function reverseCustomerCreditApplication({
  organizationId,
  userId,
  customerCreditApplicationId,
  reversalReason
}) {
  const reason = String(reversalReason || '').trim();
  if (!reason) {
    const err = new Error('reversalReason is required');
    err.code = 'VALIDATION';
    throw err;
  }

  const application = await CustomerCreditApplication.findOne({
    organizationId,
    customerCreditApplicationId,
    status: 'active'
  });

  if (!application) {
    const err = new Error('Customer credit application not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  application.status = 'reversed';
  application.reversedAt = new Date();
  application.reversedBy = userId || null;
  application.reversalReason = reason;
  await application.save();

  await recalculateCreditBalanceRollups({
    organizationId,
    balanceMongoId: application.customerCreditBalanceMongoId
  });

  await recalculateInvoicePaymentRollups({
    organizationId,
    invoiceMongoId: application.invoiceMongoId,
    userId,
    activityContext: {
      action: 'customer_credit_reversed',
      message: 'Customer credit application reversed',
      details: {
        customerCreditApplicationId: application.customerCreditApplicationId,
        reversalReason: reason
      }
    }
  });

  const balance = await CustomerCreditBalance.findById(application.customerCreditBalanceMongoId).lean();

  return {
    application: application.toObject(),
    balance
  };
}

module.exports = {
  applyCustomerCredit,
  applyCustomerCreditAuto,
  reverseCustomerCreditApplication
};
