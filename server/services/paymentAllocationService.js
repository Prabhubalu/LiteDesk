/**
 * Apply PaymentAllocation rows to Posted invoices.
 */

const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const PaymentAllocation = require('../models/PaymentAllocation');
const { roundMoney, PAYABLE_INVOICE_STATUSES } = require('../constants/paymentLifecycle');
const { recalculateInvoicePaymentRollups } = require('./invoicePaymentRollupService');
const { recalculatePaymentRollups } = require('./paymentRollupService');
const { writePaymentActivity } = require('./paymentActivityService');

function assertPayableInvoice(invoice, { organizationRefId, paymentCurrency } = {}) {
  if (!invoice) {
    const err = new Error('Invoice not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  if (String(invoice.invoiceType || 'standard') !== 'standard') {
    const err = new Error('Only standard Posted invoices can receive payments');
    err.code = 'VALIDATION';
    throw err;
  }

  if (!PAYABLE_INVOICE_STATUSES.includes(String(invoice.status || '').trim())) {
    const err = new Error(`Invoice status "${invoice.status}" is not payable`);
    err.code = 'INVOICE_NOT_PAYABLE';
    throw err;
  }

  if (
    organizationRefId &&
    String(invoice.organizationRefId || '') !== String(organizationRefId)
  ) {
    const err = new Error('Invoice account does not match payment account');
    err.code = 'ACCOUNT_MISMATCH';
    throw err;
  }

  if (paymentCurrency && invoice.currency && paymentCurrency !== invoice.currency) {
    const err = new Error('Invoice currency does not match payment currency');
    err.code = 'CURRENCY_MISMATCH';
    throw err;
  }

  if (roundMoney(invoice.amountDue) <= 0) {
    const err = new Error('Invoice has no amount due');
    err.code = 'NOTHING_TO_APPLY';
    throw err;
  }
}

async function applyPaymentAllocations({
  organizationId,
  paymentMongoId,
  userId,
  allocations = [],
  manualOverride = false
}) {
  if (!organizationId || !paymentMongoId) {
    const err = new Error('organizationId and payment id are required');
    err.code = 'VALIDATION';
    throw err;
  }

  if (!Array.isArray(allocations) || allocations.length === 0) {
    const err = new Error('allocations are required');
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

  const paymentCurrency = String(payment.paymentCurrency || 'USD');
  const created = [];
  const affectedInvoiceMongoIds = new Set();

  for (const row of allocations) {
    const invoiceMongoId = row.invoiceMongoId || row._id;
    const invoice = await Invoice.findOne({
      organizationId,
      deletedAt: null,
      ...(invoiceMongoId
        ? { _id: invoiceMongoId }
        : { invoiceId: String(row.invoiceId || '').trim() })
    });

    assertPayableInvoice(invoice, {
      organizationRefId: payment.organizationRefId,
      paymentCurrency
    });

    const amountApplied = roundMoney(row.amountApplied);
    if (amountApplied <= 0) {
      const err = new Error('amountApplied must be greater than zero');
      err.code = 'VALIDATION';
      throw err;
    }

    if (amountApplied > roundMoney(invoice.amountDue)) {
      const err = new Error('amountApplied exceeds invoice amount due');
      err.code = 'EXCEEDS_AMOUNT_DUE';
      err.details = {
        invoiceId: invoice.invoiceId,
        amountDue: roundMoney(invoice.amountDue),
        amountApplied
      };
      throw err;
    }

    const allocation = await PaymentAllocation.create({
      organizationId,
      paymentId: payment.paymentId,
      paymentMongoId: payment._id,
      invoiceId: invoice.invoiceId,
      invoiceMongoId: invoice._id,
      invoiceLineId: row.invoiceLineId || null,
      amountApplied,
      invoiceCurrency: invoice.currency || paymentCurrency,
      paymentCurrency,
      exchangeRateSnapshot:
        paymentCurrency === (invoice.currency || paymentCurrency)
          ? { from: paymentCurrency, to: invoice.currency || paymentCurrency, rate: 1 }
          : row.exchangeRateSnapshot || payment.exchangeRateSnapshot || null,
      appliedBy: userId || null
    });

    created.push(allocation.toObject());
    affectedInvoiceMongoIds.add(String(invoice._id));
  }

  await recalculatePaymentRollups({ organizationId, paymentMongoId: payment._id });

  for (const invoiceMongoId of affectedInvoiceMongoIds) {
    const firstForInvoice = created.find((row) => String(row.invoiceMongoId) === invoiceMongoId);
    await recalculateInvoicePaymentRollups({
      organizationId,
      invoiceMongoId,
      userId,
      activityContext: {
        action: 'payment_applied',
        message: `Payment applied to invoice`,
        paymentId: payment.paymentId,
        paymentAllocationId: firstForInvoice?.paymentAllocationId || null,
        amountApplied: firstForInvoice?.amountApplied || null
      }
    });
  }

  await writePaymentActivity({
    organizationId,
    paymentId: payment.paymentId,
    userId,
    action: 'payment_allocated',
    message: `Payment allocated to ${created.length} invoice(s)`,
    details: {
      manualOverride: Boolean(manualOverride),
      allocations: created.map((row) => ({
        paymentAllocationId: row.paymentAllocationId,
        invoiceId: row.invoiceId,
        amountApplied: row.amountApplied
      }))
    }
  });

  const updatedPayment = await Payment.findById(payment._id).lean();
  return { payment: updatedPayment, allocations: created };
}

module.exports = {
  assertPayableInvoice,
  applyPaymentAllocations
};
