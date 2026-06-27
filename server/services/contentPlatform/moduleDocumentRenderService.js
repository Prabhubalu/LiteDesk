'use strict';

const crypto = require('crypto');
const ContentTemplate = require('../../models/ContentTemplate');
const { MODULE_DOCUMENT_CONFIG, getModuleRenderMode, getModuleTemplateOverride } = require('../../constants/contentPlatformIntegration');
const { renderTemplate } = require('./contentRenderService');

function notDeletedFilter() {
  return { deletedAt: null };
}

function computeChecksum(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function logShadowMismatch(moduleKey, context, legacyChecksum, platformChecksum, error = null) {
  const payload = {
    moduleKey,
    ...context,
    legacyChecksum,
    platformChecksum,
    match: legacyChecksum === platformChecksum
  };
  if (error) payload.platformError = error.message || String(error);
  console.warn('[content-platform][shadow]', payload);
}

/**
 * Resolve the platform template for a commercial document module.
 * @param {object} params
 * @param {string} params.organizationId
 * @param {string} params.moduleKey
 * @param {string | null} [params.templateId]
 */
async function resolveModuleDocumentTemplate({ organizationId, moduleKey, templateId = null }) {
  const config = MODULE_DOCUMENT_CONFIG[moduleKey];
  if (!config) {
    throw new Error(`Unsupported module for content platform render: ${moduleKey}`);
  }

  const explicitId = templateId || getModuleTemplateOverride(moduleKey);
  if (explicitId) {
    const explicit = await ContentTemplate.findOne({
      _id: explicitId,
      organizationId,
      ...notDeletedFilter()
    }).lean();
    if (explicit) return explicit;
  }

  const publishedDefault = await ContentTemplate.findOne({
    organizationId,
    moduleScope: config.moduleScope,
    purpose: config.purpose,
    isDefault: true,
    status: 'published',
    ...notDeletedFilter()
  }).lean();
  if (publishedDefault) return publishedDefault;

  const publishedScoped = await ContentTemplate.findOne({
    organizationId,
    moduleScope: config.moduleScope,
    purpose: config.purpose,
    status: 'published',
    ...notDeletedFilter()
  })
    .sort({ isDefault: -1, updatedAt: -1 })
    .lean();
  if (publishedScoped) return publishedScoped;

  const seeded = await ContentTemplate.findOne({
    organizationId,
    tags: { $all: ['seed', config.seedKey] },
    ...notDeletedFilter()
  }).lean();
  if (seeded) return seeded;

  throw new Error(
    `No content template found for ${moduleKey}. Run: node server/scripts/seedContentTemplates.js <organizationId> --publish`
  );
}

/**
 * Render a module record to PDF bytes via Content Platform (no output persistence).
 * @param {object} params
 * @param {string} params.organizationId
 * @param {string} params.moduleKey
 * @param {string} params.recordId
 * @param {string | null} [params.userId]
 * @param {string | null} [params.templateId]
 * @param {boolean} [params.preview]
 */
async function renderModuleDocumentPdfBuffer({
  organizationId,
  moduleKey,
  recordId,
  userId = null,
  templateId = null,
  preview = false
}) {
  const config = MODULE_DOCUMENT_CONFIG[moduleKey];
  const template = await resolveModuleDocumentTemplate({ organizationId, moduleKey, templateId });

  const result = await renderTemplate({
    organizationId,
    templateId: template._id,
    userId,
    outputFormat: 'pdf',
    preview,
    persistOutput: false,
    runtimeContext: {
      recordModuleKey: config.moduleScope,
      recordId: String(recordId)
    }
  });

  if (!result?.buffer || !Buffer.isBuffer(result.buffer)) {
    throw new Error('Content platform render did not return a PDF buffer');
  }

  return {
    buffer: result.buffer,
    checksum: result.checksum || computeChecksum(result.buffer),
    templateId: template._id,
    templateVersion: result.templateVersion
  };
}

/**
 * @param {object} params
 * @param {string} params.moduleKey
 * @param {string} params.organizationId
 * @param {string | null} [params.userId]
 * @param {string} params.recordId
 * @param {string | null} [params.templateId]
 * @param {() => Promise<Buffer>} params.renderLegacy
 * @param {Record<string, unknown>} [params.logContext]
 */
async function renderModuleDocumentWithMode({
  moduleKey,
  organizationId,
  userId = null,
  recordId,
  templateId = null,
  renderLegacy,
  logContext = {}
}) {
  const mode = getModuleRenderMode(moduleKey);

  if (mode === 'legacy') {
    return renderLegacy();
  }

  const context = { organizationId, recordId, ...logContext };

  if (mode === 'platform') {
    try {
      const platform = await renderModuleDocumentPdfBuffer({
        organizationId,
        moduleKey,
        recordId,
        userId,
        templateId
      });
      return platform.buffer;
    } catch (error) {
      console.error(`[content-platform][${moduleKey}] platform render failed; falling back to legacy`, error);
      return renderLegacy();
    }
  }

  // shadow — run platform alongside legacy; return legacy until parity proven
  const legacyPromise = renderLegacy();
  const platformPromise = renderModuleDocumentPdfBuffer({
    organizationId,
    moduleKey,
    recordId,
    userId,
    templateId
  }).catch((error) => ({ error }));

  const [legacyBuffer, platformResult] = await Promise.all([legacyPromise, platformPromise]);

  if (platformResult?.error) {
    const legacyChecksum = computeChecksum(legacyBuffer);
    logShadowMismatch(moduleKey, context, legacyChecksum, null, platformResult.error);
    void persistShadowParityFromRender({
      organizationId,
      moduleKey,
      recordId,
      logContext,
      legacyBuffer,
      platformError: platformResult.error,
      userId
    });
    return legacyBuffer;
  }

  const legacyChecksum = computeChecksum(legacyBuffer);
  logShadowMismatch(
    moduleKey,
    context,
    legacyChecksum,
    platformResult.checksum
  );
  void persistShadowParityFromRender({
    organizationId,
    moduleKey,
    recordId,
    logContext,
    legacyBuffer,
    platformBuffer: platformResult.buffer,
    templateId: platformResult.templateId,
    templateVersion: platformResult.templateVersion,
    userId
  });

  return legacyBuffer;
}

function persistShadowParityFromRender({
  organizationId,
  moduleKey,
  recordId,
  logContext,
  legacyBuffer,
  platformBuffer = null,
  platformError = null,
  templateId = null,
  templateVersion = null,
  userId = null
}) {
  const { buildParityResult, persistShadowParityResult } = require('./contentPlatformShadowParityService');
  const recordLabel =
    logContext?.quoteNumber ||
    logContext?.invoiceNumber ||
    null;

  const result = buildParityResult({
    moduleKey,
    recordId,
    recordLabel,
    legacyBuffer,
    platformBuffer,
    platformError,
    templateId,
    templateVersion
  });

  return persistShadowParityResult({
    organizationId,
    result,
    userId,
    source: 'shadow_render'
  }).catch((error) => {
    console.error('[content-platform][shadow] failed to persist parity result', error);
  });
}

/**
 * @param {object} params
 * @param {string} params.organizationId
 * @param {string | null} [params.userId]
 * @param {object} params.quote
 * @param {Array} [params.lines]
 * @param {Array} [params.sections]
 * @param {string | null} [params.watermark]
 * @param {object | null} [params.branding]
 * @param {string | null} [params.templateId]
 */
async function renderQuoteDocumentPdf(params) {
  const {
    organizationId,
    userId = null,
    quote,
    lines = [],
    sections = [],
    watermark = null,
    branding = null,
    templateId = null
  } = params;

  const orgId = String(organizationId || quote?.organizationId || '').trim();
  const recordId = String(quote?._id || '').trim();
  if (!orgId || !recordId) {
    throw new Error('organizationId and quote._id are required to render quote PDF');
  }

  return renderModuleDocumentWithMode({
    moduleKey: 'quotes',
    organizationId: orgId,
    userId,
    recordId,
    templateId,
    logContext: { quoteNumber: quote?.quoteNumber || null },
    renderLegacy: () => {
      const { renderQuotePdfLegacy } = require('../../controllers/quoteDocumentController');
      return renderQuotePdfLegacy({ quote, lines, sections, watermark, branding });
    }
  });
}

/**
 * @param {object} params
 * @param {string} params.organizationId
 * @param {string | null} [params.userId]
 * @param {object} params.invoice
 * @param {Array} [params.lines]
 * @param {Array} [params.sections]
 * @param {object | null} [params.sourceInvoice]
 * @param {string | null} [params.watermark]
 * @param {object | null} [params.branding]
 * @param {string | null} [params.templateId]
 */
async function renderInvoiceDocumentPdf(params) {
  const {
    organizationId,
    userId = null,
    invoice,
    lines = [],
    sections = [],
    sourceInvoice = null,
    watermark = null,
    branding = null,
    templateId = null
  } = params;

  const orgId = String(organizationId || invoice?.organizationId || '').trim();
  const recordId = String(invoice?._id || '').trim();
  if (!orgId || !recordId) {
    throw new Error('organizationId and invoice._id are required to render invoice PDF');
  }

  return renderModuleDocumentWithMode({
    moduleKey: 'invoices',
    organizationId: orgId,
    userId,
    recordId,
    templateId,
    logContext: { invoiceNumber: invoice?.invoiceNumber || invoice?.invoiceId || null },
    renderLegacy: () => {
      const { renderInvoicePdfLegacy } = require('../../controllers/invoiceDocumentController');
      return renderInvoicePdfLegacy({
        invoice,
        lines,
        sections,
        sourceInvoice,
        watermark,
        branding
      });
    }
  });
}

module.exports = {
  resolveModuleDocumentTemplate,
  renderModuleDocumentPdfBuffer,
  renderModuleDocumentWithMode,
  renderQuoteDocumentPdf,
  renderInvoiceDocumentPdf,
  computeChecksum
};
