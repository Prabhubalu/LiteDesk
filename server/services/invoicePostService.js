/**
 * INV0 + INV3 — Post invoice or credit note: transition to Posted, write allocations, lock snapshots.
 */

const Invoice = require('../models/Invoice');
const SalesOrder = require('../models/SalesOrder');
const InvoiceLine = require('../models/InvoiceLine');
const InvoiceSection = require('../models/InvoiceSection');
const { assertCanTransitionInvoiceStatus } = require('../constants/invoiceLifecycle');
const {
  postInvoiceAllocations,
  postCreditNoteAllocations
} = require('./salesOrderInvoiceAllocationService');
const { writeInvoiceActivity } = require('./invoiceActivityService');

async function postInvoice({ organizationId, invoiceMongoId, userId }) {
  if (!organizationId || !invoiceMongoId) {
    const err = new Error('organizationId and invoice id are required');
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

  const fromStatus = String(invoice.status || '').trim();
  assertCanTransitionInvoiceStatus(fromStatus, 'Posted');

  const lines = await InvoiceLine.find({ organizationId, invoiceId: invoice._id }).sort({ lineOrder: 1 });
  const isCreditNote = String(invoice.invoiceType || 'standard') === 'credit_note';

  let allocationResult;
  if (isCreditNote) {
    if (!invoice.sourceInvoiceId) {
      const err = new Error('Credit note missing sourceInvoiceId');
      err.code = 'VALIDATION';
      throw err;
    }
    allocationResult = await postCreditNoteAllocations({
      organizationId,
      creditNote: invoice,
      lines,
      userId,
      reversalReason: invoice.creditReasonNote || invoice.creditReason || 'credit_note'
    });
  } else {
    allocationResult = await postInvoiceAllocations({
      organizationId,
      invoice,
      lines,
      userId
    });
  }

  const salesOrdersByMongoId = new Map();
  for (const salesOrderMongoId of allocationResult.affectedSalesOrderIds || []) {
    const salesOrder = await SalesOrder.findOne({ _id: salesOrderMongoId, organizationId })
      .select('salesOrderId salesOrderNumber')
      .lean();
    if (salesOrder) salesOrdersByMongoId.set(String(salesOrderMongoId), salesOrder);
  }

  const allocationDetails = (allocationResult.allocations || []).map((row) => {
    const salesOrder = salesOrdersByMongoId.get(String(row.salesOrderId));
    return {
      invoiceNumber: invoice.invoiceNumber,
      salesOrderNumber: salesOrder?.salesOrderNumber || null,
      salesOrderLineId: row.salesOrderLineId,
      allocatedQty: Number(row.quantityAllocated) || 0,
      allocatedAmount: Number(row.amountAllocated) || 0,
      salesOrderInvoiceAllocationId: row.salesOrderInvoiceAllocationId,
      allocationType: row.allocationType || 'standard'
    };
  });

  const now = new Date();
  invoice.status = 'Posted';
  invoice.postedAt = now;
  invoice.approvalLocked = true;
  if (isCreditNote) {
    invoice.amountDue = 0;
    invoice.paymentStatus = 'paid';
  } else {
    invoice.amountDue = Number(invoice.grandTotal) || 0;
    invoice.paymentStatus = 'unpaid';
  }
  invoice.modifiedBy = userId || null;
  await invoice.save();

  await InvoiceLine.updateMany(
    { organizationId, invoiceId: invoice._id },
    { $set: { lockedSnapshot: true } }
  );
  await InvoiceSection.updateMany(
    { organizationId, invoiceId: invoice._id },
    { $set: { lockedSnapshot: true } }
  );

  if (isCreditNote) {
    await writeInvoiceActivity({
      organizationId,
      invoiceId: invoice.invoiceId,
      userId,
      action: 'credit_note_posted',
      message: `Credit note ${invoice.invoiceNumber} posted`,
      details: {
        creditNoteNumber: invoice.invoiceNumber,
        sourceInvoiceId: invoice.sourceInvoiceId,
        creditReason: invoice.creditReason || null,
        grandTotal: invoice.grandTotal,
        totalCreditAmount: allocationResult.totalCreditAmount || Math.abs(Number(invoice.grandTotal) || 0),
        allocationCount: allocationResult.allocations.length,
        allocations: allocationDetails
      }
    });

    if (invoice.sourceInvoiceId) {
      await writeInvoiceActivity({
        organizationId,
        invoiceId: invoice.sourceInvoiceId,
        userId,
        action: 'invoice_credited',
        message: `Credit note ${invoice.invoiceNumber} posted against this invoice`,
        details: {
          creditNoteNumber: invoice.invoiceNumber,
          creditNoteId: invoice.invoiceId,
          creditReason: invoice.creditReason || null,
          creditedAmount: allocationResult.totalCreditAmount || Math.abs(Number(invoice.grandTotal) || 0),
          reversalReason: invoice.creditReasonNote || invoice.creditReason || 'credit_note',
          allocations: allocationDetails
        }
      });
    }

    await writeInvoiceActivity({
      organizationId,
      invoiceId: invoice.invoiceId,
      userId,
      action: 'invoice_allocation_reversed',
      message: `Allocation reversals posted for credit note ${invoice.invoiceNumber}`,
      details: {
        creditNoteNumber: invoice.invoiceNumber,
        reversalReason: invoice.creditReasonNote || invoice.creditReason || 'credit_note',
        allocations: allocationDetails
      }
    });
  } else {
    await writeInvoiceActivity({
      organizationId,
      invoiceId: invoice.invoiceId,
      userId,
      action: 'invoice_posted',
      message: `Invoice ${invoice.invoiceNumber} posted`,
      details: {
        invoiceNumber: invoice.invoiceNumber,
        grandTotal: invoice.grandTotal,
        allocationCount: allocationResult.allocations.length,
        salesOrderIds: allocationResult.affectedSalesOrderIds,
        allocations: allocationDetails
      }
    });
  }

  return {
    invoice: invoice.toObject(),
    allocations: allocationResult.allocations,
    sourceInvoice: allocationResult.sourceInvoice || null
  };
}

module.exports = {
  postInvoice
};
