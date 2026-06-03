/**
 * Invoice receivable rollups — payment + customer credit authorities.
 */

const Invoice = require('../models/Invoice');
const PaymentAllocation = require('../models/PaymentAllocation');
const CustomerCreditApplication = require('../models/CustomerCreditApplication');
const {
  roundMoney,
  deriveInvoicePaymentStatus,
  deriveInvoiceLifecycleStatusFromPayment
} = require('../constants/paymentLifecycle');
const { writeInvoiceActivity } = require('./invoiceActivityService');

async function sumActivePaymentAllocationsForInvoice({ organizationId, invoiceMongoId }) {
  const rows = await PaymentAllocation.find({
    organizationId,
    invoiceMongoId,
    status: 'active'
  }).lean();

  return roundMoney(rows.reduce((sum, row) => sum + (Number(row.amountApplied) || 0), 0));
}

async function sumActiveCreditApplicationsForInvoice({ organizationId, invoiceMongoId }) {
  const rows = await CustomerCreditApplication.find({
    organizationId,
    invoiceMongoId,
    status: 'active'
  }).lean();

  return roundMoney(rows.reduce((sum, row) => sum + (Number(row.amountApplied) || 0), 0));
}

async function recalculateInvoicePaymentRollups({
  organizationId,
  invoiceMongoId,
  userId = null,
  activityContext = null
}) {
  if (!organizationId || !invoiceMongoId) {
    const err = new Error('organizationId and invoiceMongoId are required');
    err.code = 'VALIDATION';
    throw err;
  }

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

  if (String(invoice.invoiceType || 'standard') === 'credit_note') {
    return { invoice: invoice.toObject(), skipped: true };
  }

  const beforePaid = roundMoney(invoice.amountPaid);
  const beforeCredit = roundMoney(invoice.creditAppliedTotal);
  const beforeDue = roundMoney(invoice.amountDue);

  const amountPaid = await sumActivePaymentAllocationsForInvoice({ organizationId, invoiceMongoId });
  const creditAppliedTotal = await sumActiveCreditApplicationsForInvoice({
    organizationId,
    invoiceMongoId
  });
  const writeOffTotal = roundMoney(invoice.writeOffTotal);
  const grandTotal = roundMoney(invoice.grandTotal);
  const amountDue = roundMoney(
    Math.max(0, grandTotal - amountPaid - writeOffTotal - creditAppliedTotal)
  );

  invoice.amountPaid = amountPaid;
  invoice.creditAppliedTotal = creditAppliedTotal;
  invoice.amountDue = amountDue;
  invoice.paymentStatus = deriveInvoicePaymentStatus({
    ...invoice.toObject(),
    amountPaid,
    creditAppliedTotal,
    amountDue,
    writeOffTotal
  });

  const allocations = await PaymentAllocation.find({
    organizationId,
    invoiceMongoId,
    status: 'active'
  })
    .sort({ appliedAt: -1 })
    .limit(1)
    .lean();
  invoice.lastPaymentAt = allocations[0]?.appliedAt || invoice.lastPaymentAt || null;

  const nextLifecycle = deriveInvoiceLifecycleStatusFromPayment({
    ...invoice.toObject(),
    amountPaid,
    creditAppliedTotal,
    amountDue,
    paymentStatus: invoice.paymentStatus
  });
  if (['Posted', 'Partially Paid', 'Paid', 'Written Off'].includes(String(invoice.status))) {
    invoice.status = nextLifecycle;
  }

  invoice.modifiedBy = userId || invoice.modifiedBy;
  await invoice.save();

  if (activityContext?.action) {
    await writeInvoiceActivity({
      organizationId,
      invoiceId: invoice.invoiceId,
      userId,
      action: activityContext.action,
      message: activityContext.message || '',
      details: {
        paymentId: activityContext.paymentId || null,
        paymentAllocationId: activityContext.paymentAllocationId || null,
        customerCreditApplicationId: activityContext.details?.customerCreditApplicationId || null,
        amountApplied: activityContext.amountApplied || activityContext.details?.amountApplied || null,
        snapshot: {
          invoiceAmountPaidBefore: beforePaid,
          invoiceAmountPaidAfter: amountPaid,
          invoiceCreditAppliedBefore: beforeCredit,
          invoiceCreditAppliedAfter: creditAppliedTotal,
          invoiceAmountDueBefore: beforeDue,
          invoiceAmountDueAfter: amountDue
        },
        ...(activityContext.details || {})
      }
    });
  }

  return { invoice: invoice.toObject(), amountPaid, creditAppliedTotal, amountDue };
}

module.exports = {
  sumActivePaymentAllocationsForInvoice,
  sumActiveCreditApplicationsForInvoice,
  recalculateInvoicePaymentRollups
};
