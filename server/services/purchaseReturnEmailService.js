/**
 * Purchase Return email — vendor-facing send with optional PDF attachment.
 */
const People = require('../models/People');
const Organization = require('../models/Organization');
const emailService = require('./emailService');
const { getPurchaseReturn } = require('./procurementService');
const { PR_STATUSES } = require('../constants/procurementLifecycle');

const EMAILABLE_STATUSES = new Set([
  PR_STATUSES.DRAFT,
  PR_STATUSES.PENDING_APPROVAL,
  PR_STATUSES.APPROVED,
  PR_STATUSES.RETURNED,
  PR_STATUSES.PARTIALLY_SETTLED,
  PR_STATUSES.SETTLED,
  PR_STATUSES.CLOSED
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
  return String(value || 'purchase-return')
    .trim()
    .replace(/[^\w.\-]+/g, '_')
    .slice(0, 80) || 'purchase-return';
}

async function resolveRecipientEmail({ purchaseReturn, to }) {
  const explicit = normalizeEmail(to);
  if (explicit) return explicit;

  const contact = purchaseReturn?.vendorContactId;
  if (contact && typeof contact === 'object' && contact.email) {
    return normalizeEmail(contact.email);
  }
  const contactId = contact?._id || contact;
  if (contactId) {
    const person = await People.findOne({
      _id: contactId,
      organizationId: purchaseReturn.organizationId
    })
      .select('email')
      .lean();
    if (person?.email) return normalizeEmail(person.email);
  }

  const vendorId = purchaseReturn?.vendorId?._id || purchaseReturn?.vendorId;
  if (vendorId) {
    const org =
      purchaseReturn.vendorId && typeof purchaseReturn.vendorId === 'object'
        ? purchaseReturn.vendorId
        : await Organization.findOne({ _id: vendorId, deletedAt: null })
            .select('email name')
            .lean();
    if (org?.email) return normalizeEmail(org.email);
  }
  return null;
}

function buildDefaultSubject(pr) {
  const number = pr.purchaseReturnNumber || 'PR';
  const subject = pr.subject ? ` — ${pr.subject}` : '';
  return `Purchase Return ${number}${subject}`;
}

function buildEmailHtml({ pr, message, vendorName }) {
  const greeting = vendorName ? `Hello ${vendorName},` : 'Hello,';
  const bodyText =
    String(message || '').trim() ||
    'Please find our purchase return details below. Reply if you have any questions.';
  const grandTotal = Number(pr.grandTotal);
  const currency = pr.currency || '';
  const totalLine =
    Number.isFinite(grandTotal)
      ? `<p style="margin:16px 0;font-size:15px;"><strong>Return total:</strong> ${grandTotal.toFixed(2)} ${currency}</p>`
      : '';
  const meta = [
    pr.purchaseReturnNumber ? `<strong>PR #:</strong> ${pr.purchaseReturnNumber}` : '',
    pr.subject ? `<strong>Subject:</strong> ${pr.subject}` : '',
    pr.returnDate
      ? `<strong>Return date:</strong> ${new Date(pr.returnDate).toLocaleDateString()}`
      : '',
    pr.returnReason ? `<strong>Reason:</strong> ${pr.returnReason}` : ''
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

async function tryRenderPrPdf({ organizationId, recordId, userId }) {
  try {
    const ContentTemplate = require('../models/ContentTemplate');
    const { renderTemplate } = require('./contentPlatform/contentRenderService');

    let template = null;
    try {
      const { resolveModuleDocumentTemplate } = require('./contentPlatform/moduleDocumentRenderService');
      template = await resolveModuleDocumentTemplate({
        organizationId,
        moduleKey: 'purchase_returns'
      });
    } catch {
      template = await ContentTemplate.findOne({
        organizationId,
        purpose: 'purchase_return',
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
        recordModuleKey: 'purchase_returns',
        recordId: String(recordId)
      }
    });
    if (result?.buffer && Buffer.isBuffer(result.buffer)) return result.buffer;
    return null;
  } catch (err) {
    console.warn('[purchaseReturnEmail] PDF attachment skipped:', err?.message);
    return null;
  }
}

async function sendPurchaseReturnEmail({ organizationId, purchaseReturnId, userId, body = {}, req }) {
  const { purchaseReturn } = await getPurchaseReturn({ organizationId, id: purchaseReturnId });
  if (!purchaseReturn) {
    const err = new Error('Purchase return not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const status = String(purchaseReturn.status || '').toLowerCase();
  if (!EMAILABLE_STATUSES.has(status) || status === PR_STATUSES.CANCELLED) {
    const err = new Error(`Purchase return cannot be emailed in status "${status}"`);
    err.code = 'PR_NOT_EMAILABLE';
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

  const recipient = await resolveRecipientEmail({ purchaseReturn, to: body.to });
  if (!recipient) {
    const err = new Error(
      'Recipient email is required. Enter a vendor email or set a vendor contact with email.'
    );
    err.code = 'MISSING_RECIPIENT';
    throw err;
  }

  const vendorName =
    purchaseReturn.vendorId && typeof purchaseReturn.vendorId === 'object'
      ? purchaseReturn.vendorId.name
      : '';

  const subject = String(body.subject || '').trim() || buildDefaultSubject(purchaseReturn);
  const html = buildEmailHtml({
    pr: purchaseReturn,
    message: body.message,
    vendorName
  });
  const text =
    String(body.message || '').trim() ||
    `Purchase Return ${purchaseReturn.purchaseReturnNumber || ''}`.trim();

  const attachments = [];
  const attachPdf = body.attachPdf !== false;
  if (attachPdf) {
    const pdf = await tryRenderPrPdf({
      organizationId,
      recordId: purchaseReturn._id,
      userId
    });
    if (pdf) {
      attachments.push({
        filename: `${safeFilePart(purchaseReturn.purchaseReturnNumber)}.pdf`,
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
    purchaseReturn,
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
  sendPurchaseReturnEmail,
  EMAILABLE_STATUSES
};
