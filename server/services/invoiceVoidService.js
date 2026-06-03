/**
 * INV1 — Void Posted invoice and reverse allocations.
 */

const Invoice = require('../models/Invoice');
const { assertCanTransitionInvoiceStatus } = require('../constants/invoiceLifecycle');
const { reverseInvoiceAllocations } = require('./salesOrderInvoiceAllocationService');
const { writeInvoiceActivity } = require('./invoiceActivityService');
const { writeSalesOrderActivity } = require('./salesOrderActivityService');
const SalesOrder = require('../models/SalesOrder');

async function voidInvoice({ organizationId, invoiceMongoId, userId, reversalReason }) {
  if (!organizationId || !invoiceMongoId) {
    const err = new Error('organizationId and invoice id are required');
    err.code = 'VALIDATION';
    throw err;
  }

  const reason = String(reversalReason || '').trim();
  if (!reason) {
    const err = new Error('reversalReason is required');
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
  assertCanTransitionInvoiceStatus(fromStatus, 'Void');

  if ((Number(invoice.amountPaid) || 0) > 0) {
    const err = new Error('Cannot void an invoice with payments applied.');
    err.code = 'INVOICE_HAS_PAYMENTS';
    throw err;
  }

  if (String(invoice.invoiceType || 'standard') === 'credit_note') {
    const err = new Error('Void is not supported for credit notes in this release.');
    err.code = 'VALIDATION';
    throw err;
  }

  const reversalResult = await reverseInvoiceAllocations({
    organizationId,
    invoiceId: invoice._id,
    userId,
    reversalReason: reason
  });

  invoice.status = 'Void';
  invoice.voidedAt = new Date();
  invoice.modifiedBy = userId || null;
  await invoice.save();

  const allocationSummaries = (reversalResult.reversed || []).map((row) => ({
    salesOrderLineId: row.salesOrderLineId,
    allocatedQty: Number(row.quantityAllocated) || 0,
    allocatedAmount: Number(row.amountAllocated) || 0
  }));

  await writeInvoiceActivity({
    organizationId,
    invoiceId: invoice.invoiceId,
    userId,
    action: 'invoice_voided',
    message: `Invoice ${invoice.invoiceNumber} voided`,
    details: {
      invoiceNumber: invoice.invoiceNumber,
      reversalReason: reason,
      allocations: allocationSummaries
    }
  });

  for (const salesOrderMongoId of reversalResult.affectedSalesOrderIds || []) {
    const salesOrder = await SalesOrder.findOne({ _id: salesOrderMongoId, organizationId }).lean();
    if (!salesOrder) continue;
    await writeSalesOrderActivity({
      organizationId,
      salesOrderId: salesOrder.salesOrderId,
      userId,
      action: 'sales_order_invoice_voided',
      message: `Invoice ${invoice.invoiceNumber} voided`,
      details: {
        invoiceNumber: invoice.invoiceNumber,
        salesOrderNumber: salesOrder.salesOrderNumber,
        reversalReason: reason
      }
    });
  }

  return {
    invoice: invoice.toObject(),
    reversed: reversalResult.reversed
  };
}

module.exports = {
  voidInvoice
};
