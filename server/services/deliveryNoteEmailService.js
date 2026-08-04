/**
 * Delivery Note email — customer-facing send with optional PDF attachment.
 */
const People = require('../models/People');
const Organization = require('../models/Organization');
const emailService = require('./emailService');
const { getDeliveryNote } = require('./deliveryNoteService');
const { DN_STATUSES } = require('../constants/deliveryNoteLifecycle');

const EMAILABLE_STATUSES = new Set([
  DN_STATUSES.DRAFT,
  DN_STATUSES.READY_FOR_DISPATCH,
  DN_STATUSES.APPROVED,
  DN_STATUSES.PICKED,
  DN_STATUSES.PACKED,
  DN_STATUSES.DISPATCHED,
  DN_STATUSES.DELIVERED,
  DN_STATUSES.PARTIALLY_DELIVERED,
  DN_STATUSES.CLOSED
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
  return (
    String(value || 'delivery-note')
      .trim()
      .replace(/[^\w.\-]+/g, '_')
      .slice(0, 80) || 'delivery-note'
  );
}

async function resolveRecipientEmail({ deliveryNote, to }) {
  const explicit = normalizeEmail(to);
  if (explicit) return explicit;

  if (deliveryNote?.email) {
    const fromHeader = normalizeEmail(deliveryNote.email);
    if (fromHeader) return fromHeader;
  }

  const contact = deliveryNote?.contactPersonId;
  if (contact && typeof contact === 'object' && contact.email) {
    return normalizeEmail(contact.email);
  }
  const contactId = contact?._id || contact;
  if (contactId) {
    const person = await People.findOne({
      _id: contactId,
      organizationId: deliveryNote.organizationId
    })
      .select('email')
      .lean();
    if (person?.email) return normalizeEmail(person.email);
  }

  const customerId = deliveryNote?.customerId?._id || deliveryNote?.customerId;
  if (customerId) {
    const org =
      deliveryNote.customerId && typeof deliveryNote.customerId === 'object'
        ? deliveryNote.customerId
        : await Organization.findOne({ _id: customerId, deletedAt: null })
            .select('email name')
            .lean();
    if (org?.email) return normalizeEmail(org.email);
  }
  return null;
}

function buildDefaultSubject(dn) {
  const number = dn.deliveryNoteNumber || 'DN';
  const subject = dn.subject ? ` — ${dn.subject}` : '';
  return `Delivery Note ${number}${subject}`;
}

function buildEmailHtml({ dn, message, customerName }) {
  const greeting = customerName ? `Hello ${customerName},` : 'Hello,';
  const bodyText =
    String(message || '').trim() ||
    'Please find our delivery note details below. Reply if you have any questions.';
  const grandTotal = Number(dn.grandTotal);
  const currency = dn.currency || '';
  const totalLine = Number.isFinite(grandTotal)
    ? `<p style="margin:16px 0;font-size:15px;"><strong>Delivery total:</strong> ${grandTotal.toFixed(2)} ${currency}</p>`
    : '';
  const meta = [
    dn.deliveryNoteNumber ? `<strong>DN #:</strong> ${dn.deliveryNoteNumber}` : '',
    dn.subject ? `<strong>Subject:</strong> ${dn.subject}` : '',
    dn.deliveryDate
      ? `<strong>Delivery date:</strong> ${new Date(dn.deliveryDate).toLocaleDateString()}`
      : '',
    dn.trackingNumber ? `<strong>Tracking:</strong> ${dn.trackingNumber}` : ''
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

async function tryRenderDnPdf({ organizationId, recordId, userId }) {
  try {
    const ContentTemplate = require('../models/ContentTemplate');
    const { renderTemplate } = require('./contentPlatform/contentRenderService');

    let template = null;
    try {
      const { resolveModuleDocumentTemplate } = require('./contentPlatform/moduleDocumentRenderService');
      template = await resolveModuleDocumentTemplate({
        organizationId,
        moduleKey: 'delivery_notes'
      });
    } catch {
      template = await ContentTemplate.findOne({
        organizationId,
        purpose: 'delivery_note',
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
        recordModuleKey: 'delivery_notes',
        recordId: String(recordId)
      }
    });
    if (result?.buffer && Buffer.isBuffer(result.buffer)) return result.buffer;
    return null;
  } catch (err) {
    console.warn('[deliveryNoteEmail] PDF attachment skipped:', err?.message);
    return null;
  }
}

async function sendDeliveryNoteEmail({ organizationId, deliveryNoteId, userId, body = {}, req }) {
  const { deliveryNote } = await getDeliveryNote({ organizationId, id: deliveryNoteId });
  if (!deliveryNote) {
    const err = new Error('Delivery note not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const status = String(deliveryNote.status || '').toLowerCase();
  if (!EMAILABLE_STATUSES.has(status) || status === DN_STATUSES.CANCELLED) {
    const err = new Error(`Delivery note cannot be emailed in status "${status}"`);
    err.code = 'DN_NOT_EMAILABLE';
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

  const recipient = await resolveRecipientEmail({ deliveryNote, to: body.to });
  if (!recipient) {
    const err = new Error(
      'Recipient email is required. Enter a customer email or set a contact with email.'
    );
    err.code = 'MISSING_RECIPIENT';
    throw err;
  }

  const customerName =
    deliveryNote.customerId && typeof deliveryNote.customerId === 'object'
      ? deliveryNote.customerId.name
      : '';

  const subject = String(body.subject || '').trim() || buildDefaultSubject(deliveryNote);
  const html = buildEmailHtml({
    dn: deliveryNote,
    message: body.message,
    customerName
  });
  const text =
    String(body.message || '').trim() ||
    `Delivery Note ${deliveryNote.deliveryNoteNumber || ''}`.trim();

  const attachments = [];
  const attachPdf = body.attachPdf !== false;
  if (attachPdf) {
    const pdf = await tryRenderDnPdf({
      organizationId,
      recordId: deliveryNote._id,
      userId
    });
    if (pdf) {
      attachments.push({
        filename: `${safeFilePart(deliveryNote.deliveryNoteNumber)}.pdf`,
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
    deliveryNote,
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
  sendDeliveryNoteEmail,
  EMAILABLE_STATUSES
};
