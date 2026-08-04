/**
 * Delivery Return email — customer-facing send with optional PDF attachment.
 */
const People = require('../models/People');
const Organization = require('../models/Organization');
const emailService = require('./emailService');
const { getDeliveryReturn } = require('./deliveryReturnService');
const { DR_STATUSES } = require('../constants/deliveryReturnLifecycle');

const EMAILABLE_STATUSES = new Set([
  DR_STATUSES.DRAFT,
  DR_STATUSES.PENDING_APPROVAL,
  DR_STATUSES.APPROVED,
  DR_STATUSES.RECEIVED,
  DR_STATUSES.INSPECTED,
  DR_STATUSES.RESTOCKED,
  DR_STATUSES.INVENTORY_UPDATED,
  DR_STATUSES.CLOSED
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
    String(value || 'delivery-return')
      .trim()
      .replace(/[^\w.\-]+/g, '_')
      .slice(0, 80) || 'delivery-return'
  );
}

async function resolveRecipientEmail({ deliveryReturn, to }) {
  const explicit = normalizeEmail(to);
  if (explicit) return explicit;

  if (deliveryReturn?.email) {
    const fromHeader = normalizeEmail(deliveryReturn.email);
    if (fromHeader) return fromHeader;
  }

  const contact = deliveryReturn?.contactPersonId;
  if (contact && typeof contact === 'object' && contact.email) {
    return normalizeEmail(contact.email);
  }
  const contactId = contact?._id || contact;
  if (contactId) {
    const person = await People.findOne({
      _id: contactId,
      organizationId: deliveryReturn.organizationId
    })
      .select('email')
      .lean();
    if (person?.email) return normalizeEmail(person.email);
  }

  const customerId = deliveryReturn?.customerId?._id || deliveryReturn?.customerId;
  if (customerId) {
    const org =
      deliveryReturn.customerId && typeof deliveryReturn.customerId === 'object'
        ? deliveryReturn.customerId
        : await Organization.findOne({ _id: customerId, deletedAt: null })
            .select('email name')
            .lean();
    if (org?.email) return normalizeEmail(org.email);
  }
  return null;
}

function buildDefaultSubject(dr) {
  const number = dr.deliveryReturnNumber || 'DR';
  const subject = dr.subject ? ` — ${dr.subject}` : '';
  return `Delivery Return ${number}${subject}`;
}

function buildEmailHtml({ dr, message, customerName }) {
  const greeting = customerName ? `Hello ${customerName},` : 'Hello,';
  const bodyText =
    String(message || '').trim() ||
    'Please find our delivery return details below. Reply if you have any questions.';
  const grandTotal = Number(dr.grandTotal);
  const currency = dr.currency || '';
  const totalLine = Number.isFinite(grandTotal)
    ? `<p style="margin:16px 0;font-size:15px;"><strong>Return total:</strong> ${grandTotal.toFixed(2)} ${currency}</p>`
    : '';
  const meta = [
    dr.deliveryReturnNumber ? `<strong>DR #:</strong> ${dr.deliveryReturnNumber}` : '',
    dr.subject ? `<strong>Subject:</strong> ${dr.subject}` : '',
    dr.returnDate
      ? `<strong>Return date:</strong> ${new Date(dr.returnDate).toLocaleDateString()}`
      : '',
    dr.returnReason ? `<strong>Reason:</strong> ${dr.returnReason}` : ''
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

async function tryRenderDrPdf({ organizationId, recordId, userId }) {
  try {
    const ContentTemplate = require('../models/ContentTemplate');
    const { renderTemplate } = require('./contentPlatform/contentRenderService');

    let template = null;
    try {
      const { resolveModuleDocumentTemplate } = require('./contentPlatform/moduleDocumentRenderService');
      template = await resolveModuleDocumentTemplate({
        organizationId,
        moduleKey: 'delivery_returns'
      });
    } catch {
      template = await ContentTemplate.findOne({
        organizationId,
        purpose: 'delivery_return',
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
        recordModuleKey: 'delivery_returns',
        recordId: String(recordId)
      }
    });
    if (result?.buffer && Buffer.isBuffer(result.buffer)) return result.buffer;
    return null;
  } catch (err) {
    console.warn('[deliveryReturnEmail] PDF attachment skipped:', err?.message);
    return null;
  }
}

async function sendDeliveryReturnEmail({ organizationId, deliveryReturnId, userId, body = {}, req }) {
  const { deliveryReturn } = await getDeliveryReturn({ organizationId, id: deliveryReturnId });
  if (!deliveryReturn) {
    const err = new Error('Delivery return not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const status = String(deliveryReturn.status || '').toLowerCase();
  if (!EMAILABLE_STATUSES.has(status) || status === DR_STATUSES.CANCELLED) {
    const err = new Error(`Delivery return cannot be emailed in status "${status}"`);
    err.code = 'DR_NOT_EMAILABLE';
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

  const recipient = await resolveRecipientEmail({ deliveryReturn, to: body.to });
  if (!recipient) {
    const err = new Error(
      'Recipient email is required. Enter a customer email or set a contact with email.'
    );
    err.code = 'MISSING_RECIPIENT';
    throw err;
  }

  const customerName =
    deliveryReturn.customerId && typeof deliveryReturn.customerId === 'object'
      ? deliveryReturn.customerId.name
      : '';

  const subject = String(body.subject || '').trim() || buildDefaultSubject(deliveryReturn);
  const html = buildEmailHtml({
    dr: deliveryReturn,
    message: body.message,
    customerName
  });
  const text =
    String(body.message || '').trim() ||
    `Delivery Return ${deliveryReturn.deliveryReturnNumber || ''}`.trim();

  const attachments = [];
  const attachPdf = body.attachPdf !== false;
  if (attachPdf) {
    const pdf = await tryRenderDrPdf({
      organizationId,
      recordId: deliveryReturn._id,
      userId
    });
    if (pdf) {
      attachments.push({
        filename: `${safeFilePart(deliveryReturn.deliveryReturnNumber)}.pdf`,
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
    deliveryReturn,
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
  sendDeliveryReturnEmail,
  EMAILABLE_STATUSES
};
