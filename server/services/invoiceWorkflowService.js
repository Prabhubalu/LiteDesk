/**
 * INV2 — Invoice approval workflow (mirror Quotes pattern).
 */

const {
  INVOICE_STATUS_DEFAULT,
  assertCanTransitionInvoiceStatus
} = require('../constants/invoiceLifecycle');
const { loadInvoiceOrThrow } = require('./invoiceManualService');
const { writeInvoiceActivity } = require('./invoiceActivityService');

async function submitInvoiceForApproval({ organizationId, invoiceRef, userId }) {
  const invoice = await loadInvoiceOrThrow({ organizationId, invoiceRef });
  const fromStatus = String(invoice.status || '').trim();

  if (fromStatus !== INVOICE_STATUS_DEFAULT) {
    const err = new Error('Only Draft invoices can be submitted for approval.');
    err.code = 'INVOICE_NOT_DRAFT';
    throw err;
  }

  assertCanTransitionInvoiceStatus(fromStatus, 'Pending Approval');
  invoice.status = 'Pending Approval';
  invoice.approvalRequired = true;
  invoice.approvalStatus = 'pending';
  invoice.approvalLocked = true;
  invoice.modifiedBy = userId || null;
  await invoice.save();

  await writeInvoiceActivity({
    organizationId,
    invoiceId: invoice.invoiceId,
    userId,
    action: 'invoice_submitted_for_approval',
    message: `Invoice ${invoice.invoiceNumber} submitted for approval`,
    details: { invoiceNumber: invoice.invoiceNumber }
  });

  return invoice.toObject();
}

async function approveInvoice({ organizationId, invoiceRef, userId }) {
  const invoice = await loadInvoiceOrThrow({ organizationId, invoiceRef });
  const fromStatus = String(invoice.status || '').trim();

  if (fromStatus !== 'Pending Approval') {
    const err = new Error('Only Pending Approval invoices can be approved.');
    err.code = 'INVOICE_NOT_PENDING';
    throw err;
  }

  assertCanTransitionInvoiceStatus(fromStatus, 'Approved');
  invoice.status = 'Approved';
  invoice.approvalStatus = 'approved';
  invoice.approvalLocked = true;
  invoice.modifiedBy = userId || null;
  await invoice.save();

  await writeInvoiceActivity({
    organizationId,
    invoiceId: invoice.invoiceId,
    userId,
    action: 'invoice_approved',
    message: `Invoice ${invoice.invoiceNumber} approved`,
    details: { invoiceNumber: invoice.invoiceNumber }
  });

  return invoice.toObject();
}

async function rejectInvoice({ organizationId, invoiceRef, userId, reason }) {
  const invoice = await loadInvoiceOrThrow({ organizationId, invoiceRef });
  const fromStatus = String(invoice.status || '').trim();

  if (fromStatus !== 'Pending Approval') {
    const err = new Error('Only Pending Approval invoices can be rejected.');
    err.code = 'INVOICE_NOT_PENDING';
    throw err;
  }

  assertCanTransitionInvoiceStatus(fromStatus, 'Draft');
  invoice.status = INVOICE_STATUS_DEFAULT;
  invoice.approvalStatus = 'rejected';
  invoice.approvalLocked = false;
  invoice.modifiedBy = userId || null;
  await invoice.save();

  await writeInvoiceActivity({
    organizationId,
    invoiceId: invoice.invoiceId,
    userId,
    action: 'invoice_rejected',
    message: `Invoice ${invoice.invoiceNumber} rejected`,
    details: {
      invoiceNumber: invoice.invoiceNumber,
      reason: reason ? String(reason).trim() : null
    }
  });

  return invoice.toObject();
}

module.exports = {
  submitInvoiceForApproval,
  approveInvoice,
  rejectInvoice
};
