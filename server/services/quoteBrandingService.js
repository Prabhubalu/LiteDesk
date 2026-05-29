/**
 * Tenant branding for quote PDFs and customer emails.
 */

const fs = require('node:fs');
const path = require('node:path');
const Organization = require('../models/Organization');
const { uploadsDir } = require('../middleware/uploadMiddleware');
const {
  normalizeQuoteOrgSettings,
  sanitizeBrandColor
} = require('./quoteOrgSettingsService');

const DEFAULT_BRAND_COLOR = '#4f46e5';
const PDF_LOGO_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);

/**
 * Resolve tenant upload logo URL to a local file path for PDF embedding.
 * @param {string|null} logoUrl
 * @param {string|import('mongoose').Types.ObjectId} organizationId
 * @returns {string|null}
 */
function resolveUploadLogoPath(logoUrl, organizationId) {
  if (!logoUrl || !organizationId) return null;
  const url = String(logoUrl).trim().split('?')[0];
  const orgId = String(organizationId);
  const prefix = `/api/uploads/${orgId}/`;
  if (!url.startsWith(prefix)) return null;
  const filename = url.slice(prefix.length);
  if (!filename || filename.includes('..') || filename.includes('/')) return null;
  const ext = path.extname(filename).toLowerCase();
  if (!PDF_LOGO_EXTENSIONS.has(ext)) return null;
  const filePath = path.join(uploadsDir, orgId, filename);
  if (!fs.existsSync(filePath)) return null;
  return filePath;
}

/**
 * @param {string|import('mongoose').Types.ObjectId} organizationId
 */
async function getQuoteBranding(organizationId) {
  if (!organizationId) {
    return {
      companyName: 'Company',
      logoUrl: null,
      logoPath: null,
      brandColor: DEFAULT_BRAND_COLOR,
      pdfFooterText: '',
      emailSignature: '',
      documentTitle: 'Quote'
    };
  }

  const org = await Organization.findById(organizationId)
    .select('name settings.logoUrl settings.primaryColor settings.quotes')
    .lean();

  const quotes = normalizeQuoteOrgSettings(org?.settings?.quotes);
  const brandColor =
    sanitizeBrandColor(quotes.brandColor) ||
    sanitizeBrandColor(org?.settings?.primaryColor) ||
    DEFAULT_BRAND_COLOR;

  const documentTitle = String(quotes.documentTitle || '').trim() || 'Quote';

  const logoUrl = org?.settings?.logoUrl || null;
  const logoPath = resolveUploadLogoPath(logoUrl, organizationId);

  return {
    companyName: String(org?.name || '').trim() || 'Company',
    logoUrl,
    logoPath,
    brandColor,
    pdfFooterText: quotes.pdfFooterText || '',
    emailSignature: quotes.emailSignature || '',
    documentTitle
  };
}

module.exports = {
  DEFAULT_BRAND_COLOR,
  resolveUploadLogoPath,
  getQuoteBranding
};
