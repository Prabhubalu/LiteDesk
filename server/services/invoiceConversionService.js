/**
 * INV1 — Sales Order → Invoice conversion (architecture §7.2).
 */

const SalesOrder = require('../models/SalesOrder');
const SalesOrderLine = require('../models/SalesOrderLine');
const SalesOrderSection = require('../models/SalesOrderSection');
const Invoice = require('../models/Invoice');
const InvoiceLine = require('../models/InvoiceLine');
const InvoiceSection = require('../models/InvoiceSection');

const { INVOICE_STATUS_DEFAULT } = require('../constants/invoiceLifecycle');
const {
  DEFAULT_BILL_ON,
  computeLineRemainingToInvoice
} = require('./salesOrderInvoiceAllocationService');
const { recomputeInvoiceAndSectionTotals, ensureDefaultInvoiceSection } = require('./invoiceSectionService');
const { writeInvoiceActivity } = require('./invoiceActivityService');

const BLOCKED_SALES_ORDER_STATUSES = new Set(['Cancelled', 'Closed']);

function scaleLineAmount(value, fromQty, toQty) {
  const from = Number(fromQty) || 0;
  const to = Number(toQty) || 0;
  if (from <= 0 || to <= 0) return 0;
  return (Number(value) || 0) * (to / from);
}

function assertCanInvoiceSalesOrder(order) {
  const status = String(order?.status || '').trim();
  if (BLOCKED_SALES_ORDER_STATUSES.has(status)) {
    const err = new Error(`Sales orders in status "${status}" cannot be invoiced.`);
    err.code = 'SO_NOT_INVOICEABLE';
    err.details = { status };
    throw err;
  }
}

/**
 * @param {object} params
 * @param {Array} params.soLines
 * @param {Array|null|undefined} params.requestedLines body.lines [{ salesOrderLineId, quantity }]
 * @param {string} params.billOn
 * @param {boolean} params.overrideBillOnFulfill
 */
function resolveInvoiceLineSelections({ soLines, requestedLines, billOn, overrideBillOnFulfill }) {
  const visible = (soLines || []).filter(
    (line) => line && line.hiddenLine !== true && String(line.lineType || '') !== 'bundle_component'
  );

  const byPublicId = new Map(visible.map((line) => [String(line.salesOrderLineId), line]));

  const selections = [];
  const inputRows = Array.isArray(requestedLines) ? requestedLines : [];

  if (!inputRows.length) {
    for (const line of visible) {
      const remaining = computeLineRemainingToInvoice(line, billOn);
      if (remaining > 0) {
        selections.push({ line, quantity: remaining });
      }
    }
  } else {
    for (const row of inputRows) {
      const lineId = String(row?.salesOrderLineId || row?.lineId || '').trim();
      if (!lineId) continue;
      const line = byPublicId.get(lineId);
      if (!line) {
        const err = new Error(`Sales order line not found: ${lineId}`);
        err.code = 'SO_LINE_NOT_FOUND';
        err.details = { salesOrderLineId: lineId };
        throw err;
      }
      const qty = Number(row.quantity);
      if (!Number.isFinite(qty) || qty <= 0) {
        const err = new Error(`Invalid invoice quantity for line ${lineId}`);
        err.code = 'VALIDATION';
        throw err;
      }
      selections.push({ line, quantity: qty });
    }
  }

  if (!selections.length) {
    const err = new Error('No billable sales order lines selected for invoicing.');
    err.code = 'NOTHING_TO_INVOICE';
    throw err;
  }

  for (const { line, quantity } of selections) {
    const remaining = computeLineRemainingToInvoice(line, billOn);
    if (quantity <= remaining) continue;

    if (billOn === 'fulfill' && !overrideBillOnFulfill) {
      const err = new Error(
        `Quantity ${quantity} exceeds remaining billable qty ${remaining} for line ${line.salesOrderLineId}`
      );
      err.code = 'EXCEEDS_BILLABLE_QTY';
      err.details = {
        salesOrderLineId: line.salesOrderLineId,
        quantity,
        quantityRemainingToInvoice: remaining
      };
      throw err;
    }
  }

  return selections;
}

function collectBundleChildLines(soLines, parentLine, invoiceQty) {
  const parentMongoId = String(parentLine._id);
  const parentQty = Number(parentLine.quantity) || 0;
  const ratio = parentQty > 0 ? invoiceQty / parentQty : 1;

  return (soLines || [])
    .filter(
      (line) =>
        line &&
        String(line.parentBundleLineId || '') === parentMongoId &&
        String(line.lineType || '') === 'bundle_component'
    )
    .map((child) => ({
      line: child,
      quantity: Math.max(0, (Number(child.quantity) || 0) * ratio)
    }))
    .filter((row) => row.quantity > 0);
}

function mapSalesOrderSectionToInvoiceSection({ soSection, invoiceId, organizationId }) {
  return {
    organizationId,
    invoiceId,
    sectionTitle: soSection.sectionTitle,
    sectionDescription: soSection.sectionDescription ?? null,
    sectionOrder: Number(soSection.sectionOrder) || 0,
    sectionType: soSection.sectionType || 'standard',
    includeInInvoiceTotal: soSection.includeInOrderTotal !== false,
    sectionDiscountType: soSection.sectionDiscountType ?? null,
    sectionDiscountValue: Number(soSection.sectionDiscountValue) || 0,
    sectionDiscountAmount: Number(soSection.sectionDiscountAmount) || 0,
    showSectionTotal: soSection.showSectionTotal !== false,
    hiddenSection: soSection.hiddenSection === true,
    sourceSalesOrderSectionId: soSection.salesOrderSectionId,
    sourceSalesOrderId: soSection.salesOrderId,
    sourceQuoteSectionId: soSection.sourceQuoteSectionId ?? null
  };
}

function mapSalesOrderLineToInvoiceLine({
  soLine,
  invoiceId,
  organizationId,
  invoiceSectionMongoId,
  quantity,
  parentBundleLineMongoId = null,
  sourceSalesOrderSectionPublicId = null
}) {
  const soQty = Number(soLine.quantity) || 0;
  const invoiceQty = Number(quantity) || 0;
  const lineSubtotal = scaleLineAmount(soLine.lineSubtotal, soQty, invoiceQty);
  const lineTaxTotal = scaleLineAmount(soLine.lineTaxTotal, soQty, invoiceQty);
  const lineTotal = lineSubtotal + lineTaxTotal;
  const discountAmount = scaleLineAmount(soLine.discountAmount, soQty, invoiceQty);

  return {
    organizationId,
    invoiceId,
    invoiceSectionId: invoiceSectionMongoId,
    variantId: soLine.variantId,
    parentBundleLineId: parentBundleLineMongoId,
    lineType: soLine.lineType || 'standard',
    lineOrder: Number(soLine.lineOrder) || 0,
    quantity: invoiceQty,
    unitOfMeasure: soLine.unitOfMeasure ?? null,
    unitPriceSnapshot: soLine.unitPriceSnapshot,
    listPriceSnapshot: soLine.listPriceSnapshot,
    pricingSourceSnapshot: soLine.pricingSourceSnapshot,
    priceBookIdSnapshot: soLine.priceBookIdSnapshot,
    priceBookNameSnapshot: soLine.priceBookNameSnapshot,
    priceBookEntryIdSnapshot: soLine.priceBookEntryIdSnapshot,
    pricingAsOfDateSnapshot: soLine.pricingAsOfDateSnapshot,
    discountType: soLine.discountType,
    discountValue: soLine.discountValue,
    discountAmount,
    taxSnapshot: soLine.taxSnapshot || {},
    lineSubtotal,
    lineTaxTotal,
    lineTotal,
    currencySnapshot: soLine.currencySnapshot,
    exchangeRateSnapshot: soLine.exchangeRateSnapshot,
    skuSnapshot: soLine.skuSnapshot,
    itemNameSnapshot: soLine.itemNameSnapshot,
    descriptionSnapshot: soLine.descriptionSnapshot,
    attributesSnapshot: soLine.attributesSnapshot || {},
    bundleSnapshot: soLine.bundleSnapshot || null,
    optionalLine: soLine.optionalLine === true,
    hiddenLine: soLine.hiddenLine === true,
    sourceSalesOrderLineId: soLine.salesOrderLineId,
    sourceSalesOrderId: soLine.salesOrderId,
    sourceSalesOrderSectionId: sourceSalesOrderSectionPublicId,
    sourceQuoteLineId: soLine.sourceQuoteLineId ?? null,
    sourceQuoteId: soLine.sourceQuoteId ?? null
  };
}

/**
 * @param {object} params
 * @param {import('mongoose').Types.ObjectId|string} params.organizationId
 * @param {import('mongoose').Types.ObjectId|string} params.salesOrderId Mongo or public UUID
 * @param {import('mongoose').Types.ObjectId|string|null} params.userId
 * @param {object} [params.body]
 * @param {boolean} [params.overrideBillOnFulfill]
 */
async function convertSalesOrderToInvoice({
  organizationId,
  salesOrderId,
  userId,
  body = {},
  overrideBillOnFulfill = false
}) {
  const order =
    (await SalesOrder.findOne({ organizationId, salesOrderId, deletedAt: null })) ||
    (await SalesOrder.findOne({ organizationId, _id: salesOrderId, deletedAt: null }));

  if (!order) {
    const err = new Error('Sales order not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  assertCanInvoiceSalesOrder(order);

  const billOn = String(body.billOn || DEFAULT_BILL_ON).trim() === 'order' ? 'order' : 'fulfill';
  const soLines = await SalesOrderLine.find({ organizationId, salesOrderId: order._id })
    .sort({ lineOrder: 1, createdAt: 1 })
    .lean();
  const soSections = await SalesOrderSection.find({ organizationId, salesOrderId: order._id })
    .sort({ sectionOrder: 1, createdAt: 1 })
    .lean();

  const selections = resolveInvoiceLineSelections({
    soLines,
    requestedLines: body.lines,
    billOn,
    overrideBillOnFulfill
  });

  const invoiceTitle =
    String(body.invoiceTitle || '').trim() ||
    `Invoice for ${order.salesOrderNumber}${order.orderTitle ? ` — ${order.orderTitle}` : ''}`;

  const invoice = await Invoice.create({
    organizationId,
    invoiceTitle,
    invoiceDate: body.invoiceDate ? new Date(body.invoiceDate) : new Date(),
    dueDate: body.dueDate ? new Date(body.dueDate) : null,
    status: INVOICE_STATUS_DEFAULT,
    currency: order.currency || 'USD',
    exchangeRateSnapshot: Number(order.exchangeRateSnapshot) || 1,
    globalDiscountType: order.globalDiscountType ?? null,
    globalDiscountValue: Number(order.globalDiscountValue) || 0,
    globalDiscountAmount: Number(order.globalDiscountAmount) || 0,
    ownerId: order.ownerId ?? userId ?? null,
    customerId: order.customerId ?? null,
    organizationRefId: order.organizationRefId ?? null,
    contactId: order.contactId ?? null,
    dealId: order.dealId ?? null,
    caseId: order.caseId ?? null,
    billToAddressSnapshot: order.billToAddressSnapshot ?? null,
    shipToAddressSnapshot: order.shipToAddressSnapshot ?? null,
    paymentTermsSnapshot: order.paymentTermsSnapshot ?? null,
    incotermsSnapshot: order.incotermsSnapshot ?? null,
    termsConditionsSnapshot: order.termsConditionsSnapshot ?? null,
    sourceType: 'sales_order',
    sourceSalesOrderIds: [order._id],
    sourceContext: body.sourceContext || 'sales_order_wizard',
    sourceRef: body.sourceRef || {
      moduleKey: 'sales_orders',
      recordId: order.salesOrderId
    },
    createdBy: userId ?? null,
    modifiedBy: userId ?? null
  });

  const sectionMongoBySoSection = new Map();
  const sectionPublicIdByMongo = new Map();
  let defaultSectionMongoId = null;

  for (const soSection of soSections) {
    const created = await InvoiceSection.create(
      mapSalesOrderSectionToInvoiceSection({
        soSection,
        invoiceId: invoice._id,
        organizationId
      })
    );
    sectionMongoBySoSection.set(String(soSection._id), created._id);
    sectionPublicIdByMongo.set(String(soSection._id), soSection.salesOrderSectionId);
    if (Number(soSection.sectionOrder) === 0 && !defaultSectionMongoId) {
      defaultSectionMongoId = created._id;
    }
  }

  if (!sectionMongoBySoSection.size) {
    const general = await ensureDefaultInvoiceSection({
      organizationId,
      invoiceId: invoice._id
    });
    defaultSectionMongoId = general._id;
  }

  const bundleParentMongoBySoLine = new Map();

  for (const { line, quantity } of selections) {
    const sectionMongoId =
      (line.salesOrderSectionId && sectionMongoBySoSection.get(String(line.salesOrderSectionId))) ||
      defaultSectionMongoId ||
      (await ensureDefaultInvoiceSection({ organizationId, invoiceId: invoice._id }))._id;

    const sectionPublicId =
      (line.salesOrderSectionId && sectionPublicIdByMongo.get(String(line.salesOrderSectionId))) || null;

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

    if (String(line.lineType || '') === 'bundle_parent') {
      bundleParentMongoBySoLine.set(String(line._id), invoiceLine._id);
      const childRows = collectBundleChildLines(soLines, line, quantity);
      for (const { line: childLine, quantity: childQty } of childRows) {
        const childSectionMongoId =
          (childLine.salesOrderSectionId &&
            sectionMongoBySoSection.get(String(childLine.salesOrderSectionId))) ||
          sectionMongoId;
        const childSectionPublicId =
          (childLine.salesOrderSectionId &&
            sectionPublicIdByMongo.get(String(childLine.salesOrderSectionId))) ||
          sectionPublicId;
        await InvoiceLine.create(
          mapSalesOrderLineToInvoiceLine({
            soLine: childLine,
            invoiceId: invoice._id,
            organizationId,
            invoiceSectionMongoId: childSectionMongoId,
            quantity: childQty,
            parentBundleLineMongoId: invoiceLine._id,
            sourceSalesOrderSectionPublicId: childSectionPublicId
          })
        );
      }
    }
  }

  await recomputeInvoiceAndSectionTotals({ organizationId, invoiceId: invoice._id });

  const refreshedInvoice = await Invoice.findById(invoice._id).lean();

  await writeInvoiceActivity({
    organizationId,
    invoiceId: refreshedInvoice.invoiceId,
    userId,
    action: 'invoice_created_from_sales_order',
    message: `Invoice ${refreshedInvoice.invoiceNumber} created from sales order ${order.salesOrderNumber}`,
    details: {
      invoiceNumber: refreshedInvoice.invoiceNumber,
      salesOrderNumber: order.salesOrderNumber,
      salesOrderId: order.salesOrderId,
      lineCount: selections.length,
      grandTotal: refreshedInvoice.grandTotal
    }
  });

  return {
    invoice: refreshedInvoice,
    salesOrder: order.toObject(),
    lineSelections: selections.map(({ line, quantity }) => ({
      salesOrderLineId: line.salesOrderLineId,
      quantity,
      itemNameSnapshot: line.itemNameSnapshot || null
    }))
  };
}

module.exports = {
  assertCanInvoiceSalesOrder,
  resolveInvoiceLineSelections,
  convertSalesOrderToInvoice,
  mapSalesOrderSectionToInvoiceSection,
  mapSalesOrderLineToInvoiceLine,
  collectBundleChildLines,
  scaleLineAmount
};
