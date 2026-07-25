/**
 * INV2 — Draft invoice line mutations.
 */

const InvoiceLine = require('../models/InvoiceLine');
const InvoiceSection = require('../models/InvoiceSection');
const invoiceTotalsService = require('./invoiceTotalsService');
const { recomputeInvoiceAndSectionTotals } = require('./invoiceSectionService');
const { loadInvoiceOrThrow } = require('./invoiceManualService');
const { writeInvoiceActivity } = require('./invoiceActivityService');
const {
  INVOICE_STATUS_DEFAULT,
  assertInvoiceCommercialEditAllowed
} = require('../constants/invoiceLifecycle');

function asNumber(value, { defaultValue = NaN } = {}) {
  const n = Number(value);
  return Number.isFinite(n) ? n : defaultValue;
}

async function loadDraftInvoice({ organizationId, invoiceRef }) {
  const invoice = await loadInvoiceOrThrow({ organizationId, invoiceRef });
  assertInvoiceCommercialEditAllowed(invoice);
  if (String(invoice.status || '') !== INVOICE_STATUS_DEFAULT) {
    const err = new Error('Lines can only be edited while invoice is Draft.');
    err.code = 'INVOICE_NOT_DRAFT';
    err.details = { status: invoice.status };
    throw err;
  }
  return invoice;
}

async function loadDraftLine({ organizationId, invoiceId, lineRef }) {
  const ref = String(lineRef || '').trim();
  const line =
    (await InvoiceLine.findOne({ organizationId, invoiceId, invoiceLineId: ref })) ||
    (await InvoiceLine.findOne({ organizationId, invoiceId, _id: ref }));

  if (!line) {
    const err = new Error('Invoice line not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (line.lockedSnapshot === true) {
    const err = new Error('Invoice line is locked.');
    err.code = 'INVOICE_LINE_LOCKED';
    throw err;
  }
  return line;
}

function recomputeLineTotals(line) {
  const computed = invoiceTotalsService.computeLineTotals(line);
  line.lineSubtotal = computed.lineSubtotal;
  line.lineTaxTotal = computed.lineTaxTotal;
  line.lineTotal = computed.lineTotal;
}

async function patchInvoiceLine({ organizationId, invoiceRef, lineRef, userId, body = {} }) {
  const invoice = await loadDraftInvoice({ organizationId, invoiceRef });
  const line = await loadDraftLine({ organizationId, invoiceId: invoice._id, lineRef });

  if (body.quantity !== undefined) {
    const qty = asNumber(body.quantity, { defaultValue: NaN });
    if (!Number.isFinite(qty) || qty <= 0) {
      const err = new Error('quantity must be > 0');
      err.code = 'VALIDATION';
      throw err;
    }
    line.quantity = qty;
    recomputeLineTotals(line);
  }

  if (body.invoiceSectionId !== undefined) {
    const sectionRef = String(body.invoiceSectionId || '').trim();
    if (!sectionRef) {
      line.invoiceSectionId = null;
    } else {
      const section =
        (await InvoiceSection.findOne({ organizationId, invoiceId: invoice._id, _id: sectionRef })) ||
        (await InvoiceSection.findOne({
          organizationId,
          invoiceId: invoice._id,
          invoiceSectionId: sectionRef
        }));
      if (!section) {
        const err = new Error('Invoice section not found');
        err.code = 'SECTION_NOT_FOUND';
        throw err;
      }
      line.invoiceSectionId = section._id;
    }
  }

  const { applyCommercialLineDiscountAndTax } = require('../utils/applyCommercialLineCommercialFields');
  const { taxTouched } = await applyCommercialLineDiscountAndTax(line, body, {
    organizationId,
    forceTaxRecompute: body.quantity !== undefined
  });

  if (!taxTouched) {
    recomputeLineTotals(line);
  }

  await line.save();
  const { totals, sections } = await recomputeInvoiceAndSectionTotals({
    organizationId,
    invoiceId: invoice._id
  });

  await writeInvoiceActivity({
    organizationId,
    invoiceId: invoice.invoiceId,
    userId,
    action: 'invoice_line_updated',
    message: `Invoice line updated on ${invoice.invoiceNumber}`,
    details: { invoiceNumber: invoice.invoiceNumber, invoiceLineId: line.invoiceLineId, totals }
  });

  const lines = await InvoiceLine.find({ organizationId, invoiceId: invoice._id })
    .sort({ lineOrder: 1, createdAt: 1 })
    .lean();

  return { line: line.toObject(), lines, sections, totals };
}

async function deleteInvoiceLine({ organizationId, invoiceRef, lineRef, userId }) {
  const invoice = await loadDraftInvoice({ organizationId, invoiceRef });
  const line = await loadDraftLine({ organizationId, invoiceId: invoice._id, lineRef });

  if (String(line.lineType || '') === 'bundle_component') {
    const err = new Error('Bundle component lines cannot be deleted directly.');
    err.code = 'VALIDATION';
    throw err;
  }

  if (String(line.lineType || '') === 'bundle_parent') {
    await InvoiceLine.deleteMany({
      organizationId,
      invoiceId: invoice._id,
      parentBundleLineId: line._id
    });
  }

  await line.deleteOne();

  const { totals, sections } = await recomputeInvoiceAndSectionTotals({
    organizationId,
    invoiceId: invoice._id
  });

  await writeInvoiceActivity({
    organizationId,
    invoiceId: invoice.invoiceId,
    userId,
    action: 'invoice_line_deleted',
    message: `Invoice line removed from ${invoice.invoiceNumber}`,
    details: { invoiceNumber: invoice.invoiceNumber, totals }
  });

  const lines = await InvoiceLine.find({ organizationId, invoiceId: invoice._id })
    .sort({ lineOrder: 1, createdAt: 1 })
    .lean();

  return { lines, sections, totals };
}

module.exports = {
  patchInvoiceLine,
  deleteInvoiceLine,
  loadDraftInvoice
};
