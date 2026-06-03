/**
 * INV3 — Credit note creation from Posted invoice.
 */

const Invoice = require('../models/Invoice');
const InvoiceLine = require('../models/InvoiceLine');
const InvoiceSection = require('../models/InvoiceSection');
const { INVOICE_STATUS_DEFAULT } = require('../constants/invoiceLifecycle');
const { assertValidCreditNoteReason } = require('../constants/creditNoteReasons');
const { recomputeInvoiceAndSectionTotals } = require('./invoiceSectionService');
const { writeInvoiceActivity } = require('./invoiceActivityService');

const CREDITABLE_INVOICE_STATUSES = new Set(['Posted', 'Partially Paid', 'Paid']);

function scaleLineAmount(value, fromQty, toQty) {
  const from = Number(fromQty) || 0;
  const to = Number(toQty) || 0;
  if (from <= 0 || to <= 0) return 0;
  return (Number(value) || 0) * (to / from);
}

function computeLineRemainingToCredit(line) {
  const qty = Number(line?.quantity) || 0;
  const credited = Number(line?.quantityCredited) || 0;
  return Math.max(0, qty - credited);
}

function resolveCreditLineSelections({ sourceLines, requestedLines, creditMode = 'full' }) {
  const billable = (sourceLines || []).filter(
    (line) =>
      line &&
      line.hiddenLine !== true &&
      String(line.lineType || '') !== 'bundle_component' &&
      computeLineRemainingToCredit(line) > 0
  );

  const byPublicId = new Map(billable.map((line) => [String(line.invoiceLineId), line]));
  const selections = [];
  const mode = String(creditMode || 'full').trim().toLowerCase();
  const inputRows = Array.isArray(requestedLines) ? requestedLines : [];

  if (mode === 'full' || !inputRows.length) {
    for (const line of billable) {
      selections.push({ line, quantity: computeLineRemainingToCredit(line) });
    }
  } else {
    for (const row of inputRows) {
      const lineId = String(row?.invoiceLineId || row?.lineId || '').trim();
      if (!lineId) continue;
      const line = byPublicId.get(lineId);
      if (!line) {
        const err = new Error(`Invoice line not found: ${lineId}`);
        err.code = 'INVOICE_LINE_NOT_FOUND';
        err.details = { invoiceLineId: lineId };
        throw err;
      }
      const qty = Number(row.quantity);
      if (!Number.isFinite(qty) || qty <= 0) {
        const err = new Error(`Invalid credit quantity for line ${lineId}`);
        err.code = 'VALIDATION';
        throw err;
      }
      selections.push({ line, quantity: qty });
    }
  }

  if (!selections.length) {
    const err = new Error('No creditable invoice lines selected.');
    err.code = 'NOTHING_TO_CREDIT';
    throw err;
  }

  for (const { line, quantity } of selections) {
    const remaining = computeLineRemainingToCredit(line);
    if (quantity <= remaining) continue;
    const err = new Error(
      `Credit quantity ${quantity} exceeds remaining creditable qty ${remaining} for line ${line.invoiceLineId}`
    );
    err.code = 'EXCEEDS_CREDITABLE_QTY';
    err.details = {
      invoiceLineId: line.invoiceLineId,
      quantity,
      quantityRemainingToCredit: remaining
    };
    throw err;
  }

  return selections;
}

function collectBundleChildLines(sourceLines, parentLine, creditQty) {
  const parentMongoId = String(parentLine._id);
  const parentQty = Number(parentLine.quantity) || 0;
  const ratio = parentQty > 0 ? creditQty / parentQty : 1;

  return (sourceLines || [])
    .filter(
      (line) =>
        line &&
        String(line.parentBundleLineId || '') === parentMongoId &&
        String(line.lineType || '') === 'bundle_component'
    )
    .map((child) => {
      const childRemaining = computeLineRemainingToCredit(child);
      const scaledQty = (Number(child.quantity) || 0) * ratio;
      const quantity = childRemaining > 0 ? Math.min(childRemaining, scaledQty) : scaledQty;
      return { line: child, quantity: Math.max(0, quantity) };
    })
    .filter((row) => row.quantity > 0);
}

function mapSourceInvoiceLineToCreditLine({
  sourceLine,
  creditQty,
  creditNoteId,
  organizationId,
  invoiceSectionMongoId,
  parentBundleLineMongoId = null
}) {
  const sourceQty = Number(sourceLine.quantity) || 0;
  const qty = Number(creditQty) || 0;
  const lineSubtotal = -Math.abs(scaleLineAmount(sourceLine.lineSubtotal, sourceQty, qty));
  const lineTaxTotal = -Math.abs(scaleLineAmount(sourceLine.lineTaxTotal, sourceQty, qty));
  const lineTotal = lineSubtotal + lineTaxTotal;
  const discountAmount = -Math.abs(scaleLineAmount(sourceLine.discountAmount, sourceQty, qty));

  return {
    organizationId,
    invoiceId: creditNoteId,
    invoiceSectionId: invoiceSectionMongoId,
    variantId: sourceLine.variantId,
    parentBundleLineId: parentBundleLineMongoId,
    lineType: sourceLine.lineType || 'standard',
    lineOrder: Number(sourceLine.lineOrder) || 0,
    quantity: qty,
    unitOfMeasure: sourceLine.unitOfMeasure ?? null,
    unitPriceSnapshot: sourceLine.unitPriceSnapshot,
    listPriceSnapshot: sourceLine.listPriceSnapshot,
    pricingSourceSnapshot: sourceLine.pricingSourceSnapshot,
    priceBookIdSnapshot: sourceLine.priceBookIdSnapshot,
    priceBookNameSnapshot: sourceLine.priceBookNameSnapshot,
    priceBookEntryIdSnapshot: sourceLine.priceBookEntryIdSnapshot,
    pricingAsOfDateSnapshot: sourceLine.pricingAsOfDateSnapshot,
    discountType: sourceLine.discountType,
    discountValue: sourceLine.discountValue,
    discountAmount,
    taxSnapshot: sourceLine.taxSnapshot || {},
    lineSubtotal,
    lineTaxTotal,
    lineTotal,
    currencySnapshot: sourceLine.currencySnapshot,
    exchangeRateSnapshot: sourceLine.exchangeRateSnapshot,
    skuSnapshot: sourceLine.skuSnapshot,
    itemNameSnapshot: sourceLine.itemNameSnapshot,
    descriptionSnapshot: sourceLine.descriptionSnapshot,
    attributesSnapshot: sourceLine.attributesSnapshot || {},
    bundleSnapshot: sourceLine.bundleSnapshot || null,
    optionalLine: sourceLine.optionalLine === true,
    hiddenLine: sourceLine.hiddenLine === true,
    sourceInvoiceLineId: sourceLine.invoiceLineId,
    sourceSalesOrderInvoiceAllocationId: sourceLine.salesOrderInvoiceAllocationId ?? null,
    sourceSalesOrderLineId: sourceLine.sourceSalesOrderLineId ?? null,
    sourceSalesOrderId: sourceLine.sourceSalesOrderId ?? null,
    sourceSalesOrderSectionId: sourceLine.sourceSalesOrderSectionId ?? null,
    sourceQuoteLineId: sourceLine.sourceQuoteLineId ?? null,
    sourceQuoteId: sourceLine.sourceQuoteId ?? null
  };
}

function mapSourceSectionToCreditSection({ sourceSection, creditNoteId, organizationId }) {
  return {
    organizationId,
    invoiceId: creditNoteId,
    sectionTitle: sourceSection.sectionTitle,
    sectionDescription: sourceSection.sectionDescription ?? null,
    sectionOrder: Number(sourceSection.sectionOrder) || 0,
    sectionType: sourceSection.sectionType || 'standard',
    includeInInvoiceTotal: sourceSection.includeInInvoiceTotal !== false,
    sectionDiscountType: sourceSection.sectionDiscountType ?? null,
    sectionDiscountValue: Number(sourceSection.sectionDiscountValue) || 0,
    sectionDiscountAmount: Number(sourceSection.sectionDiscountAmount) || 0,
    showSectionTotal: sourceSection.showSectionTotal !== false,
    hiddenSection: sourceSection.hiddenSection === true,
    sourceSalesOrderSectionId: sourceSection.sourceSalesOrderSectionId ?? null,
    sourceSalesOrderId: sourceSection.sourceSalesOrderId ?? null,
    sourceQuoteSectionId: sourceSection.sourceQuoteSectionId ?? null
  };
}

async function findSourceInvoice({ organizationId, invoiceRef }) {
  return (
    (await Invoice.findOne({ organizationId, invoiceId: invoiceRef, deletedAt: null })) ||
    (await Invoice.findOne({ organizationId, _id: invoiceRef, deletedAt: null }))
  );
}

async function buildInvoiceCreditSummary({ organizationId, sourceInvoice }) {
  const sourceInvoiceId = sourceInvoice?.invoiceId;
  if (!sourceInvoiceId) return { lines: [], linkedCreditNotes: [], totalCredited: 0 };

  const [sourceLines, linkedCreditNotes] = await Promise.all([
    InvoiceLine.find({ organizationId, invoiceId: sourceInvoice._id })
      .sort({ lineOrder: 1, createdAt: 1 })
      .lean(),
    Invoice.find({
      organizationId,
      invoiceType: 'credit_note',
      sourceInvoiceId,
      deletedAt: null
    })
      .select('invoiceId invoiceNumber status grandTotal postedAt creditReason sourceInvoiceId')
      .sort({ createdAt: -1 })
      .lean()
  ]);

  const lines = sourceLines
    .filter((line) => line && line.hiddenLine !== true && String(line.lineType || '') !== 'bundle_component')
    .map((line) => ({
      invoiceLineId: line.invoiceLineId,
      itemNameSnapshot: line.itemNameSnapshot || line.skuSnapshot || null,
      quantity: Number(line.quantity) || 0,
      quantityCredited: Number(line.quantityCredited) || 0,
      quantityRemainingToCredit: computeLineRemainingToCredit(line),
      lineTotal: Number(line.lineTotal) || 0,
      amountCredited: Math.abs(
        scaleLineAmount(line.lineTotal, Number(line.quantity) || 0, Number(line.quantityCredited) || 0)
      )
    }));

  const totalCredited = linkedCreditNotes
    .filter((row) => row.status === 'Posted')
    .reduce((sum, row) => sum + Math.abs(Number(row.grandTotal) || 0), 0);

  return {
    sourceInvoiceId,
    sourceInvoiceNumber: sourceInvoice.invoiceNumber,
    totalCredited,
    amountDue: Number(sourceInvoice.amountDue) || 0,
    lines,
    linkedCreditNotes: linkedCreditNotes.map((row) => ({
      invoiceId: row.invoiceId,
      invoiceMongoId: row._id,
      invoiceNumber: row.invoiceNumber,
      status: row.status,
      grandTotal: Number(row.grandTotal) || 0,
      creditReason: row.creditReason || null,
      postedAt: row.postedAt || null
    }))
  };
}

async function createCreditNoteFromInvoice({
  organizationId,
  sourceInvoiceRef,
  userId,
  body = {}
}) {
  if (!organizationId || !sourceInvoiceRef) {
    const err = new Error('organizationId and source invoice id are required');
    err.code = 'VALIDATION';
    throw err;
  }

  const sourceInvoice = await findSourceInvoice({ organizationId, invoiceRef: sourceInvoiceRef });
  if (!sourceInvoice) {
    const err = new Error('Source invoice not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  if (String(sourceInvoice.invoiceType || 'standard') === 'credit_note') {
    const err = new Error('Credit notes cannot be created from another credit note.');
    err.code = 'VALIDATION';
    throw err;
  }

  const sourceStatus = String(sourceInvoice.status || '').trim();
  if (!CREDITABLE_INVOICE_STATUSES.has(sourceStatus)) {
    const err = new Error(`Only Posted invoices can be credited (status: "${sourceStatus}").`);
    err.code = 'INVOICE_NOT_POSTED';
    err.details = { status: sourceStatus };
    throw err;
  }

  const creditReason = assertValidCreditNoteReason(body.creditReason);
  const creditReasonNote = String(body.creditReasonNote || body.reasonNote || '').trim() || null;

  const [sourceLines, sourceSections] = await Promise.all([
    InvoiceLine.find({ organizationId, invoiceId: sourceInvoice._id })
      .sort({ lineOrder: 1, createdAt: 1 })
      .lean(),
    InvoiceSection.find({ organizationId, invoiceId: sourceInvoice._id })
      .sort({ sectionOrder: 1, createdAt: 1 })
      .lean()
  ]);

  const selections = resolveCreditLineSelections({
    sourceLines,
    requestedLines: body.lines,
    creditMode: body.creditMode || body.mode || 'full'
  });

  const creditTitle =
    String(body.invoiceTitle || '').trim() ||
    `Credit note for ${sourceInvoice.invoiceNumber}${sourceInvoice.invoiceTitle ? ` — ${sourceInvoice.invoiceTitle}` : ''}`;

  const creditNote = await Invoice.create({
    organizationId,
    invoiceTitle: creditTitle,
    invoiceType: 'credit_note',
    invoiceDate: body.invoiceDate ? new Date(body.invoiceDate) : new Date(),
    dueDate: null,
    status: INVOICE_STATUS_DEFAULT,
    currency: sourceInvoice.currency || 'USD',
    exchangeRateSnapshot: Number(sourceInvoice.exchangeRateSnapshot) || 1,
    globalDiscountType: sourceInvoice.globalDiscountType ?? null,
    globalDiscountValue: Number(sourceInvoice.globalDiscountValue) || 0,
    globalDiscountAmount: Number(sourceInvoice.globalDiscountAmount) || 0,
    ownerId: sourceInvoice.ownerId ?? userId ?? null,
    customerId: sourceInvoice.customerId ?? null,
    organizationRefId: sourceInvoice.organizationRefId ?? null,
    contactId: sourceInvoice.contactId ?? null,
    dealId: sourceInvoice.dealId ?? null,
    caseId: sourceInvoice.caseId ?? null,
    billToAddressSnapshot: sourceInvoice.billToAddressSnapshot ?? null,
    shipToAddressSnapshot: sourceInvoice.shipToAddressSnapshot ?? null,
    paymentTermsSnapshot: sourceInvoice.paymentTermsSnapshot ?? null,
    incotermsSnapshot: sourceInvoice.incotermsSnapshot ?? null,
    termsConditionsSnapshot: sourceInvoice.termsConditionsSnapshot ?? null,
    sourceType: 'credit_note',
    sourceInvoiceId: sourceInvoice.invoiceId,
    sourceSalesOrderIds: sourceInvoice.sourceSalesOrderIds || [],
    sourceContext: body.sourceContext || 'credit_note_wizard',
    sourceRef: body.sourceRef || {
      moduleKey: 'invoices',
      recordId: sourceInvoice.invoiceId
    },
    creditReason,
    creditReasonNote,
    createdBy: userId ?? null,
    modifiedBy: userId ?? null
  });

  const sectionMongoBySourceSection = new Map();
  let defaultSectionMongoId = null;

  for (const sourceSection of sourceSections) {
    const created = await InvoiceSection.create(
      mapSourceSectionToCreditSection({
        sourceSection,
        creditNoteId: creditNote._id,
        organizationId
      })
    );
    sectionMongoBySourceSection.set(String(sourceSection._id), created._id);
    if (Number(sourceSection.sectionOrder) === 0 && !defaultSectionMongoId) {
      defaultSectionMongoId = created._id;
    }
  }

  if (!sectionMongoBySourceSection.size) {
    const general = await InvoiceSection.create({
      organizationId,
      invoiceId: creditNote._id,
      sectionTitle: 'General',
      sectionOrder: 0
    });
    defaultSectionMongoId = general._id;
  }

  const bundleParentMongoBySourceLine = new Map();

  for (const { line, quantity } of selections) {
    const sectionMongoId =
      (line.invoiceSectionId && sectionMongoBySourceSection.get(String(line.invoiceSectionId))) ||
      defaultSectionMongoId;

    const creditLine = await InvoiceLine.create(
      mapSourceInvoiceLineToCreditLine({
        sourceLine: line,
        creditQty: quantity,
        creditNoteId: creditNote._id,
        organizationId,
        invoiceSectionMongoId: sectionMongoId
      })
    );

    if (String(line.lineType || '') === 'bundle_parent') {
      bundleParentMongoBySourceLine.set(String(line._id), creditLine._id);
      const childRows = collectBundleChildLines(sourceLines, line, quantity);
      for (const { line: childLine, quantity: childQty } of childRows) {
        const childSectionMongoId =
          (childLine.invoiceSectionId &&
            sectionMongoBySourceSection.get(String(childLine.invoiceSectionId))) ||
          sectionMongoId;
        await InvoiceLine.create(
          mapSourceInvoiceLineToCreditLine({
            sourceLine: childLine,
            creditQty: childQty,
            creditNoteId: creditNote._id,
            organizationId,
            invoiceSectionMongoId: childSectionMongoId,
            parentBundleLineMongoId: creditLine._id
          })
        );
      }
    }
  }

  await recomputeInvoiceAndSectionTotals({ organizationId, invoiceId: creditNote._id });
  const refreshedCreditNote = await Invoice.findById(creditNote._id).lean();

  await writeInvoiceActivity({
    organizationId,
    invoiceId: refreshedCreditNote.invoiceId,
    userId,
    action: 'credit_note_created',
    message: `Credit note ${refreshedCreditNote.invoiceNumber} created from invoice ${sourceInvoice.invoiceNumber}`,
    details: {
      creditNoteNumber: refreshedCreditNote.invoiceNumber,
      sourceInvoiceNumber: sourceInvoice.invoiceNumber,
      sourceInvoiceId: sourceInvoice.invoiceId,
      creditReason,
      creditReasonNote,
      lineCount: selections.length,
      grandTotal: refreshedCreditNote.grandTotal
    }
  });

  await writeInvoiceActivity({
    organizationId,
    invoiceId: sourceInvoice.invoiceId,
    userId,
    action: 'invoice_credited',
    message: `Credit note ${refreshedCreditNote.invoiceNumber} created against this invoice`,
    details: {
      creditNoteNumber: refreshedCreditNote.invoiceNumber,
      creditNoteId: refreshedCreditNote.invoiceId,
      sourceInvoiceNumber: sourceInvoice.invoiceNumber,
      creditReason,
      grandTotal: refreshedCreditNote.grandTotal
    }
  });

  return {
    creditNote: refreshedCreditNote,
    sourceInvoice: sourceInvoice.toObject(),
    lineSelections: selections.map(({ line, quantity }) => ({
      invoiceLineId: line.invoiceLineId,
      quantity,
      itemNameSnapshot: line.itemNameSnapshot || null,
      sourceInvoiceLineId: line.invoiceLineId
    }))
  };
}

module.exports = {
  CREDITABLE_INVOICE_STATUSES,
  scaleLineAmount,
  computeLineRemainingToCredit,
  resolveCreditLineSelections,
  buildInvoiceCreditSummary,
  createCreditNoteFromInvoice
};
