/**
 * INV2 — Manual invoice create + draft header mutations.
 */

const Invoice = require('../models/Invoice');
const InvoiceLine = require('../models/InvoiceLine');
const InvoiceSection = require('../models/InvoiceSection');
const People = require('../models/People');
const {
  INVOICE_STATUS_DEFAULT,
  assertInvoiceCommercialEditAllowed,
  assertInvoiceRecordEditable,
  isInvoiceCommerciallyLockedStatus
} = require('../constants/invoiceLifecycle');
const { ensureDefaultInvoiceSection } = require('./invoiceSectionService');
const { writeInvoiceActivity } = require('./invoiceActivityService');

const PATCHABLE_HEADER_FIELDS = new Set([
  'invoiceTitle',
  'invoiceDate',
  'dueDate',
  'currency',
  'exchangeRateSnapshot',
  'ownerId',
  'customerId',
  'organizationRefId',
  'contactId',
  'dealId',
  'caseId',
  'globalDiscountType',
  'globalDiscountValue',
  'globalDiscountAmount',
  'customFields'
]);

/** Posted invoices: allow setting account/contact only when still empty (payment-link backfill). */
const CUSTOMER_BACKFILL_FIELDS = new Set(['organizationRefId', 'contactId']);

function isEmptyCustomerRef(value) {
  return value == null || value === '';
}

function organizationIdFromPerson(person) {
  if (!person) return null;
  const o = person.organization;
  if (o == null || o === '') return null;
  if (typeof o === 'object' && o._id) return o._id;
  return o;
}

async function applyContactOrganizationPrefill({ organizationId, patchBody, invoice }) {
  const contactId = patchBody.contactId;
  if (!contactId || !isEmptyCustomerRef(invoice.organizationRefId)) return;
  if (!isEmptyCustomerRef(patchBody.organizationRefId)) return;

  const person = await People.findOne({
    _id: contactId,
    organizationId,
    deletedAt: null
  })
    .select('organization')
    .lean();

  const orgId = organizationIdFromPerson(person);
  if (orgId) {
    patchBody.organizationRefId = orgId;
  }
}

async function loadInvoiceOrThrow({ organizationId, invoiceRef }) {
  const ref = String(invoiceRef || '').trim();
  const invoice =
    (await Invoice.findOne({ organizationId, invoiceId: ref, deletedAt: null })) ||
    (await Invoice.findOne({ organizationId, _id: ref, deletedAt: null }));

  if (!invoice) {
    const err = new Error('Invoice not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  return invoice;
}

async function createManualInvoice({ organizationId, userId, body = {} }) {
  const invoice = await Invoice.create({
    organizationId,
    invoiceTitle: body.invoiceTitle ?? null,
    invoiceDate: body.invoiceDate ?? new Date(),
    dueDate: body.dueDate ?? null,
    status: INVOICE_STATUS_DEFAULT,
    currency: body.currency ?? 'USD',
    exchangeRateSnapshot: Number(body.exchangeRateSnapshot) || 1,
    ownerId: body.ownerId ?? userId ?? null,
    customerId: body.customerId ?? null,
    organizationRefId: body.organizationRefId ?? null,
    contactId: body.contactId ?? null,
    dealId: body.dealId ?? null,
    caseId: body.caseId ?? null,
    sourceType: 'manual',
    sourceContext: body.sourceContext || 'manual',
    sourceRef: body.sourceRef || null,
    createdBy: userId ?? null,
    modifiedBy: userId ?? null,
    customFields: body.customFields ?? {}
  });

  await ensureDefaultInvoiceSection({ organizationId, invoiceId: invoice._id });

  await writeInvoiceActivity({
    organizationId,
    invoiceId: invoice.invoiceId,
    userId,
    action: 'invoice_created',
    message: `Invoice ${invoice.invoiceNumber} created`,
    details: {
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      sourceType: 'manual'
    }
  });

  return invoice.toObject();
}

async function patchInvoiceHeader({ organizationId, invoiceRef, userId, body = {} }) {
  const invoice = await loadInvoiceOrThrow({ organizationId, invoiceRef });
  assertInvoiceRecordEditable(invoice);

  const patchBody = {};
  for (const [key, value] of Object.entries(body || {})) {
    if (!PATCHABLE_HEADER_FIELDS.has(key)) continue;
    patchBody[key] = value;
  }
  if (Object.keys(patchBody).length === 0) {
    return invoice.toObject();
  }

  await applyContactOrganizationPrefill({ organizationId, patchBody, invoice });
  const patchKeys = Object.keys(patchBody);

  const status = String(invoice.status || '');
  if (isInvoiceCommerciallyLockedStatus(status)) {
    const nonBackfillKeys = patchKeys.filter((k) => !CUSTOMER_BACKFILL_FIELDS.has(k));
    if (nonBackfillKeys.length > 0) {
      assertInvoiceCommercialEditAllowed(invoice);
    }
    for (const key of CUSTOMER_BACKFILL_FIELDS) {
      if (!(key in patchBody)) continue;
      if (!isEmptyCustomerRef(invoice[key])) {
        const err = new Error(
          key === 'organizationRefId'
            ? 'Account cannot be changed on a posted invoice.'
            : 'Contact cannot be changed on a posted invoice.'
        );
        err.code = 'INVOICE_COMMERCIAL_LOCK';
        err.details = { status, field: key };
        throw err;
      }
    }
    for (const key of patchKeys) {
      invoice[key] = patchBody[key];
    }
    invoice.modifiedBy = userId || null;
    await invoice.save();

    await writeInvoiceActivity({
      organizationId,
      invoiceId: invoice.invoiceId,
      userId,
      action: 'invoice_updated',
      message: `Invoice ${invoice.invoiceNumber} customer updated`,
      details: { invoiceNumber: invoice.invoiceNumber, backfill: true }
    });

    return invoice.toObject();
  }

  assertInvoiceCommercialEditAllowed(invoice);

  if (status !== INVOICE_STATUS_DEFAULT) {
    const err = new Error('Invoice header can only be edited in Draft status.');
    err.code = 'INVOICE_NOT_DRAFT';
    err.details = { status: invoice.status };
    throw err;
  }

  for (const key of patchKeys) {
    invoice[key] = patchBody[key];
  }
  invoice.modifiedBy = userId || null;
  await invoice.save();

  await writeInvoiceActivity({
    organizationId,
    invoiceId: invoice.invoiceId,
    userId,
    action: 'invoice_updated',
    message: `Invoice ${invoice.invoiceNumber} updated`,
    details: { invoiceNumber: invoice.invoiceNumber }
  });

  return invoice.toObject();
}

async function deleteDraftInvoice({ organizationId, invoiceRef, userId }) {
  const invoice = await loadInvoiceOrThrow({ organizationId, invoiceRef });
  if (String(invoice.status || '') !== INVOICE_STATUS_DEFAULT) {
    const err = new Error('Only Draft invoices can be deleted.');
    err.code = 'INVOICE_NOT_DRAFT';
    err.details = { status: invoice.status };
    throw err;
  }

  await InvoiceLine.deleteMany({ organizationId, invoiceId: invoice._id });
  await InvoiceSection.deleteMany({ organizationId, invoiceId: invoice._id });
  invoice.deletedAt = new Date();
  invoice.deletedBy = userId || null;
  await invoice.save();

  return { invoiceId: invoice.invoiceId, deleted: true };
}

module.exports = {
  loadInvoiceOrThrow,
  createManualInvoice,
  patchInvoiceHeader,
  deleteDraftInvoice
};
