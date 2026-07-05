/**
 * Tenant branding for quote PDFs and customer emails.
 */

const fs = require('node:fs');
const path = require('node:path');
const Organization = require('../models/Organization');
const fileStorage = require('./fileStorageService');
const {
  normalizeQuoteOrgSettings,
  sanitizeBrandColor
} = require('./quoteOrgSettingsService');

const DEFAULT_BRAND_COLOR = '#4f46e5';
const PDF_LOGO_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);

const uploadsDir = path.join(__dirname, '../uploads');

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
 * Resolve logo from OCI storage or legacy local upload for PDF embedding.
 * @returns {Promise<string|Buffer|null>}
 */
async function resolveUploadLogoSource(logoUrl, organizationId) {
  if (!logoUrl || !organizationId) return null;

  const localPath = resolveUploadLogoPath(logoUrl, organizationId);
  if (localPath) return localPath;

  const parsed = fileStorage.parseStoragePath(logoUrl);
  if (!parsed) return null;

  if (parsed.driver === 'oci') {
    const ext = path.extname(parsed.key).toLowerCase();
    if (!PDF_LOGO_EXTENSIONS.has(ext)) return null;
    try {
      return await fileStorage.getObjectBuffer(`${fileStorage.OCI_PREFIX}${parsed.key}`);
    } catch {
      return null;
    }
  }

  const legacyPath = fileStorage.resolveLegacyLocalPath(logoUrl);
  if (!legacyPath) return null;
  const ext = path.extname(legacyPath).toLowerCase();
  if (!PDF_LOGO_EXTENSIONS.has(ext)) return null;
  return legacyPath;
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
  const logoPath = await resolveUploadLogoSource(logoUrl, organizationId);

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
  resolveUploadLogoSource,
  getQuoteBranding
};
