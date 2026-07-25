/**
 * Draft commercial document ops for Invoices (discounts, recalc, reorder).
 */

const Invoice = require('../models/Invoice');
const InvoiceLine = require('../models/InvoiceLine');
const InvoiceSection = require('../models/InvoiceSection');
const invoiceTotalsService = require('./invoiceTotalsService');
const {
  recomputeInvoiceAndSectionTotals,
  listInvoiceSections
} = require('./invoiceSectionService');
const { loadInvoiceOrThrow } = require('./invoiceManualService');
const { writeInvoiceActivity } = require('./invoiceActivityService');
const {
  INVOICE_STATUS_DEFAULT,
  assertInvoiceCommercialEditAllowed
} = require('../constants/invoiceLifecycle');
const {
  applyGlobalDiscountFields,
  applySectionDiscountFields,
  normalizeLineReorderOpsOrThrow,
  normalizeSectionReorderOpsOrThrow
} = require('../utils/applyCommercialLineCommercialFields');

async function loadDraftInvoiceDoc({ organizationId, invoiceRef }) {
  const invoice = await loadInvoiceOrThrow({ organizationId, invoiceRef });
  assertInvoiceCommercialEditAllowed(invoice);
  if (String(invoice.status || '') !== INVOICE_STATUS_DEFAULT) {
    const err = new Error('Commercial edits require Draft status.');
    err.code = 'INVOICE_NOT_DRAFT';
    err.details = { status: invoice.status };
    throw err;
  }
  return invoice;
}

async function patchInvoiceDiscounts({ organizationId, invoiceRef, userId, body = {} }) {
  const invoice = await loadDraftInvoiceDoc({ organizationId, invoiceRef });
  applyGlobalDiscountFields(invoice, body);
  await invoice.save();

  const { totals, sections } = await recomputeInvoiceAndSectionTotals({
    organizationId,
    invoiceId: invoice._id
  });
  const lines = await InvoiceLine.find({ organizationId, invoiceId: invoice._id })
    .sort({ lineOrder: 1, createdAt: 1 })
    .lean();

  await writeInvoiceActivity({
    organizationId,
    invoiceId: invoice.invoiceId,
    userId,
    action: 'invoice_discounts_updated',
    message: `Discounts updated on ${invoice.invoiceNumber}`,
    details: { invoiceNumber: invoice.invoiceNumber, totals }
  });

  const refreshed = await Invoice.findById(invoice._id).lean();
  return { quote: refreshed, invoice: refreshed, lines, sections, totals };
}

async function recalculateInvoice({ organizationId, invoiceRef, userId }) {
  const invoice = await loadDraftInvoiceDoc({ organizationId, invoiceRef });
  const lines = await InvoiceLine.find({ organizationId, invoiceId: invoice._id });

  for (const line of lines) {
    const computed = invoiceTotalsService.computeLineTotals(line);
    line.lineSubtotal = computed.lineSubtotal;
    line.lineTaxTotal = computed.lineTaxTotal;
    line.lineTotal = computed.lineTotal;
    await line.save();
  }

  const { totals, sections } = await recomputeInvoiceAndSectionTotals({
    organizationId,
    invoiceId: invoice._id
  });
  const leanLines = await InvoiceLine.find({ organizationId, invoiceId: invoice._id })
    .sort({ lineOrder: 1, createdAt: 1 })
    .lean();

  await writeInvoiceActivity({
    organizationId,
    invoiceId: invoice.invoiceId,
    userId,
    action: 'invoice_recalculated',
    message: `Totals recalculated on ${invoice.invoiceNumber}`,
    details: { invoiceNumber: invoice.invoiceNumber, totals, updatedLines: leanLines.length }
  });

  return {
    invoiceId: invoice.invoiceId,
    totals,
    sections,
    lines: leanLines,
    updatedLines: leanLines.length
  };
}

async function reorderInvoiceLines({ organizationId, invoiceRef, userId, orders }) {
  const invoice = await loadDraftInvoiceDoc({ organizationId, invoiceRef });
  const ops = normalizeLineReorderOpsOrThrow(orders, {
    lineIdField: 'invoiceLineId',
    parentIdField: 'invoiceId',
    parentId: invoice._id,
    organizationId
  });

  const result = await InvoiceLine.bulkWrite(ops, { ordered: true });
  const lines = await InvoiceLine.find({ organizationId, invoiceId: invoice._id })
    .sort({ lineOrder: 1, createdAt: 1 })
    .lean();
  const { totals, sections } = await recomputeInvoiceAndSectionTotals({
    organizationId,
    invoiceId: invoice._id
  });

  await writeInvoiceActivity({
    organizationId,
    invoiceId: invoice.invoiceId,
    userId,
    action: 'invoice_lines_reordered',
    message: `Lines reordered on ${invoice.invoiceNumber}`,
    details: { invoiceNumber: invoice.invoiceNumber, count: Array.isArray(orders) ? orders.length : 0, totals }
  });

  return {
    lines,
    totals,
    sections,
    bulk: { matched: result.matchedCount, modified: result.modifiedCount }
  };
}

async function reorderInvoiceSections({ organizationId, invoiceRef, userId, orders }) {
  const invoice = await loadDraftInvoiceDoc({ organizationId, invoiceRef });
  const ops = normalizeSectionReorderOpsOrThrow(orders, {
    sectionIdField: 'invoiceSectionId',
    parentIdField: 'invoiceId',
    parentId: invoice._id,
    organizationId
  });

  await InvoiceSection.bulkWrite(ops, { ordered: false });
  const sections = await listInvoiceSections({ organizationId, invoiceId: invoice._id });

  await writeInvoiceActivity({
    organizationId,
    invoiceId: invoice.invoiceId,
    userId,
    action: 'invoice_sections_reordered',
    message: `Sections reordered on ${invoice.invoiceNumber}`,
    details: { invoiceNumber: invoice.invoiceNumber, sectionCount: sections.length }
  });

  return { sections };
}

async function patchInvoiceSectionDiscounts({
  organizationId,
  invoiceRef,
  sectionId,
  userId,
  body = {}
}) {
  const invoice = await loadDraftInvoiceDoc({ organizationId, invoiceRef });
  const ref = String(sectionId || '').trim();
  const section =
    (await InvoiceSection.findOne({
      organizationId,
      invoiceId: invoice._id,
      invoiceSectionId: ref
    })) ||
    (await InvoiceSection.findOne({ organizationId, invoiceId: invoice._id, _id: ref }));

  if (!section) {
    const err = new Error('Invoice section not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  applySectionDiscountFields(section, body);
  await section.save();

  const { totals, sections } = await recomputeInvoiceAndSectionTotals({
    organizationId,
    invoiceId: invoice._id
  });

  await writeInvoiceActivity({
    organizationId,
    invoiceId: invoice.invoiceId,
    userId,
    action: 'invoice_section_discount_updated',
    message: `Section discount updated on ${invoice.invoiceNumber}`,
    details: {
      invoiceNumber: invoice.invoiceNumber,
      invoiceSectionId: section.invoiceSectionId,
      sectionTitle: section.sectionTitle,
      totals
    }
  });

  return { section: section.toObject(), sections, totals };
}

async function patchInvoiceTaxesCharges({ organizationId, invoiceRef, userId, body = {} }) {
  const invoice = await loadDraftInvoiceDoc({ organizationId, invoiceRef });
  const { applyDocumentTaxesChargesSnapshots } = require('../utils/applyDocumentTaxesCharges');
  await applyDocumentTaxesChargesSnapshots(invoice, body, {
    organizationId,
    LineModel: InvoiceLine,
    parentIdField: 'invoiceId'
  });
  await invoice.save();

  const { totals, sections } = await recomputeInvoiceAndSectionTotals({
    organizationId,
    invoiceId: invoice._id
  });
  const lines = await InvoiceLine.find({ organizationId, invoiceId: invoice._id })
    .sort({ lineOrder: 1, createdAt: 1 })
    .lean();
  const refreshed = await Invoice.findById(invoice._id).lean();

  await writeInvoiceActivity({
    organizationId,
    invoiceId: invoice.invoiceId,
    userId,
    action: 'invoice_taxes_charges_updated',
    message: `Taxes/charges updated on ${invoice.invoiceNumber}`,
    details: { invoiceNumber: invoice.invoiceNumber, totals }
  });

  return { quote: refreshed, invoice: refreshed, lines, sections, totals };
}

module.exports = {
  patchInvoiceDiscounts,
  recalculateInvoice,
  reorderInvoiceLines,
  reorderInvoiceSections,
  patchInvoiceSectionDiscounts,
  patchInvoiceTaxesCharges,
  loadDraftInvoiceDoc
};
