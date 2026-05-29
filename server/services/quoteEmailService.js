const Quote = require('../models/Quote');
const QuoteLine = require('../models/QuoteLine');
const People = require('../models/People');
const emailService = require('./emailService');
const { renderQuotePdf, safeFilePart } = require('../controllers/quoteDocumentController');
const {
  assertCanTransitionQuoteStatus,
  assertCanSendQuoteToCustomer,
  resolveCustomerSendMode
} = require('../constants/quoteLifecycle');
const crypto = require('node:crypto');

function generatePublicToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function resolveClientBaseUrl(req) {
  const origin = req?.get?.('origin');
  if (origin && /^https?:\/\//i.test(origin)) {
    return String(origin).replace(/\/$/, '');
  }
  return String(process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
}

function buildPublicQuoteUrl(quote, req) {
  const base = resolveClientBaseUrl(req);
  const token = quote?.publicShareToken;
  if (!base || !token) return null;
  return `${base}/public/quotes/${token}`;
}

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

async function ensureQuoteDraftSharedForEmail(quote) {
  if (!quote.publicShareToken) {
    quote.publicShareToken = generatePublicToken();
  }
  quote.portalAccessEnabled = true;
  quote.customerShareMode = 'draft';
  quote.draftSharedAt = quote.draftSharedAt || new Date();
  await quote.save();
  return quote;
}

async function ensureQuoteFormalSharedForEmail(quote) {
  const fromStatus = quote.status;
  if (String(fromStatus) !== 'Sent') {
    assertCanTransitionQuoteStatus(fromStatus, 'Sent');
    quote.status = 'Sent';
  }
  if (!quote.publicShareToken) {
    quote.publicShareToken = generatePublicToken();
  }
  quote.sentToCustomer = true;
  if (!quote.sentAt) quote.sentAt = new Date();
  quote.portalAccessEnabled = true;
  quote.customerShareMode = 'formal';
  await quote.save();
  return quote;
}

async function resolveRecipientEmail({ quote, to }) {
  const explicit = normalizeEmail(to);
  if (explicit) return explicit;

  const contactId = quote?.contactId?._id || quote?.contactId;
  if (!contactId) return null;

  if (quote.contactId && typeof quote.contactId === 'object' && quote.contactId.email) {
    return normalizeEmail(quote.contactId.email);
  }

  const person = await People.findOne({ _id: contactId, organizationId: quote.organizationId })
    .select('email')
    .lean();
  return normalizeEmail(person?.email);
}

function buildDefaultSubject(quote, sendMode) {
  const number = quote.quoteNumber || 'Quote';
  const title = quote.quoteTitle ? ` — ${quote.quoteTitle}` : '';
  if (sendMode === 'draft') {
    return `Draft quote ${number}${title} (for review)`;
  }
  return `Quote ${number}${title}`;
}

function buildEmailLogoBlock(branding, clientBaseUrl) {
  const url = branding?.logoUrl;
  if (!url || !clientBaseUrl) return '';
  const src = String(url).startsWith('http') ? String(url) : `${clientBaseUrl}${url}`;
  return `<img src="${src}" alt="" style="max-height:52px;max-width:220px;margin-bottom:12px;display:block" />`;
}

function buildEmailHtml({ quote, message, publicUrl, sendMode, branding = null }) {
  const brand = branding && typeof branding === 'object' ? branding : {};
  const brandColor = String(brand.brandColor || '#4f46e5');
  const companyName = String(brand.companyName || '').trim();
  const emailSignature = String(brand.emailSignature || '').trim();
  const contactName =
    quote.contactId && typeof quote.contactId === 'object'
      ? [quote.contactId.first_name, quote.contactId.last_name].filter(Boolean).join(' ').trim()
      : '';
  const greeting = contactName ? `Hello ${contactName},` : 'Hello,';
  const isDraft = sendMode === 'draft';
  const bodyText =
    String(message || '').trim() ||
    (isDraft
      ? 'Please find a draft copy of your quote for review. This is not a final offer and cannot be accepted online.'
      : 'Please find your quote attached. You can review it online using the link below.');
  const grandTotal = Number(quote.grandTotal);
  const totalLine =
    Number.isFinite(grandTotal) && grandTotal > 0
      ? `<p style="margin:16px 0;font-size:15px;"><strong>Grand total:</strong> ${grandTotal.toFixed(2)} ${quote.currency || ''}</p>`
      : '';

  const draftBanner = isDraft
    ? `<p style="margin:12px 0;padding:12px 14px;background:#FEF3C7;border:1px solid #FCD34D;border-radius:8px;color:#92400E;font-size:14px;"><strong>Draft for discussion only</strong> — not a binding quote. Acceptance is not available until a final quote is issued.</p>`
    : '';

  const linkBlock = publicUrl
    ? `<p style="margin:20px 0;"><a href="${publicUrl}" style="display:inline-block;padding:10px 16px;background:${brandColor};color:#fff;text-decoration:none;border-radius:6px;">${isDraft ? 'View draft quote online' : 'View quote online'}</a></p><p style="font-size:12px;color:#6b7280;">Or copy this link: ${publicUrl}</p>`
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
      ${draftBanner}
      <p>${bodyText.replace(/\n/g, '<br>')}</p>
      ${totalLine}
      ${linkBlock}
      ${signatureBlock}
    </div>
  `.trim();
}

/**
 * Send quote by email (optional PDF + public link).
 * Draft send: stays Draft, watermarked PDF/portal, no accept.
 * Formal send: transitions to Sent, no watermark.
 */
async function sendQuoteEmail({ organizationId, quoteId, userId, body = {}, req }) {
  const quote = await Quote.findOne({ _id: quoteId, organizationId })
    .populate({ path: 'contactId', select: 'first_name last_name email' })
    .populate({ path: 'organizationRefId', select: 'name' });

  if (!quote) {
    const err = new Error('Quote not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const { getQuoteOrgSettings } = require('./quoteOrgSettingsService');
  const { getQuoteBranding } = require('./quoteBrandingService');
  const orgQuoteSettings = await getQuoteOrgSettings(organizationId);
  const branding = await getQuoteBranding(organizationId);
  branding.clientBaseUrl = resolveClientBaseUrl(req);
  assertCanSendQuoteToCustomer(quote, orgQuoteSettings);

  const configured = await emailService.isConfiguredForOrganization(organizationId);
  if (!configured) {
    const err = new Error('Email is not configured for this organization. Set up email in Settings → Integrations.');
    err.code = 'EMAIL_NOT_CONFIGURED';
    throw err;
  }

  const recipient = await resolveRecipientEmail({ quote, to: body.to });
  if (!recipient) {
    const err = new Error('Recipient email is required. Add a contact with an email or enter a recipient.');
    err.code = 'MISSING_RECIPIENT';
    throw err;
  }

  const attachPdf = body.attachPdf !== false;
  const includeLink = body.includeLink !== false;
  const sendMode = resolveCustomerSendMode(quote);

  if (includeLink) {
    if (sendMode === 'draft') {
      await ensureQuoteDraftSharedForEmail(quote);
    } else {
      await ensureQuoteFormalSharedForEmail(quote);
    }
  }

  const publicUrl = includeLink ? buildPublicQuoteUrl(quote, req) : null;
  const subject = String(body.subject || '').trim() || buildDefaultSubject(quote, sendMode);
  const html = buildEmailHtml({ quote, message: body.message, publicUrl, sendMode, branding });
  const defaultText =
    sendMode === 'draft'
      ? 'Draft quote for your review — not a final offer.'
      : 'Please find your quote attached.';
  const text = String(body.message || '').trim() || defaultText;

  const attachments = [];
  if (attachPdf) {
    const lines = await QuoteLine.find({ organizationId, quoteId: quote._id })
      .sort({ lineOrder: 1, createdAt: 1 })
      .lean();
    const orgQuote = quote.toObject ? quote.toObject() : quote;
    const pdf = await renderQuotePdf({
      quote: orgQuote,
      lines,
      watermark: sendMode === 'draft' ? 'DRAFT' : null,
      branding
    });
    const prefix = sendMode === 'draft' ? 'DRAFT-' : '';
    const filename = `${prefix}${safeFilePart(quote.quoteNumber)}-rev${quote.revisionNumber || 1}.pdf`;
    attachments.push({ filename, content: pdf });
  }

  const sendResult = await emailService.sendCrmEmail({
    organizationId,
    to: recipient,
    subject,
    text: publicUrl ? `${text}\n\nView online: ${publicUrl}` : text,
    html,
    attachments,
    replyTo: req?.user?.email || undefined
  });

  if (!sendResult?.success) {
    const err = new Error(sendResult?.error || 'Failed to send email');
    err.code = 'EMAIL_SEND_FAILED';
    throw err;
  }

  const refreshed = await Quote.findOne({ _id: quoteId, organizationId }).lean();

  return {
    quote: refreshed,
    sendMode,
    email: {
      to: recipient,
      subject,
      messageId: sendResult.messageId || null,
      provider: sendResult.provider || null,
      publicUrl
    }
  };
}

module.exports = {
  sendQuoteEmail,
  buildPublicQuoteUrl,
  resolveRecipientEmail,
  resolveCustomerSendMode
};
