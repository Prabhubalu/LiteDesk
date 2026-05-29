/**
 * Organization-level quote policy (tenant settings).
 */

const Organization = require('../models/Organization');

const DEFAULT_CUSTOMER_AGREEMENT_TEXT =
  'I agree to the pricing and terms shown in this quote.';

function sanitizeBrandColor(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const hex = raw.startsWith('#') ? raw : `#${raw}`;
  if (/^#[0-9A-Fa-f]{6}$/.test(hex)) return hex;
  return '';
}

const DEFAULT_QUOTE_ORG_SETTINGS = {
  requireApprovalBeforeSend: false,
  requireCustomerAgreement: false,
  requireTypedSignature: false,
  customerAgreementText: '',
  pdfFooterText: '',
  emailSignature: '',
  brandColor: '',
  documentTitle: ''
};

function normalizeQuoteOrgSettings(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  return {
    requireApprovalBeforeSend: src.requireApprovalBeforeSend === true,
    requireCustomerAgreement: src.requireCustomerAgreement === true,
    requireTypedSignature: src.requireTypedSignature === true,
    customerAgreementText: String(src.customerAgreementText || '').trim().slice(0, 2000),
    pdfFooterText: String(src.pdfFooterText || '').trim().slice(0, 500),
    emailSignature: String(src.emailSignature || '').trim().slice(0, 2000),
    brandColor: sanitizeBrandColor(src.brandColor),
    documentTitle: String(src.documentTitle || '').trim().slice(0, 80)
  };
}

function quoteRequiresApprovalBeforeSend(quote, orgSettings) {
  if (quote?.approvalRequired === true) return true;
  if (orgSettings?.requireApprovalBeforeSend === true) return true;
  return false;
}

/**
 * Text shown on the public portal when agreement is required.
 * @param {{ requireCustomerAgreement?: boolean, customerAgreementText?: string }} orgSettings
 */
function getPortalCustomerAgreementText(orgSettings) {
  if (!orgSettings?.requireCustomerAgreement) return null;
  const custom = String(orgSettings.customerAgreementText || '').trim();
  return custom || DEFAULT_CUSTOMER_AGREEMENT_TEXT;
}

/**
 * @param {{ requireCustomerAgreement?: boolean }} orgSettings
 * @param {{ agreedToTerms?: boolean }} body
 */
function assertCustomerAgreementAccepted(orgSettings, body) {
  if (!orgSettings?.requireCustomerAgreement) return;
  if (body?.agreedToTerms !== true) {
    const err = new Error('You must agree to the terms before accepting this quote.');
    err.code = 'TERMS_REQUIRED';
    throw err;
  }
}

function normalizeSignatureText(body) {
  const raw = body?.signatureText ?? body?.signature ?? '';
  return String(raw || '').trim().slice(0, 200);
}

/**
 * @param {{ requireTypedSignature?: boolean }} orgSettings
 * @param {{ signatureText?: string, signature?: string }} body
 */
function assertTypedSignatureProvided(orgSettings, body) {
  if (!orgSettings?.requireTypedSignature) return null;
  const signatureText = normalizeSignatureText(body);
  if (signatureText.length < 2) {
    const err = new Error('Type your full name as your signature to accept this quote.');
    err.code = 'SIGNATURE_REQUIRED';
    throw err;
  }
  return signatureText;
}

/**
 * @param {string|import('mongoose').Types.ObjectId} organizationId
 * @returns {Promise<typeof DEFAULT_QUOTE_ORG_SETTINGS>}
 */
async function getQuoteOrgSettings(organizationId) {
  if (!organizationId) return { ...DEFAULT_QUOTE_ORG_SETTINGS };
  const org = await Organization.findById(organizationId).select('settings.quotes').lean();
  return normalizeQuoteOrgSettings(org?.settings?.quotes);
}

/**
 * @param {string|import('mongoose').Types.ObjectId} organizationId
 * @param {Partial<typeof DEFAULT_QUOTE_ORG_SETTINGS>} patch
 */
async function updateQuoteOrgSettings(organizationId, patch) {
  const current = await getQuoteOrgSettings(organizationId);
  const src = patch && typeof patch === 'object' ? patch : {};

  const next = normalizeQuoteOrgSettings({
    requireApprovalBeforeSend:
      src.requireApprovalBeforeSend !== undefined
        ? src.requireApprovalBeforeSend === true
        : current.requireApprovalBeforeSend,
    requireCustomerAgreement:
      src.requireCustomerAgreement !== undefined
        ? src.requireCustomerAgreement === true
        : current.requireCustomerAgreement,
    requireTypedSignature:
      src.requireTypedSignature !== undefined
        ? src.requireTypedSignature === true
        : current.requireTypedSignature,
    customerAgreementText:
      src.customerAgreementText !== undefined
        ? src.customerAgreementText
        : current.customerAgreementText,
    pdfFooterText:
      src.pdfFooterText !== undefined ? src.pdfFooterText : current.pdfFooterText,
    emailSignature:
      src.emailSignature !== undefined ? src.emailSignature : current.emailSignature,
    brandColor: src.brandColor !== undefined ? src.brandColor : current.brandColor,
    documentTitle:
      src.documentTitle !== undefined ? src.documentTitle : current.documentTitle
  });

  const org = await Organization.findByIdAndUpdate(
    organizationId,
    { $set: { 'settings.quotes': next } },
    { new: true }
  )
    .select('settings.quotes')
    .lean();

  if (!org) {
    const err = new Error('Organization not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  return normalizeQuoteOrgSettings(org.settings?.quotes);
}

module.exports = {
  DEFAULT_QUOTE_ORG_SETTINGS,
  DEFAULT_CUSTOMER_AGREEMENT_TEXT,
  sanitizeBrandColor,
  normalizeQuoteOrgSettings,
  quoteRequiresApprovalBeforeSend,
  getPortalCustomerAgreementText,
  assertCustomerAgreementAccepted,
  normalizeSignatureText,
  assertTypedSignatureProvided,
  getQuoteOrgSettings,
  updateQuoteOrgSettings
};
