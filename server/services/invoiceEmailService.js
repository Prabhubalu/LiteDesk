const Invoice = require('../models/Invoice');
const InvoiceLine = require('../models/InvoiceLine');
const People = require('../models/People');
const emailService = require('./emailService');
const { renderInvoicePdf, resolveInvoiceWatermark } = require('../controllers/invoiceDocumentController');
const { listInvoiceSections } = require('./invoiceSectionService');
const { writeInvoiceActivity } = require('./invoiceActivityService');
const { getInvoiceBranding, formatCreditReasonLabel } = require('./invoiceBrandingService');
const { safeFilePart } = require('../controllers/quoteDocumentController');

const EMAILABLE_INVOICE_STATUSES = new Set(['Posted', 'Partially Paid', 'Paid']);

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function resolveClientBaseUrl(req) {
  const fromEnv = process.env.CLIENT_URL || process.env.FRONTEND_URL;
  if (fromEnv) return String(fromEnv).replace(/\/$/, '');
  const host = req?.get?.('host');
  const proto = req?.protocol || 'http';
  return host ? `${proto}://${host}` : '';
}

async function resolveRecipientEmail({ invoice, to }) {
  const explicit = normalizeEmail(to);
  if (explicit) return explicit;

  const contactId = invoice?.contactId?._id || invoice?.contactId;
  if (!contactId) return null;

  if (invoice.contactId && typeof invoice.contactId === 'object' && invoice.contactId.email) {
    return normalizeEmail(invoice.contactId.email);
  }

  const person = await People.findOne({ _id: contactId, organizationId: invoice.organizationId })
    .select('email')
    .lean();
  return normalizeEmail(person?.email);
}

function assertCanEmailInvoice(invoice) {
  const status = String(invoice?.status || '').trim();
  if (!EMAILABLE_INVOICE_STATUSES.has(status)) {
    const err = new Error(`Only Posted invoices can be emailed (status: "${status}").`);
    err.code = 'INVOICE_NOT_POSTED';
    err.details = { status };
    throw err;
  }
}

function buildDefaultSubject(invoice) {
  const isCreditNote = String(invoice.invoiceType || 'standard') === 'credit_note';
  const number = invoice.invoiceNumber || (isCreditNote ? 'Credit Note' : 'Invoice');
  const title = invoice.invoiceTitle ? ` — ${invoice.invoiceTitle}` : '';
  return isCreditNote ? `Credit note ${number}${title}` : `Invoice ${number}${title}`;
}

function buildEmailLogoBlock(branding, clientBaseUrl) {
  const url = branding?.logoUrl;
  if (!url || !clientBaseUrl) return '';
  const src = String(url).startsWith('http') ? String(url) : `${clientBaseUrl}${url}`;
  return `<img src="${src}" alt="" style="max-height:52px;max-width:220px;margin-bottom:12px;display:block" />`;
}

function buildEmailHtml({ invoice, message, branding = null, sourceInvoice = null }) {
  const brand = branding && typeof branding === 'object' ? branding : {};
  const brandColor = String(brand.brandColor || '#4f46e5');
  const companyName = String(brand.companyName || '').trim();
  const emailSignature = String(brand.emailSignature || '').trim();
  const isCreditNote = String(invoice.invoiceType || 'standard') === 'credit_note';
  const contactName =
    invoice.contactId && typeof invoice.contactId === 'object'
      ? [invoice.contactId.first_name, invoice.contactId.last_name].filter(Boolean).join(' ').trim()
      : '';
  const greeting = contactName ? `Hello ${contactName},` : 'Hello,';
  const bodyText =
    String(message || '').trim() ||
    (isCreditNote
      ? 'Please find your credit note attached. It references the original invoice listed below.'
      : 'Please find your invoice attached.');
  const grandTotal = Number(invoice.grandTotal);
  const currency = invoice.currency || '';
  const totalLine =
    Number.isFinite(grandTotal) && grandTotal !== 0
      ? `<p style="margin:16px 0;font-size:15px;"><strong>${isCreditNote ? 'Credit total' : 'Grand total'}:</strong> ${isCreditNote ? '-' : ''}${Math.abs(grandTotal).toFixed(2)} ${currency}</p>`
      : '';
  const amountDue = Number(invoice.amountDue);
  const dueLine =
    !isCreditNote && Number.isFinite(amountDue)
      ? `<p style="margin:8px 0;font-size:14px;"><strong>Amount due:</strong> ${amountDue.toFixed(2)} ${currency}</p>`
      : '';
  const creditMeta =
    isCreditNote && (sourceInvoice?.invoiceNumber || invoice.sourceInvoiceId)
      ? `<p style="margin:8px 0;font-size:14px;"><strong>Source invoice:</strong> ${sourceInvoice?.invoiceNumber || invoice.sourceInvoiceId}${invoice.creditReason ? ` • ${formatCreditReasonLabel(invoice.creditReason)}` : ''}</p>`
      : '';

  const logoBlock = buildEmailLogoBlock(branding, brand.clientBaseUrl);
  const headerBlock = companyName
    ? `<div style="border-bottom:3px solid ${brandColor};padding-bottom:12px;margin-bottom:20px;">${logoBlock}<p style="margin:0;font-size:18px;font-weight:600;color:#111827;">${companyName}</p></div>`
    : logoBlock
      ? `<div style="border-bottom:3px solid ${brandColor};padding-bottom:12px;margin-bottom:20px;">${logoBlock}</div>`
      : '';

  const signatureBlock = emailSignature
    ? `<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:13px;color:#4b5563;">${emailSignature.replace(/\n/g, '<br>')}</div>`
    : '<p style="margin-top:24px;font-size:13px;color:#6b7280;">Thank you.</p>';

  return `
    <div style="font-family:system-ui,-apple-system,sans-serif;color:#111827;line-height:1.5;">
      ${headerBlock}
      <p>${greeting}</p>
      <p>${bodyText.replace(/\n/g, '<br>')}</p>
      ${creditMeta}
      ${totalLine}
      ${dueLine}
      ${signatureBlock}
    </div>
  `.trim();
}

async function loadInvoiceForEmail({ organizationId, invoiceRef }) {
  return (
    (await Invoice.findOne({ organizationId, invoiceId: invoiceRef, deletedAt: null })
      .populate({ path: 'contactId', select: 'first_name last_name email' })
      .populate({ path: 'organizationRefId', select: 'name' })) ||
    (await Invoice.findOne({ organizationId, _id: invoiceRef, deletedAt: null })
      .populate({ path: 'contactId', select: 'first_name last_name email' })
      .populate({ path: 'organizationRefId', select: 'name' }))
  );
}

async function sendInvoiceEmail({ organizationId, invoiceRef, userId, body = {}, req }) {
  const invoiceDoc = await loadInvoiceForEmail({ organizationId, invoiceRef });
  if (!invoiceDoc) {
    const err = new Error('Invoice not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  assertCanEmailInvoice(invoiceDoc);

  const configured = await emailService.isConfiguredForOrganization(organizationId);
  if (!configured) {
    const err = new Error('Email is not configured for this organization. Set up email in Settings → Integrations.');
    err.code = 'EMAIL_NOT_CONFIGURED';
    throw err;
  }

  const invoice = invoiceDoc.toObject ? invoiceDoc.toObject() : invoiceDoc;
  const isCreditNote = String(invoice.invoiceType || 'standard') === 'credit_note';

  const recipient = await resolveRecipientEmail({ invoice: invoiceDoc, to: body.to });
  if (!recipient) {
    const err = new Error('Recipient email is required. Add a contact with an email or enter a recipient.');
    err.code = 'MISSING_RECIPIENT';
    throw err;
  }

  const attachPdf = body.attachPdf !== false;
  const subject = String(body.subject || '').trim() || buildDefaultSubject(invoice);
  const branding = await getInvoiceBranding(organizationId, { invoiceType: invoice.invoiceType });
  branding.clientBaseUrl = resolveClientBaseUrl(req);

  const sourceInvoice =
    isCreditNote && invoice.sourceInvoiceId
      ? await Invoice.findOne({ organizationId, invoiceId: invoice.sourceInvoiceId, deletedAt: null })
          .select('invoiceId invoiceNumber status grandTotal postedAt')
          .lean()
      : null;

  const html = buildEmailHtml({ invoice, message: body.message, branding, sourceInvoice });
  const defaultText = isCreditNote
    ? 'Please find your credit note attached.'
    : 'Please find your invoice attached.';
  const text = String(body.message || '').trim() || defaultText;

  const attachments = [];
  if (attachPdf) {
    const lines = await InvoiceLine.find({ organizationId, invoiceId: invoice._id })
      .sort({ lineOrder: 1, createdAt: 1 })
      .lean();
    const sections = await listInvoiceSections({ organizationId, invoiceId: invoice._id });
    const watermark = resolveInvoiceWatermark(invoice);
    const pdf = await renderInvoicePdf({
      invoice,
      lines,
      sections,
      sourceInvoice,
      watermark,
      branding
    });
    const prefix = watermark ? `${watermark}-` : '';
    const filename = `${prefix}${safeFilePart(invoice.invoiceNumber)}.pdf`;
    attachments.push({ filename, content: pdf });
  }

  const sendResult = await emailService.sendCrmEmail({
    organizationId,
    to: recipient,
    subject,
    text,
    html,
    attachments,
    replyTo: req?.user?.email || undefined
  });

  if (!sendResult?.success) {
    const err = new Error(sendResult?.error || 'Failed to send email');
    err.code = 'EMAIL_SEND_FAILED';
    throw err;
  }

  await writeInvoiceActivity({
    organizationId,
    invoiceId: invoice.invoiceId,
    userId,
    action: isCreditNote ? 'credit_note_emailed' : 'invoice_emailed',
    message: isCreditNote
      ? `Credit note emailed to ${recipient}`
      : `Invoice emailed to ${recipient}`,
    details: {
      to: recipient,
      subject,
      resend: body.resend === true,
      attachPdf,
      messageId: sendResult.messageId || null,
      provider: sendResult.provider || null
    }
  });

  const refreshed = await Invoice.findOne({ _id: invoice._id, organizationId }).lean();

  return {
    invoice: refreshed,
    email: {
      to: recipient,
      subject,
      messageId: sendResult.messageId || null,
      provider: sendResult.provider || null
    }
  };
}

module.exports = {
  sendInvoiceEmail,
  resolveRecipientEmail,
  assertCanEmailInvoice,
  EMAILABLE_INVOICE_STATUSES
};
