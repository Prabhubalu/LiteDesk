/**
 * INV3 — Multi-SO invoice wizard (merge billing across sales orders).
 */

const SalesOrder = require('../models/SalesOrder');
const SalesOrderLine = require('../models/SalesOrderLine');
const SalesOrderSection = require('../models/SalesOrderSection');
const Invoice = require('../models/Invoice');
const InvoiceLine = require('../models/InvoiceLine');
const InvoiceSection = require('../models/InvoiceSection');

const { INVOICE_STATUS_DEFAULT } = require('../constants/invoiceLifecycle');
const { DEFAULT_BILL_ON } = require('./salesOrderInvoiceAllocationService');
const { recomputeInvoiceAndSectionTotals, ensureDefaultInvoiceSection } = require('./invoiceSectionService');
const { writeInvoiceActivity } = require('./invoiceActivityService');
const {
  assertCanInvoiceSalesOrder,
  resolveInvoiceLineSelections,
  mapSalesOrderSectionToInvoiceSection,
  mapSalesOrderLineToInvoiceLine,
  collectBundleChildLines
} = require('./invoiceConversionService');

function normalizeSalesOrderIds(raw) {
  const ids = Array.isArray(raw) ? raw : [];
  return [...new Set(ids.map((id) => String(id || '').trim()).filter(Boolean))];
}

async function loadSalesOrders({ organizationId, salesOrderIds }) {
  const orders = [];
  for (const ref of salesOrderIds) {
    const order =
      (await SalesOrder.findOne({ organizationId, salesOrderId: ref, deletedAt: null })) ||
      (await SalesOrder.findOne({ organizationId, _id: ref, deletedAt: null }));
    if (!order) {
      const err = new Error(`Sales order not found: ${ref}`);
      err.code = 'NOT_FOUND';
      err.details = { salesOrderId: ref };
      throw err;
    }
    orders.push(order);
  }
  return orders;
}

function assertCompatibleSalesOrders(orders) {
  if (!orders.length) {
    const err = new Error('At least one sales order is required');
    err.code = 'VALIDATION';
    throw err;
  }
  if (orders.length < 2) {
    const err = new Error('Multi-SO invoice requires at least two sales orders');
    err.code = 'VALIDATION';
    throw err;
  }

  const currency = String(orders[0].currency || 'USD');
  const organizationRefId = String(orders[0].organizationRefId || '');
  const contactId = String(orders[0].contactId || '');

  for (const order of orders) {
    assertCanInvoiceSalesOrder(order);
    if (String(order.currency || 'USD') !== currency) {
      const err = new Error('All sales orders must share the same currency for a merged invoice');
      err.code = 'INCOMPATIBLE_SALES_ORDERS';
      err.details = { field: 'currency' };
      throw err;
    }
    if (String(order.organizationRefId || '') !== organizationRefId) {
      const err = new Error('All sales orders must bill the same account (organizationRefId)');
      err.code = 'INCOMPATIBLE_SALES_ORDERS';
      err.details = { field: 'organizationRefId' };
      throw err;
    }
    if (String(order.contactId || '') !== contactId) {
      const err = new Error('All sales orders must share the same contact for a merged invoice');
      err.code = 'INCOMPATIBLE_SALES_ORDERS';
      err.details = { field: 'contactId' };
      throw err;
    }
  }
}

function groupRequestedLinesBySalesOrder(requestedLines, ordersByPublicId) {
  const grouped = new Map();
  for (const row of requestedLines || []) {
    const soRef = String(row?.salesOrderId || row?.salesOrderMongoId || '').trim();
    if (!soRef) continue;
    const order = ordersByPublicId.get(soRef);
    if (!order) continue;
    const key = String(order._id);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push({
      salesOrderLineId: row.salesOrderLineId || row.lineId,
      quantity: row.quantity
    });
  }
  return grouped;
}

async function buildMultiSoReadinessSummary({ organizationId, salesOrderIds }) {
  const ids = normalizeSalesOrderIds(salesOrderIds);
  const orders = await loadSalesOrders({ organizationId, salesOrderIds: ids });
  assertCompatibleSalesOrders(orders);

  const { buildInvoiceReadinessSummary } = require('./salesOrderInvoiceAllocationService');
  const summaries = [];
  for (const order of orders) {
    const lines = await SalesOrderLine.find({ organizationId, salesOrderId: order._id }).lean();
    const summary = await buildInvoiceReadinessSummary({
      organizationId,
      salesOrderId: order._id,
      lines
    });
    summaries.push({
      salesOrderId: order.salesOrderId,
      salesOrderMongoId: order._id,
      salesOrderNumber: order.salesOrderNumber,
      orderTitle: order.orderTitle || null,
      currency: order.currency,
      ...summary
    });
  }

  return {
    salesOrderCount: orders.length,
    currency: orders[0].currency,
    organizationRefId: orders[0].organizationRefId,
    contactId: orders[0].contactId,
    salesOrders: summaries
  };
}

async function convertMultipleSalesOrdersToInvoice({
  organizationId,
  userId,
  body = {},
  overrideBillOnFulfill = false
}) {
  const salesOrderIds = normalizeSalesOrderIds(body.salesOrderIds);
  const orders = await loadSalesOrders({ organizationId, salesOrderIds });
  assertCompatibleSalesOrders(orders);

  const billOn = String(body.billOn || DEFAULT_BILL_ON).trim() === 'order' ? 'order' : 'fulfill';
  const primaryOrder = orders[0];

  const ordersByPublicId = new Map();
  for (const order of orders) {
    ordersByPublicId.set(String(order.salesOrderId), order);
    ordersByPublicId.set(String(order._id), order);
  }

  const requestedByOrder =
    Array.isArray(body.lines) && body.lines.length
      ? groupRequestedLinesBySalesOrder(body.lines, ordersByPublicId)
      : null;

  const orderNumbers = orders.map((o) => o.salesOrderNumber).join(', ');
  const invoiceTitle =
    String(body.invoiceTitle || '').trim() ||
    `Invoice for ${orderNumbers}`;

  const invoice = await Invoice.create({
    organizationId,
    invoiceTitle,
    invoiceDate: body.invoiceDate ? new Date(body.invoiceDate) : new Date(),
    dueDate: body.dueDate ? new Date(body.dueDate) : null,
    status: INVOICE_STATUS_DEFAULT,
    currency: primaryOrder.currency || 'USD',
    exchangeRateSnapshot: Number(primaryOrder.exchangeRateSnapshot) || 1,
    globalDiscountType: body.globalDiscountType ?? primaryOrder.globalDiscountType ?? null,
    globalDiscountValue: Number(body.globalDiscountValue ?? primaryOrder.globalDiscountValue) || 0,
    globalDiscountAmount: Number(body.globalDiscountAmount ?? primaryOrder.globalDiscountAmount) || 0,
    ownerId: primaryOrder.ownerId ?? userId ?? null,
    customerId: primaryOrder.customerId ?? null,
    organizationRefId: primaryOrder.organizationRefId ?? null,
    contactId: primaryOrder.contactId ?? null,
    dealId: primaryOrder.dealId ?? null,
    caseId: primaryOrder.caseId ?? null,
    billToAddressSnapshot: primaryOrder.billToAddressSnapshot ?? null,
    shipToAddressSnapshot: primaryOrder.shipToAddressSnapshot ?? null,
    paymentTermsSnapshot: primaryOrder.paymentTermsSnapshot ?? null,
    incotermsSnapshot: primaryOrder.incotermsSnapshot ?? null,
    termsConditionsSnapshot: primaryOrder.termsConditionsSnapshot ?? null,
    sourceType: 'merge',
    sourceSalesOrderIds: orders.map((o) => o._id),
    sourceContext: body.sourceContext || 'multi_so_wizard',
    sourceRef: body.sourceRef || {
      moduleKey: 'sales_orders',
      recordId: orders.map((o) => o.salesOrderId)
    },
    createdBy: userId ?? null,
    modifiedBy: userId ?? null
  });

  const sectionMongoBySoSection = new Map();
  const sectionPublicIdBySoSection = new Map();
  let defaultSectionMongoId = null;

  for (const order of orders) {
    const soSections = await SalesOrderSection.find({ organizationId, salesOrderId: order._id })
      .sort({ sectionOrder: 1, createdAt: 1 })
      .lean();

    for (const soSection of soSections) {
      const created = await InvoiceSection.create(
        mapSalesOrderSectionToInvoiceSection({
          soSection: {
            ...soSection,
            sectionTitle: `${soSection.sectionTitle || 'Section'} (${order.salesOrderNumber})`
          },
          invoiceId: invoice._id,
          organizationId
        })
      );
      sectionMongoBySoSection.set(`${String(order._id)}:${String(soSection._id)}`, created._id);
      sectionPublicIdBySoSection.set(
        `${String(order._id)}:${String(soSection._id)}`,
        soSection.salesOrderSectionId
      );
      if (!defaultSectionMongoId) defaultSectionMongoId = created._id;
    }
  }

  if (!sectionMongoBySoSection.size) {
    const general = await ensureDefaultInvoiceSection({ organizationId, invoiceId: invoice._id });
    defaultSectionMongoId = general._id;
  }

  const lineSelectionsOut = [];
  let totalLineCount = 0;

  for (const order of orders) {
    const soLines = await SalesOrderLine.find({ organizationId, salesOrderId: order._id })
      .sort({ lineOrder: 1, createdAt: 1 })
      .lean();

    const requestedLines = requestedByOrder ? requestedByOrder.get(String(order._id)) || [] : null;
    const selections = resolveInvoiceLineSelections({
      soLines,
      requestedLines: requestedLines && requestedLines.length ? requestedLines : null,
      billOn,
      overrideBillOnFulfill
    });

    if (!selections.length) continue;

    for (const { line, quantity } of selections) {
      const sectionMongoId =
        (line.salesOrderSectionId &&
          sectionMongoBySoSection.get(`${String(order._id)}:${String(line.salesOrderSectionId)}`)) ||
        defaultSectionMongoId;

      const sectionPublicId =
        (line.salesOrderSectionId &&
          sectionPublicIdBySoSection.get(`${String(order._id)}:${String(line.salesOrderSectionId)}`)) ||
        null;

      const invoiceLine = await InvoiceLine.create(
        mapSalesOrderLineToInvoiceLine({
          soLine: line,
          invoiceId: invoice._id,
          organizationId,
          invoiceSectionMongoId: sectionMongoId,
          quantity,
          sourceSalesOrderSectionPublicId: sectionPublicId
        })
      );
      totalLineCount += 1;

      if (String(line.lineType || '') === 'bundle_parent') {
        const childRows = collectBundleChildLines(soLines, line, quantity);
        for (const { line: childLine, quantity: childQty } of childRows) {
          await InvoiceLine.create(
            mapSalesOrderLineToInvoiceLine({
              soLine: childLine,
              invoiceId: invoice._id,
              organizationId,
              invoiceSectionMongoId:
                (childLine.salesOrderSectionId &&
                  sectionMongoBySoSection.get(`${String(order._id)}:${String(childLine.salesOrderSectionId)}`)) ||
                sectionMongoId,
              quantity: childQty,
              parentBundleLineMongoId: invoiceLine._id,
              sourceSalesOrderSectionPublicId:
                (childLine.salesOrderSectionId &&
                  sectionPublicIdBySoSection.get(`${String(order._id)}:${String(childLine.salesOrderSectionId)}`)) ||
                sectionPublicId
            })
          );
        }
      }

      lineSelectionsOut.push({
        salesOrderId: order.salesOrderId,
        salesOrderNumber: order.salesOrderNumber,
        salesOrderLineId: line.salesOrderLineId,
        quantity,
        itemNameSnapshot: line.itemNameSnapshot || null
      });
    }
  }

  if (!lineSelectionsOut.length) {
    await Invoice.deleteOne({ _id: invoice._id, organizationId });
    const err = new Error('No billable lines selected across sales orders.');
    err.code = 'NOTHING_TO_INVOICE';
    throw err;
  }

  await recomputeInvoiceAndSectionTotals({ organizationId, invoiceId: invoice._id });
  const refreshedInvoice = await Invoice.findById(invoice._id).lean();

  await writeInvoiceActivity({
    organizationId,
    invoiceId: refreshedInvoice.invoiceId,
    userId,
    action: 'invoice_created_from_sales_orders',
    message: `Invoice ${refreshedInvoice.invoiceNumber} created from sales orders ${orderNumbers}`,
    details: {
      invoiceNumber: refreshedInvoice.invoiceNumber,
      salesOrderNumbers: orders.map((o) => o.salesOrderNumber),
      salesOrderIds: orders.map((o) => o.salesOrderId),
      lineCount: totalLineCount,
      grandTotal: refreshedInvoice.grandTotal
    }
  });

  return {
    invoice: refreshedInvoice,
    salesOrders: orders.map((o) => o.toObject()),
    lineSelections: lineSelectionsOut
  };
}

module.exports = {
  normalizeSalesOrderIds,
  assertCompatibleSalesOrders,
  buildMultiSoReadinessSummary,
  convertMultipleSalesOrdersToInvoice
};
