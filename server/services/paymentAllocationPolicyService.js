/**
 * Default allocation policy — oldest due date first.
 */

const { roundMoney } = require('../constants/paymentLifecycle');

function compareInvoicesForAutoApply(a, b) {
  const dueA = a?.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
  const dueB = b?.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
  if (dueA !== dueB) return dueA - dueB;

  const dateA = a?.invoiceDate ? new Date(a.invoiceDate).getTime() : 0;
  const dateB = b?.invoiceDate ? new Date(b.invoiceDate).getTime() : 0;
  if (dateA !== dateB) return dateA - dateB;

  return String(a?.invoiceNumber || '').localeCompare(String(b?.invoiceNumber || ''));
}

function sortInvoicesForAutoApply(invoices) {
  return [...(invoices || [])].sort(compareInvoicesForAutoApply);
}

function buildAutoApplyPlan({ paymentAmount, invoices, paymentCurrency }) {
  const amount = roundMoney(paymentAmount);
  if (amount <= 0) return [];

  const sorted = sortInvoicesForAutoApply(invoices);
  const plan = [];
  let remaining = amount;

  for (const invoice of sorted) {
    if (remaining <= 0) break;

    const due = roundMoney(invoice.amountDue);
    if (due <= 0) continue;

    if (paymentCurrency && invoice.currency && paymentCurrency !== invoice.currency) {
      continue;
    }

    const applyAmount = roundMoney(Math.min(remaining, due));
    if (applyAmount <= 0) continue;

    plan.push({
      invoiceId: invoice.invoiceId,
      invoiceMongoId: invoice._id,
      amountApplied: applyAmount,
      invoiceCurrency: invoice.currency || paymentCurrency || 'USD'
    });
    remaining = roundMoney(remaining - applyAmount);
  }

  return plan;
}

module.exports = {
  compareInvoicesForAutoApply,
  sortInvoicesForAutoApply,
  buildAutoApplyPlan
};
