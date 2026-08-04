/**
 * Purchase Order email — vendor-facing send with optional PDF attachment.
 */
const People = require('../models/People');
const Organization = require('../models/Organization');
const emailService = require('./emailService');
const { getPurchaseOrder } = require('./procurementService');
const { PO_STATUSES } = require('../constants/procurementLifecycle');

/** Email allowed once issued / in progress (not cancelled draft-only). */
const EMAILABLE_STATUSES = new Set([
  PO_STATUSES.DRAFT,
  PO_STATUSES.PENDING_APPROVAL,
  PO_STATUSES.APPROVED,
  PO_STATUSES.ORDERED,
  PO_STATUSES.PARTIALLY_RECEIVED,
  PO_STATUSES.FULLY_RECEIVED
]);

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

function safeFilePart(value) {
  return String(value || 'purchase-order')
    .trim()
    .replace(/[^\w.\-]+/g, '_')
    .slice(0, 80) || 'purchase-order';
}

async function resolveRecipientEmail({ purchaseOrder, to }) {
  const explicit = normalizeEmail(to);
  if (explicit) return explicit;

  const contact = purchaseOrder?.vendorContactId;
  if (contact && typeof contact === 'object' && contact.email) {
    return normalizeEmail(contact.email);
  }
  const contactId = contact?._id || contact;
  if (contactId) {
    const person = await People.findOne({
      _id: contactId,
      organizationId: purchaseOrder.organizationId
    })
      .select('email')
      .lean();
    if (person?.email) return normalizeEmail(person.email);
  }

  const vendorId = purchaseOrder?.vendorId?._id || purchaseOrder?.vendorId;
  if (vendorId) {
    const org =
      purchaseOrder.vendorId && typeof purchaseOrder.vendorId === 'object'
        ? purchaseOrder.vendorId
        : await Organization.findOne({ _id: vendorId, deletedAt: null })
            .select('email name')
            .lean();
    if (org?.email) return normalizeEmail(org.email);
  }
  return null;
}

function buildDefaultSubject(po) {
  const number = po.poNumber || 'PO';
  const subject = po.subject ? ` — ${po.subject}` : '';
  return `Purchase Order ${number}${subject}`;
}

function buildEmailHtml({ po, message, vendorName }) {
  const greeting = vendorName ? `Hello ${vendorName},` : 'Hello,';
  const bodyText =
    String(message || '').trim() ||
    'Please find our purchase order details below. Reply if you have any questions.';
  const grandTotal = Number(po.grandTotal);
  const currency = po.currency || '';
  const totalLine =
    Number.isFinite(grandTotal)
      ? `<p style="margin:16px 0;font-size:15px;"><strong>Grand total:</strong> ${grandTotal.toFixed(2)} ${currency}</p>`
      : '';
  const meta = [
    po.poNumber ? `<strong>PO #:</strong> ${po.poNumber}` : '',
    po.subject ? `<strong>Subject:</strong> ${po.subject}` : '',
    po.expectedDeliveryDate
      ? `<strong>Expected receipt:</strong> ${new Date(po.expectedDeliveryDate).toLocaleDateString()}`
      : ''
  ]
    .filter(Boolean)
    .join('<br>');

  return `
    <div style="font-family:system-ui,-apple-system,sans-serif;color:#111827;line-height:1.5;">
      <p>${greeting}</p>
      <p>${bodyText.replace(/\n/g, '<br>')}</p>
      <p style="margin:16px 0;font-size:14px;color:#374151;">${meta}</p>
      ${totalLine}
      <p style="margin-top:24px;font-size:13px;color:#6b7280;">Thank you.</p>
    </div>
  `.trim();
}

async function tryRenderPoPdf({ organizationId, recordId, userId }) {
  try {
    const ContentTemplate = require('../models/ContentTemplate');
    const { renderTemplate } = require('./contentPlatform/contentRenderService');

    let template = null;
    try {
      const { resolveModuleDocumentTemplate } = require('./contentPlatform/moduleDocumentRenderService');
      template = await resolveModuleDocumentTemplate({
        organizationId,
        moduleKey: 'purchase_orders'
      });
    } catch {
      template = await ContentTemplate.findOne({
        organizationId,
        purpose: 'purchase_order',
        deletedAt: null
      })
        .sort({ isDefault: -1, updatedAt: -1 })
        .lean();
    }
    if (!template?._id) return null;

    const result = await renderTemplate({
      organizationId,
      templateId: template._id,
      userId,
      outputFormat: 'pdf',
      preview: false,
      persistOutput: false,
      runtimeContext: {
        recordModuleKey: 'purchase_orders',
        recordId: String(recordId)
      }
    });
    if (result?.buffer && Buffer.isBuffer(result.buffer)) return result.buffer;
    return null;
  } catch (err) {
    console.warn('[purchaseOrderEmail] PDF attachment skipped:', err?.message);
    return null;
  }
}

async function sendPurchaseOrderEmail({ organizationId, purchaseOrderId, userId, body = {}, req }) {
  const { purchaseOrder } = await getPurchaseOrder({ organizationId, id: purchaseOrderId });
  if (!purchaseOrder) {
    const err = new Error('Purchase order not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const status = String(purchaseOrder.status || '').toLowerCase();
  if (!EMAILABLE_STATUSES.has(status) || status === PO_STATUSES.CANCELLED) {
    const err = new Error(`Purchase order cannot be emailed in status "${status}"`);
    err.code = 'PO_NOT_EMAILABLE';
    throw err;
  }

  const configured = await emailService.isConfiguredForOrganization(organizationId);
  if (!configured) {
    const err = new Error(
      'Email is not configured for this organization. Set up email in Settings → Integrations.'
    );
    err.code = 'EMAIL_NOT_CONFIGURED';
    throw err;
  }

  const recipient = await resolveRecipientEmail({ purchaseOrder, to: body.to });
  if (!recipient) {
    const err = new Error(
      'Recipient email is required. Enter a vendor email or set a vendor contact with email.'
    );
    err.code = 'MISSING_RECIPIENT';
    throw err;
  }

  const vendorName =
    purchaseOrder.vendorId && typeof purchaseOrder.vendorId === 'object'
      ? purchaseOrder.vendorId.name
      : '';

  const subject = String(body.subject || '').trim() || buildDefaultSubject(purchaseOrder);
  const html = buildEmailHtml({
    po: purchaseOrder,
    message: body.message,
    vendorName
  });
  const text =
    String(body.message || '').trim() ||
    `Purchase Order ${purchaseOrder.poNumber || ''}`.trim();

  const attachments = [];
  const attachPdf = body.attachPdf !== false;
  if (attachPdf) {
    const pdf = await tryRenderPoPdf({
      organizationId,
      recordId: purchaseOrder._id,
      userId
    });
    if (pdf) {
      attachments.push({
        filename: `${safeFilePart(purchaseOrder.poNumber)}.pdf`,
        content: pdf
      });
    }
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

  return {
    purchaseOrder,
    email: {
      to: recipient,
      subject,
      messageId: sendResult.messageId || null,
      provider: sendResult.provider || null,
      attachPdf: attachments.length > 0,
      clientBaseUrl: resolveClientBaseUrl(req)
    }
  };
}

module.exports = {
  sendPurchaseOrderEmail,
  EMAILABLE_STATUSES
};
