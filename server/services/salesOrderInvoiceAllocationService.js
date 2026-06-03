/**
 * SO3 + INV0 — Invoice allocation contract (schema + rollups + post/reverse).
 */

const SalesOrder = require('../models/SalesOrder');
const SalesOrderLine = require('../models/SalesOrderLine');
const SalesOrderInvoiceAllocation = require('../models/SalesOrderInvoiceAllocation');
const Invoice = require('../models/Invoice');
const InvoiceLine = require('../models/InvoiceLine');
const { computeLineRemainingToCredit } = require('./invoiceCreditNoteService');
const { SALES_ORDER_INVOICE_STATUSES } = require('../constants/salesOrderLineage');
const { writeSalesOrderActivity } = require('./salesOrderActivityService');

const DEFAULT_BILL_ON = 'fulfill';

function computeLineRemainingToInvoice(line, billOn = DEFAULT_BILL_ON) {
  const qty = Number(line?.quantity) || 0;
  const fulfilled = Number(line?.quantityFulfilled) || 0;
  const cancelled = Number(line?.quantityCancelled) || 0;
  const invoiced = Number(line?.quantityInvoiced) || 0;
  const billableBase =
    billOn === 'order' ? Math.max(0, qty - cancelled) : Math.max(0, fulfilled - cancelled);
  return Math.max(0, billableBase - invoiced);
}

function deriveInvoiceStatusFromLines(lines) {
  const visible = (lines || []).filter((line) => line && line.hiddenLine !== true);
  if (!visible.length) return 'not_invoiced';

  let anyInvoiced = false;
  let allBillableInvoiced = true;

  for (const line of visible) {
    const invoiced = Number(line.quantityInvoiced) || 0;
    const billable = Math.max(0, (Number(line.quantityFulfilled) || 0) - (Number(line.quantityCancelled) || 0));
    if (invoiced > 0) anyInvoiced = true;
    if (billable > 0 && invoiced < billable) allBillableInvoiced = false;
  }

  if (!anyInvoiced) return 'not_invoiced';
  if (allBillableInvoiced) return 'fully_invoiced';
  return 'partially_invoiced';
}

function rollupInvoiceFieldsFromLines(lines, grandTotal = 0) {
  const invoiceStatus = deriveInvoiceStatusFromLines(lines);
  let invoicedAmount = 0;

  for (const line of lines || []) {
    if (!line || line.hiddenLine === true) continue;
    const qty = Number(line.quantity) || 0;
    if (qty <= 0) continue;
    const unitTotal = (Number(line.lineTotal) || 0) / qty;
    invoicedAmount += (Number(line.quantityInvoiced) || 0) * unitTotal;
  }

  const remainingBillableAmount = Math.max(0, (Number(grandTotal) || 0) - invoicedAmount);

  return {
    invoiceStatus,
    invoicedAmount,
    remainingBillableAmount
  };
}

async function listSalesOrderInvoiceAllocations({ organizationId, salesOrderId }) {
  return SalesOrderInvoiceAllocation.find({ organizationId, salesOrderId })
    .sort({ createdAt: -1 })
    .lean();
}

async function buildInvoiceReadinessSummary({ organizationId, salesOrderId, lines, billOn = DEFAULT_BILL_ON }) {
  const allocations = await listSalesOrderInvoiceAllocations({ organizationId, salesOrderId });
  const lineSummaries = (lines || [])
    .filter((line) => line && line.hiddenLine !== true && String(line.lineType || '') !== 'bundle_component')
    .map((line) => ({
      salesOrderLineId: line.salesOrderLineId,
      itemNameSnapshot: line.itemNameSnapshot || line.skuSnapshot || null,
      sourceQuoteLineId: line.sourceQuoteLineId || null,
      quantity: Number(line.quantity) || 0,
      quantityFulfilled: Number(line.quantityFulfilled) || 0,
      quantityInvoiced: Number(line.quantityInvoiced) || 0,
      quantityRemainingToInvoice: computeLineRemainingToInvoice(line, billOn)
    }));

  const billingCoverage = await buildSalesOrderBillingCoverage({
    organizationId,
    salesOrderId,
    allocations
  });

  return {
    billOnPolicy: billOn,
    invoiceModuleImplemented: true,
    allocationCount: allocations.length,
    lines: lineSummaries,
    supportedInvoiceStatuses: SALES_ORDER_INVOICE_STATUSES,
    ...billingCoverage
  };
}

async function buildSalesOrderBillingCoverage({ organizationId, salesOrderId, allocations, order = null }) {
  const rows = allocations || (await listSalesOrderInvoiceAllocations({ organizationId, salesOrderId }));
  const activeRows = rows.filter((row) => row && row.status === 'active');
  const draftInvoices = await Invoice.find({
    organizationId,
    sourceSalesOrderIds: salesOrderId,
    status: 'Draft',
    deletedAt: null
  })
    .select('invoiceId invoiceNumber status grandTotal postedAt amountDue invoiceDate')
    .lean();

  const invoiceMongoIds = [
    ...new Set(
      [...activeRows.map((row) => String(row.invoiceId)), ...draftInvoices.map((row) => String(row._id))].filter(
        Boolean
      )
    )
  ];

  const postedInvoices = invoiceMongoIds.length
    ? await Invoice.find({
        organizationId,
        _id: { $in: invoiceMongoIds },
        deletedAt: null
      })
        .select('invoiceId invoiceNumber status grandTotal postedAt amountDue invoiceDate voidedAt')
        .sort({ postedAt: -1, createdAt: -1 })
        .lean()
    : [];

  const linkedInvoices = postedInvoices.map((inv) => ({
    invoiceId: inv.invoiceId,
    invoiceMongoId: inv._id,
    invoiceNumber: inv.invoiceNumber,
    status: inv.status,
    grandTotal: Number(inv.grandTotal) || 0,
    amountDue: Number(inv.amountDue) || 0,
    invoiceDate: inv.invoiceDate || null,
    postedAt: inv.postedAt || null,
    voidedAt: inv.voidedAt || null
  }));

  const header = order || (await SalesOrder.findOne({ _id: salesOrderId, organizationId }).lean());

  return {
    totalBilled: Number(header?.invoicedAmount) || 0,
    remainingToBill: Number(header?.remainingBillableAmount) || 0,
    invoiceStatus: header?.invoiceStatus || 'not_invoiced',
    linkedInvoices
  };
}

async function rollupSalesOrderInvoiceFields({ organizationId, salesOrderId }) {
  const salesOrder = await SalesOrder.findOne({ _id: salesOrderId, organizationId });
  if (!salesOrder) return null;

  const lines = await SalesOrderLine.find({ organizationId, salesOrderId }).lean();
  const rollup = rollupInvoiceFieldsFromLines(lines, salesOrder.grandTotal);

  salesOrder.invoiceStatus = rollup.invoiceStatus;
  salesOrder.invoicedAmount = rollup.invoicedAmount;
  salesOrder.remainingBillableAmount = rollup.remainingBillableAmount;
  await salesOrder.save();

  return salesOrder.toObject();
}

async function postInvoiceAllocations({ organizationId, invoice, lines, userId, allocationType = 'standard' }) {
  const allocations = [];
  const affectedSalesOrderIds = new Set();

  for (const line of lines || []) {
    if (!line?.sourceSalesOrderLineId) continue;

    const qty = Number(line.quantity) || 0;
    if (qty <= 0) continue;

    const soLine = await SalesOrderLine.findOne({
      organizationId,
      salesOrderLineId: line.sourceSalesOrderLineId
    });

    if (!soLine) {
      const err = new Error(`Sales order line not found: ${line.sourceSalesOrderLineId}`);
      err.code = 'SO_LINE_NOT_FOUND';
      throw err;
    }

    const amountAllocated = Number(line.lineTotal) || 0;
    const taxAmountAllocated = Number(line.lineTaxTotal) || 0;

    const allocation = await SalesOrderInvoiceAllocation.create({
      organizationId,
      salesOrderId: soLine.salesOrderId,
      salesOrderLineId: soLine.salesOrderLineId,
      sourceQuoteLineId: line.sourceQuoteLineId || soLine.sourceQuoteLineId || null,
      invoiceId: invoice._id,
      invoiceLineId: line.invoiceLineId,
      quantityAllocated: qty,
      amountAllocated,
      taxAmountAllocated,
      allocationType,
      status: 'active',
      allocatedAt: new Date(),
      allocatedBy: userId || null
    });

    soLine.quantityInvoiced = (Number(soLine.quantityInvoiced) || 0) + qty;
    await soLine.save();

    line.salesOrderInvoiceAllocationId = allocation.salesOrderInvoiceAllocationId;
    await line.save();

    allocations.push(allocation.toObject());
    affectedSalesOrderIds.add(String(soLine.salesOrderId));

    const salesOrder = await SalesOrder.findOne({ _id: soLine.salesOrderId, organizationId });
    if (salesOrder) {
      await writeSalesOrderActivity({
        organizationId,
        salesOrderId: salesOrder.salesOrderId,
        userId,
        action: 'sales_order_invoiced',
        message: `Invoice ${invoice.invoiceNumber} allocated on ${salesOrder.salesOrderNumber}`,
        details: {
          invoiceId: invoice.invoiceId,
          invoiceNumber: invoice.invoiceNumber,
          salesOrderId: salesOrder.salesOrderId,
          salesOrderNumber: salesOrder.salesOrderNumber,
          salesOrderLineId: soLine.salesOrderLineId,
          allocatedQty: qty,
          allocatedAmount: amountAllocated,
          quantityAllocated: qty,
          salesOrderInvoiceAllocationId: allocation.salesOrderInvoiceAllocationId
        }
      });
    }
  }

  for (const salesOrderId of affectedSalesOrderIds) {
    await rollupSalesOrderInvoiceFields({ organizationId, salesOrderId });
  }

  return {
    allocations,
    affectedSalesOrderIds: [...affectedSalesOrderIds]
  };
}

async function reverseInvoiceAllocations({ organizationId, invoiceId, userId, reversalReason }) {
  const reason = String(reversalReason || '').trim();
  if (!reason) {
    const err = new Error('reversalReason is required');
    err.code = 'VALIDATION';
    throw err;
  }

  const activeAllocations = await SalesOrderInvoiceAllocation.find({
    organizationId,
    invoiceId,
    status: 'active'
  });

  const affectedSalesOrderIds = new Set();
  const reversed = [];

  for (const allocation of activeAllocations) {
    const soLine = await SalesOrderLine.findOne({
      organizationId,
      salesOrderLineId: allocation.salesOrderLineId
    });

    if (soLine) {
      soLine.quantityInvoiced = Math.max(
        0,
        (Number(soLine.quantityInvoiced) || 0) - (Number(allocation.quantityAllocated) || 0)
      );
      await soLine.save();
      affectedSalesOrderIds.add(String(allocation.salesOrderId));
    }

    allocation.status = 'reversed';
    allocation.reversedAt = new Date();
    allocation.reversalReason = reason;
    await allocation.save();
    reversed.push(allocation.toObject());
  }

  for (const salesOrderId of affectedSalesOrderIds) {
    await rollupSalesOrderInvoiceFields({ organizationId, salesOrderId });
  }

  return { reversed, affectedSalesOrderIds: [...affectedSalesOrderIds] };
}

async function postCreditNoteAllocations({
  organizationId,
  creditNote,
  lines,
  userId,
  reversalReason
}) {
  const reason = String(reversalReason || creditNote?.creditReasonNote || creditNote?.creditReason || 'credit_note')
    .trim();
  if (!reason) {
    const err = new Error('reversalReason is required for credit note allocations');
    err.code = 'VALIDATION';
    throw err;
  }

  const sourceInvoice = await Invoice.findOne({
    organizationId,
    invoiceId: creditNote.sourceInvoiceId,
    deletedAt: null
  });

  if (!sourceInvoice) {
    const err = new Error('Source invoice not found for credit note');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const sourceLines = await InvoiceLine.find({ organizationId, invoiceId: sourceInvoice._id }).lean();
  const sourceLineByPublicId = new Map(sourceLines.map((line) => [String(line.invoiceLineId), line]));

  const allocations = [];
  const affectedSalesOrderIds = new Set();
  let totalCreditAmount = 0;

  for (const creditLine of lines || []) {
    if (!creditLine?.sourceInvoiceLineId) continue;
    if (creditLine.hiddenLine === true) continue;
    if (String(creditLine.lineType || '') === 'bundle_component') continue;

    const creditQty = Number(creditLine.quantity) || 0;
    if (creditQty <= 0) continue;

    const sourceLineDoc = sourceLineByPublicId.get(String(creditLine.sourceInvoiceLineId));
    if (!sourceLineDoc) {
      const err = new Error(`Source invoice line not found: ${creditLine.sourceInvoiceLineId}`);
      err.code = 'INVOICE_LINE_NOT_FOUND';
      throw err;
    }

    const remaining = computeLineRemainingToCredit(sourceLineDoc);
    if (creditQty > remaining) {
      const err = new Error(
        `Credit quantity ${creditQty} exceeds remaining creditable qty ${remaining} for line ${creditLine.sourceInvoiceLineId}`
      );
      err.code = 'EXCEEDS_CREDITABLE_QTY';
      throw err;
    }

    const sourceLine = await InvoiceLine.findOne({
      organizationId,
      invoiceLineId: creditLine.sourceInvoiceLineId
    });
    if (!sourceLine) {
      const err = new Error(`Source invoice line not found: ${creditLine.sourceInvoiceLineId}`);
      err.code = 'INVOICE_LINE_NOT_FOUND';
      throw err;
    }

    const amountCredited = Math.abs(Number(creditLine.lineTotal) || 0);
    const taxAmountCredited = Math.abs(Number(creditLine.lineTaxTotal) || 0);
    totalCreditAmount += amountCredited;

    if (sourceLine.sourceSalesOrderLineId) {
      const soLine = await SalesOrderLine.findOne({
        organizationId,
        salesOrderLineId: sourceLine.sourceSalesOrderLineId
      });

      if (soLine) {
        const allocation = await SalesOrderInvoiceAllocation.create({
          organizationId,
          salesOrderId: soLine.salesOrderId,
          salesOrderLineId: soLine.salesOrderLineId,
          sourceQuoteLineId: sourceLine.sourceQuoteLineId || soLine.sourceQuoteLineId || null,
          invoiceId: creditNote._id,
          invoiceLineId: creditLine.invoiceLineId,
          quantityAllocated: creditQty,
          amountAllocated: amountCredited,
          taxAmountAllocated: taxAmountCredited,
          allocationType: 'credit_reversal',
          status: 'active',
          allocatedAt: new Date(),
          allocatedBy: userId || null,
          reversalReason: reason,
          sourceSalesOrderInvoiceAllocationId: sourceLine.salesOrderInvoiceAllocationId || null
        });

        soLine.quantityInvoiced = Math.max(
          0,
          (Number(soLine.quantityInvoiced) || 0) - creditQty
        );
        await soLine.save();

        creditLine.salesOrderInvoiceAllocationId = allocation.salesOrderInvoiceAllocationId;
        creditLine.sourceSalesOrderInvoiceAllocationId = sourceLine.salesOrderInvoiceAllocationId || null;
        await creditLine.save();

        allocations.push(allocation.toObject());
        affectedSalesOrderIds.add(String(soLine.salesOrderId));

        const salesOrder = await SalesOrder.findOne({ _id: soLine.salesOrderId, organizationId });
        if (salesOrder) {
          await writeSalesOrderActivity({
            organizationId,
            salesOrderId: salesOrder.salesOrderId,
            userId,
            action: 'sales_order_invoice_credited',
            message: `Credit note ${creditNote.invoiceNumber} reversed allocation on ${salesOrder.salesOrderNumber}`,
            details: {
              creditNoteNumber: creditNote.invoiceNumber,
              creditNoteId: creditNote.invoiceId,
              invoiceNumber: sourceInvoice.invoiceNumber,
              sourceInvoiceId: sourceInvoice.invoiceId,
              salesOrderNumber: salesOrder.salesOrderNumber,
              salesOrderLineId: soLine.salesOrderLineId,
              creditedQty: creditQty,
              creditedAmount: amountCredited,
              reversalReason: reason,
              salesOrderInvoiceAllocationId: allocation.salesOrderInvoiceAllocationId
            }
          });
        }
      }
    }

    sourceLine.quantityCredited = (Number(sourceLine.quantityCredited) || 0) + creditQty;
    await sourceLine.save();
  }

  sourceInvoice.amountDue = Math.max(
    0,
    (Number(sourceInvoice.amountDue) || 0) - totalCreditAmount
  );
  sourceInvoice.modifiedBy = userId || null;
  await sourceInvoice.save();

  for (const salesOrderId of affectedSalesOrderIds) {
    await rollupSalesOrderInvoiceFields({ organizationId, salesOrderId });
  }

  return {
    allocations,
    affectedSalesOrderIds: [...affectedSalesOrderIds],
    sourceInvoice: sourceInvoice.toObject(),
    totalCreditAmount
  };
}

module.exports = {
  DEFAULT_BILL_ON,
  computeLineRemainingToInvoice,
  deriveInvoiceStatusFromLines,
  rollupInvoiceFieldsFromLines,
  listSalesOrderInvoiceAllocations,
  buildInvoiceReadinessSummary,
  buildSalesOrderBillingCoverage,
  rollupSalesOrderInvoiceFields,
  postInvoiceAllocations,
  reverseInvoiceAllocations,
  postCreditNoteAllocations
};
