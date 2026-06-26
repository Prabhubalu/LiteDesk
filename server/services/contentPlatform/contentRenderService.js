'use strict';

const crypto = require('crypto');
const ContentTemplate = require('../../models/ContentTemplate');
const ContentTemplateVersion = require('../../models/ContentTemplateVersion');
const ContentTheme = require('../../models/ContentTheme');
const ContentRenderOutput = require('../../models/ContentRenderOutput');
const fileStorage = require('../fileStorageService');
const {
  CONTENT_PLATFORM_ERROR_CODES,
  ContentPlatformError
} = require('../../utils/contentPlatformErrors');
const { assertValidTemplateDefinition } = require('./contentTemplateValidationService');
const { assembleRuntimeContext, RECORD_LOADERS } = require('./engines/dataProviderEngine');
const { resolveComponentTree } = require('./engines/componentResolver');
const { normalizeDefinitionMergeTokens } = require('./engines/definitionMergeTokenNormalizer');
const { buildLayoutTree } = require('./engines/layoutTreeBuilder');
const { resolvePageConfig } = require('./engines/layoutEngine');
const { renderLayoutTreeToHtml } = require('./renderers/htmlRenderer');
const { renderHtmlToPdf } = require('./renderers/puppeteerPdfRenderer');
const {
  CONTENT_PLATFORM_EVENT_TYPES,
  emitContentPlatformEvent,
  writeContentAuditLog
} = require('./contentPlatformEventService');

function notDeletedFilter() {
  return { deletedAt: null };
}

function computeChecksum(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function resolveTemplateVersion({ organizationId, template, preview = false }) {
  if (preview && template.draftVersionId) {
    const draft = await ContentTemplateVersion.findOne({
      _id: template.draftVersionId,
      organizationId,
      templateId: template._id
    }).lean();
    if (draft) return draft;
  }

  const publishedVersionNumber = template.latestPublishedVersion;
  if (publishedVersionNumber) {
    const published = await ContentTemplateVersion.findOne({
      organizationId,
      templateId: template._id,
      version: publishedVersionNumber,
      published: true
    }).lean();
    if (published) return published;
  }

  if (template.draftVersionId) {
    const draft = await ContentTemplateVersion.findOne({
      _id: template.draftVersionId,
      organizationId,
      templateId: template._id
    }).lean();
    if (draft) return draft;
  }

  throw new ContentPlatformError(
    CONTENT_PLATFORM_ERROR_CODES.NOT_FOUND,
    'No template version available to render',
    { statusCode: 404 }
  );
}

async function resolveTheme({ organizationId, template }) {
  if (!template.defaultThemeId) return {};
  const theme = await ContentTheme.findOne({
    _id: template.defaultThemeId,
    organizationId,
    deletedAt: null
  }).lean();
  return theme || {};
}

/**
 * @param {object} params
 */
async function renderTemplate(params) {
  const {
    organizationId,
    templateId,
    userId = null,
    outputFormat = 'pdf',
    preview = false,
    runtimeContext = {},
    jsonDefinition = null,
    pageSettings = null,
    persistOutput = true,
    ipAddress = null
  } = params;

  const template = await ContentTemplate.findOne({
    _id: templateId,
    organizationId,
    ...notDeletedFilter()
  }).lean();

  if (!template) {
    throw new ContentPlatformError(
      CONTENT_PLATFORM_ERROR_CODES.NOT_FOUND,
      'Template not found',
      { statusCode: 404 }
    );
  }

  const version = jsonDefinition
    ? { version: template.latestVersion || 1, jsonDefinition }
    : await resolveTemplateVersion({
        organizationId,
        template,
        preview
      });

  if (jsonDefinition) {
    assertValidTemplateDefinition(jsonDefinition);
  }

  emitContentPlatformEvent(CONTENT_PLATFORM_EVENT_TYPES.RENDER_REQUESTED, {
    entityType: 'content_template',
    entityId: templateId,
    organizationId,
    triggeredBy: userId,
    currentState: {
      templateId,
      templateVersion: version.version,
      outputFormat,
      preview
    }
  });

  const scope = await assembleRuntimeContext({
    organizationId,
    userId,
    moduleScope: template.moduleScope,
    preview,
    runtimeContext: {
      ...runtimeContext,
      usePreviewSample: preview
        && !runtimeContext.recordId
        && !runtimeContext.record
    }
  });

  const recordModuleKey = String(
    runtimeContext.recordModuleKey || template.moduleScope || ''
  ).toLowerCase();

  if (
    runtimeContext.recordId
    && RECORD_LOADERS[recordModuleKey]
    && !scope.recordLoadSucceeded
  ) {
    throw new ContentPlatformError(
      CONTENT_PLATFORM_ERROR_CODES.NOT_FOUND,
      `${recordModuleKey.replace(/s$/, '')} record not found`,
      {
        statusCode: 404,
        details: [{
          path: 'runtimeContext.recordId',
          message: `No ${recordModuleKey} record matches ${runtimeContext.recordId}`
        }]
      }
    );
  }

  const normalizedFormat = String(outputFormat || 'pdf').toLowerCase();
  const lenientMergeTags = preview || (normalizedFormat === 'html' && persistOutput === false);

  const definitionForRender = normalizeDefinitionMergeTokens(version.jsonDefinition);

  const { root, issues } = resolveComponentTree(definitionForRender, scope, {
    lenient: lenientMergeTags
  });
  const blockingIssues = lenientMergeTags
    ? []
    : issues.filter((issue) => issue.severity === 'error');
  if (blockingIssues.length) {
    emitContentPlatformEvent(CONTENT_PLATFORM_EVENT_TYPES.RENDER_FAILED, {
      entityType: 'content_template',
      entityId: templateId,
      organizationId,
      triggeredBy: userId,
      currentState: { issues: blockingIssues }
    });

    throw new ContentPlatformError(
      CONTENT_PLATFORM_ERROR_CODES.VALIDATION_FAILED,
      'Render blocked by unresolved merge tags',
      { statusCode: 400, details: blockingIssues }
    );
  }

  const theme = await resolveTheme({ organizationId, template });
  const templateForLayout = pageSettings && typeof pageSettings === 'object'
    ? { ...template, ...pageSettings }
    : template;
  const layoutTree = buildLayoutTree({
    template: templateForLayout,
    resolvedRoot: root,
    theme
  });
  const html = renderLayoutTreeToHtml(layoutTree);

  let buffer = null;
  let mimeType = 'text/html';

  if (normalizedFormat === 'html' && persistOutput === false) {
    return {
      templateId,
      templateVersion: version.version,
      outputFormat: 'html',
      checksum: null,
      mimeType: 'text/html',
      html,
      issues,
      inline: true
    };
  }

  if (normalizedFormat === 'pdf') {
    const pageConfig = resolvePageConfig(template);
    buffer = await renderHtmlToPdf(html, {
      paperSize: pageConfig.paperSize,
      orientation: pageConfig.orientation,
      dimensions: pageConfig.dimensions
    });
    mimeType = 'application/pdf';

    if (persistOutput === false) {
      return {
        templateId,
        templateVersion: version.version,
        outputFormat: 'pdf',
        checksum: computeChecksum(buffer),
        mimeType,
        buffer,
        fileSizeBytes: buffer.length,
        html,
        issues,
        inline: true
      };
    }
  } else if (normalizedFormat === 'html') {
    buffer = Buffer.from(html, 'utf8');
  } else {
    throw new ContentPlatformError(
      CONTENT_PLATFORM_ERROR_CODES.VALIDATION_FAILED,
      `Unsupported output format: ${outputFormat}`,
      { statusCode: 400 }
    );
  }

  const checksum = computeChecksum(buffer);
  const extension = normalizedFormat === 'pdf' ? 'pdf' : 'html';
  const fileName = `${sanitizeFilePart(template.name)}-v${version.version}.${extension}`;

  const upload = await fileStorage.uploadBuffer({
    buffer,
    originalName: fileName,
    mimeType,
    organizationId,
    category: 'content-templates',
    metadata: {
      templateId: String(templateId),
      templateVersion: String(version.version)
    }
  });

  const output = await ContentRenderOutput.create({
    organizationId,
    templateId,
    templateVersion: version.version,
    outputFormat: normalizedFormat,
    checksum,
    mimeType,
    storageProvider: 'oci',
    storageKey: upload.storagePath,
    fileSizeBytes: buffer.length,
    generatedBy: userId,
    generatedAt: new Date()
  });

  await writeContentAuditLog({
    organizationId,
    action: 'render.completed',
    entityType: 'content_render_output',
    entityId: output._id,
    userId,
    metadata: {
      templateId,
      templateVersion: version.version,
      outputFormat: normalizedFormat,
      checksum
    },
    ipAddress
  });

  emitContentPlatformEvent(CONTENT_PLATFORM_EVENT_TYPES.RENDER_COMPLETED, {
    entityType: 'content_template',
    entityId: templateId,
    organizationId,
    triggeredBy: userId,
    currentState: {
      outputId: output._id,
      templateVersion: version.version,
      outputFormat: normalizedFormat,
      checksum
    }
  });

  return {
    outputId: output._id,
    templateId,
    templateVersion: version.version,
    outputFormat: normalizedFormat,
    checksum,
    mimeType,
    fileSizeBytes: buffer.length,
    storageKey: upload.storagePath,
    downloadUrl: upload.downloadUrl,
    previewUrl: upload.url,
    html: normalizedFormat === 'html' ? html : undefined,
    issues
  };
}

function sanitizeFilePart(value) {
  return String(value || 'template')
    .trim()
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80) || 'template';
}

module.exports = {
  renderTemplate,
  computeChecksum
};
