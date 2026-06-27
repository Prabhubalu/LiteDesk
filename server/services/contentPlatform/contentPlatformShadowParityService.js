'use strict';

const mongoose = require('mongoose');
const Quote = require('../../models/Quote');
const QuoteLine = require('../../models/QuoteLine');
const Invoice = require('../../models/Invoice');
const InvoiceLine = require('../../models/InvoiceLine');
const ContentAuditLog = require('../../models/ContentAuditLog');
const { MODULE_DOCUMENT_CONFIG, getModuleRenderMode } = require('../../constants/contentPlatformIntegration');
const {
  CONTENT_PLATFORM_ERROR_CODES,
  ContentPlatformError
} = require('../../utils/contentPlatformErrors');
const { listQuoteSections } = require('../quoteSectionService');
const { listInvoiceSections } = require('../invoiceSectionService');
const { getQuoteBranding } = require('../quoteBrandingService');
const { getInvoiceBranding } = require('../invoiceBrandingService');
const {
  renderModuleDocumentPdfBuffer,
  computeChecksum
} = require('./moduleDocumentRenderService');

const SUPPORTED_MODULE_KEYS = new Set(Object.keys(MODULE_DOCUMENT_CONFIG));
const SHADOW_PARITY_ACTIONS = ['document.shadow_parity', 'document.shadow_parity_error'];

/**
 * @param {string} moduleKey
 */
function assertSupportedModuleKey(moduleKey) {
  const key = String(moduleKey || '').trim().toLowerCase();
  if (!SUPPORTED_MODULE_KEYS.has(key)) {
    throw new ContentPlatformError(
      CONTENT_PLATFORM_ERROR_CODES.VALIDATION_FAILED,
      `Unsupported module key: ${moduleKey}`,
      { statusCode: 400 }
    );
  }
  return key;
}

/**
 * @param {object} params
 */
function buildParityResult(params) {
  const {
    moduleKey,
    recordId,
    recordLabel = null,
    legacyBuffer,
    platformBuffer = null,
    platformError = null,
    templateId = null,
    templateVersion = null
  } = params;

  const legacyChecksum = computeChecksum(legacyBuffer);
  const platformChecksum = platformBuffer ? computeChecksum(platformBuffer) : null;
  const match = platformBuffer ? legacyChecksum === platformChecksum : false;

  return {
    moduleKey,
    recordId: String(recordId),
    recordLabel,
    match,
    legacyChecksum,
    platformChecksum,
    legacySizeBytes: legacyBuffer.length,
    platformSizeBytes: platformBuffer?.length ?? null,
    templateId: templateId ? String(templateId) : null,
    templateVersion: templateVersion ?? null,
    platformError: platformError ? String(platformError.message || platformError) : null
  };
}

/**
 * @param {object} params
 */
async function persistShadowParityResult({
  organizationId,
  result,
  userId = null,
  ipAddress = null,
  source = 'shadow_render'
}) {
  if (!result?.recordId || !mongoose.Types.ObjectId.isValid(result.recordId)) {
    return null;
  }

  const action = result.platformError ? 'document.shadow_parity_error' : 'document.shadow_parity';
  const row = await ContentAuditLog.create({
    organizationId,
    action,
    entityType: result.moduleKey,
    entityId: result.recordId,
    userId,
    metadata: {
      source,
      ...result
    },
    ipAddress
  });

  return row;
}

async function loadQuoteDocumentContext({ organizationId, recordId }) {
  const quote = await Quote.findOne({ _id: recordId, organizationId })
    .populate({ path: 'ownerId', select: 'firstName lastName email username' })
    .populate({ path: 'organizationRefId', select: 'name' })
    .populate({ path: 'contactId', select: 'first_name last_name email phone mobile' })
    .lean();

  if (!quote) {
    throw new ContentPlatformError(
      CONTENT_PLATFORM_ERROR_CODES.NOT_FOUND,
      'Quote not found',
      { statusCode: 404 }
    );
  }

  const [lines, sections, branding] = await Promise.all([
    QuoteLine.find({ organizationId, quoteId: quote._id }).sort({ lineOrder: 1, createdAt: 1 }).lean(),
    listQuoteSections({ organizationId, quoteId: quote._id }),
    getQuoteBranding(organizationId)
  ]);

  const watermark =
    String(quote.customerShareMode || '').toLowerCase() === 'draft' ||
    ['Draft', 'Pending Approval'].includes(String(quote.status || ''))
      ? 'DRAFT'
      : null;

  return { quote, lines, sections, watermark, branding };
}

async function loadInvoiceDocumentContext({ organizationId, recordId }) {
  const invoiceDoc =
    (await Invoice.findOne({ organizationId, invoiceId: recordId, deletedAt: null })
      .populate({ path: 'ownerId', select: 'firstName lastName email username' })
      .populate({ path: 'organizationRefId', select: 'name' })
      .populate({ path: 'contactId', select: 'first_name last_name email phone mobile' })) ||
    (await Invoice.findOne({ organizationId, _id: recordId, deletedAt: null })
      .populate({ path: 'ownerId', select: 'firstName lastName email username' })
      .populate({ path: 'organizationRefId', select: 'name' })
      .populate({ path: 'contactId', select: 'first_name last_name email phone mobile' }));

  if (!invoiceDoc) {
    throw new ContentPlatformError(
      CONTENT_PLATFORM_ERROR_CODES.NOT_FOUND,
      'Invoice not found',
      { statusCode: 404 }
    );
  }

  const invoice = invoiceDoc.toObject ? invoiceDoc.toObject() : invoiceDoc;
  const isCreditNote = String(invoice.invoiceType || 'standard') === 'credit_note';

  const [lines, sections, sourceInvoice, branding] = await Promise.all([
    InvoiceLine.find({ organizationId, invoiceId: invoice._id }).sort({ lineOrder: 1, createdAt: 1 }).lean(),
    listInvoiceSections({ organizationId, invoiceId: invoice._id }),
    isCreditNote && invoice.sourceInvoiceId
      ? Invoice.findOne({ organizationId, invoiceId: invoice.sourceInvoiceId, deletedAt: null })
          .select('invoiceId invoiceNumber status grandTotal postedAt')
          .lean()
      : Promise.resolve(null),
    getInvoiceBranding(organizationId, { invoiceType: invoice.invoiceType })
  ]);

  const { resolveInvoiceWatermark } = require('../../controllers/invoiceDocumentController');
  const watermark = resolveInvoiceWatermark(invoice);

  return { invoice, lines, sections, sourceInvoice, watermark, branding };
}

/**
 * @param {object} params
 */
async function compareModuleDocumentPdf({
  organizationId,
  moduleKey,
  recordId,
  userId = null,
  templateId = null,
  persist = true,
  ipAddress = null,
  source = 'manual_compare'
}) {
  const key = assertSupportedModuleKey(moduleKey);
  const normalizedRecordId = String(recordId || '').trim();
  if (!normalizedRecordId) {
    throw new ContentPlatformError(
      CONTENT_PLATFORM_ERROR_CODES.VALIDATION_FAILED,
      'recordId is required',
      { statusCode: 400 }
    );
  }

  let result;

  if (key === 'quotes') {
    const { quote, lines, sections, watermark, branding } = await loadQuoteDocumentContext({
      organizationId,
      recordId: normalizedRecordId
    });
    const { renderQuotePdfLegacy } = require('../../controllers/quoteDocumentController');
    const legacyBuffer = await renderQuotePdfLegacy({ quote, lines, sections, watermark, branding });

    try {
      const platform = await renderModuleDocumentPdfBuffer({
        organizationId,
        moduleKey: key,
        recordId: String(quote._id),
        userId,
        templateId
      });
      result = buildParityResult({
        moduleKey: key,
        recordId: quote._id,
        recordLabel: quote.quoteNumber || null,
        legacyBuffer,
        platformBuffer: platform.buffer,
        templateId: platform.templateId,
        templateVersion: platform.templateVersion
      });
    } catch (error) {
      result = buildParityResult({
        moduleKey: key,
        recordId: quote._id,
        recordLabel: quote.quoteNumber || null,
        legacyBuffer,
        platformError: error
      });
    }
  } else {
    const { invoice, lines, sections, sourceInvoice, watermark, branding } = await loadInvoiceDocumentContext({
      organizationId,
      recordId: normalizedRecordId
    });
    const { renderInvoicePdfLegacy } = require('../../controllers/invoiceDocumentController');
    const legacyBuffer = await renderInvoicePdfLegacy({
      invoice,
      lines,
      sections,
      sourceInvoice,
      watermark,
      branding
    });

    try {
      const platform = await renderModuleDocumentPdfBuffer({
        organizationId,
        moduleKey: key,
        recordId: String(invoice._id),
        userId,
        templateId
      });
      result = buildParityResult({
        moduleKey: key,
        recordId: invoice._id,
        recordLabel: invoice.invoiceNumber || invoice.invoiceId || null,
        legacyBuffer,
        platformBuffer: platform.buffer,
        templateId: platform.templateId,
        templateVersion: platform.templateVersion
      });
    } catch (error) {
      result = buildParityResult({
        moduleKey: key,
        recordId: invoice._id,
        recordLabel: invoice.invoiceNumber || invoice.invoiceId || null,
        legacyBuffer,
        platformError: error
      });
    }
  }

  if (persist) {
    await persistShadowParityResult({
      organizationId,
      result,
      userId,
      ipAddress,
      source
    });
  }

  return result;
}

/**
 * @param {object} params
 */
async function getShadowParitySummary({ organizationId, moduleKey, limit = 20 }) {
  const key = assertSupportedModuleKey(moduleKey);
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);

  const rows = await ContentAuditLog.find({
    organizationId,
    action: { $in: SHADOW_PARITY_ACTIONS },
    entityType: key
  })
    .sort({ createdAt: -1 })
    .limit(safeLimit)
    .lean();

  const recent = rows.map((row) => ({
    id: String(row._id),
    createdAt: row.createdAt,
    action: row.action,
    recordId: String(row.entityId),
    ...(row.metadata && typeof row.metadata === 'object' ? row.metadata : {})
  }));

  const matched = recent.filter((row) => row.match === true).length;
  const errors = recent.filter((row) => row.action === 'document.shadow_parity_error' || row.platformError).length;
  const mismatched = recent.filter((row) => !row.platformError && row.match === false).length;
  const total = recent.length;

  return {
    moduleKey: key,
    renderMode: getModuleRenderMode(key),
    summary: {
      total,
      matched,
      mismatched,
      errors,
      matchRate: total ? Math.round((matched / total) * 100) : null
    },
    recent
  };
}

/**
 * @param {object} params
 */
async function compareRecentModuleDocuments({
  organizationId,
  moduleKey,
  limit = 5,
  userId = null
}) {
  const key = assertSupportedModuleKey(moduleKey);
  const safeLimit = Math.min(Math.max(Number(limit) || 5, 1), 25);
  const results = [];

  if (key === 'quotes') {
    const quotes = await Quote.find({ organizationId })
      .sort({ updatedAt: -1 })
      .limit(safeLimit)
      .select('_id quoteNumber')
      .lean();

    for (const quote of quotes) {
      results.push(
        await compareModuleDocumentPdf({
          organizationId,
          moduleKey: key,
          recordId: String(quote._id),
          userId,
          persist: true,
          source: 'batch_compare'
        })
      );
    }
  } else {
    const invoices = await Invoice.find({ organizationId, deletedAt: null })
      .sort({ updatedAt: -1 })
      .limit(safeLimit)
      .select('_id invoiceNumber invoiceId')
      .lean();

    for (const invoice of invoices) {
      results.push(
        await compareModuleDocumentPdf({
          organizationId,
          moduleKey: key,
          recordId: String(invoice._id),
          userId,
          persist: true,
          source: 'batch_compare'
        })
      );
    }
  }

  const matched = results.filter((row) => row.match === true).length;
  const errors = results.filter((row) => row.platformError).length;
  const mismatched = results.filter((row) => !row.platformError && row.match === false).length;

  return {
    moduleKey: key,
    compared: results.length,
    matched,
    mismatched,
    errors,
    results
  };
}

module.exports = {
  SUPPORTED_MODULE_KEYS,
  assertSupportedModuleKey,
  buildParityResult,
  persistShadowParityResult,
  compareModuleDocumentPdf,
  getShadowParitySummary,
  compareRecentModuleDocuments
};
