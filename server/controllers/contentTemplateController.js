'use strict';

const contentTemplateService = require('../services/contentPlatform/contentTemplateService');
const { sendContentPlatformError } = require('../utils/contentPlatformErrors');

function getRequestContext(req) {
  return {
    organizationId: req.user.organizationId,
    userId: req.user._id,
    ipAddress: req.ip || null
  };
}

exports.listTemplateGallery = async (_req, res) => {
  try {
    const { SEED_TEMPLATES } = require('../constants/contentTemplateSeeds');
    const data = SEED_TEMPLATES.map((seed) => ({
      key: seed.key,
      name: seed.name,
      description: seed.description || '',
      purpose: seed.purpose,
      category: seed.category,
      moduleScope: seed.moduleScope,
      outputFormat: seed.outputFormat,
      paperSize: seed.paperSize || 'A4',
      orientation: seed.orientation || 'portrait',
      jsonDefinition: seed.jsonDefinition
    }));
    return res.json({ success: true, data });
  } catch (error) {
    return sendContentPlatformError(res, error, 'Failed to list template gallery');
  }
};

exports.getTemplateSummary = async (req, res) => {
  try {
    const ctx = getRequestContext(req);
    const summary = await contentTemplateService.getTemplateSummary({
      organizationId: ctx.organizationId
    });
    return res.json({ success: true, data: summary });
  } catch (error) {
    return sendContentPlatformError(res, error, 'Failed to load template summary');
  }
};

exports.listTemplates = async (req, res) => {
  try {
    const ctx = getRequestContext(req);
    const result = await contentTemplateService.listTemplates({
      organizationId: ctx.organizationId,
      page: req.query.page,
      limit: req.query.limit,
      status: req.query.status,
      moduleScope: req.query.moduleScope,
      outputFormat: req.query.outputFormat,
      category: req.query.category,
      purpose: req.query.purpose,
      search: req.query.search
    });
    return res.json({ success: true, data: result.items, pagination: result.pagination });
  } catch (error) {
    return sendContentPlatformError(res, error, 'Failed to list templates');
  }
};

exports.getTemplate = async (req, res) => {
  try {
    const ctx = getRequestContext(req);
    const template = await contentTemplateService.getTemplateById({
      organizationId: ctx.organizationId,
      templateId: req.params.id
    });
    return res.json({ success: true, data: template });
  } catch (error) {
    return sendContentPlatformError(res, error, 'Failed to get template');
  }
};

exports.createTemplate = async (req, res) => {
  try {
    const ctx = getRequestContext(req);
    if (!req.body?.name || typeof req.body.name !== 'string' || !req.body.name.trim()) {
      return res.status(400).json({
        success: false,
        code: 'CONTENT_VALIDATION_FAILED',
        message: 'Template name is required',
        details: [{ path: 'name', message: 'Required' }],
        traceId: null
      });
    }

    const template = await contentTemplateService.createTemplate({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      payload: req.body,
      ipAddress: ctx.ipAddress
    });
    return res.status(201).json({ success: true, data: template });
  } catch (error) {
    return sendContentPlatformError(res, error, 'Failed to create template');
  }
};

exports.updateTemplate = async (req, res) => {
  try {
    const ctx = getRequestContext(req);
    const template = await contentTemplateService.updateTemplate({
      organizationId: ctx.organizationId,
      templateId: req.params.id,
      userId: ctx.userId,
      payload: req.body,
      ipAddress: ctx.ipAddress
    });
    return res.json({ success: true, data: template });
  } catch (error) {
    return sendContentPlatformError(res, error, 'Failed to update template');
  }
};

exports.deleteTemplate = async (req, res) => {
  try {
    const ctx = getRequestContext(req);
    const result = await contentTemplateService.deleteTemplate({
      organizationId: ctx.organizationId,
      templateId: req.params.id,
      userId: ctx.userId,
      ipAddress: ctx.ipAddress
    });
    return res.json({ success: true, data: result });
  } catch (error) {
    return sendContentPlatformError(res, error, 'Failed to delete template');
  }
};

exports.cloneTemplate = async (req, res) => {
  try {
    const ctx = getRequestContext(req);
    const template = await contentTemplateService.cloneTemplate({
      organizationId: ctx.organizationId,
      templateId: req.params.id,
      userId: ctx.userId,
      name: req.body?.name,
      ipAddress: ctx.ipAddress
    });
    return res.status(201).json({ success: true, data: template });
  } catch (error) {
    return sendContentPlatformError(res, error, 'Failed to clone template');
  }
};

exports.publishTemplate = async (req, res) => {
  try {
    const ctx = getRequestContext(req);
    const result = await contentTemplateService.publishTemplate({
      organizationId: ctx.organizationId,
      templateId: req.params.id,
      userId: ctx.userId,
      releaseNotes: req.body?.releaseNotes || '',
      ipAddress: ctx.ipAddress
    });
    return res.json({ success: true, data: result });
  } catch (error) {
    return sendContentPlatformError(res, error, 'Failed to publish template');
  }
};

exports.archiveTemplate = async (req, res) => {
  try {
    const ctx = getRequestContext(req);
    const template = await contentTemplateService.archiveTemplate({
      organizationId: ctx.organizationId,
      templateId: req.params.id,
      userId: ctx.userId,
      ipAddress: ctx.ipAddress
    });
    return res.json({ success: true, data: template });
  } catch (error) {
    return sendContentPlatformError(res, error, 'Failed to archive template');
  }
};

exports.listTemplateVersions = async (req, res) => {
  try {
    const ctx = getRequestContext(req);
    const versions = await contentTemplateService.listTemplateVersions({
      organizationId: ctx.organizationId,
      templateId: req.params.id
    });
    return res.json({ success: true, data: versions });
  } catch (error) {
    return sendContentPlatformError(res, error, 'Failed to list template versions');
  }
};

exports.getTemplateVersion = async (req, res) => {
  try {
    const ctx = getRequestContext(req);
    const version = await contentTemplateService.getTemplateVersion({
      organizationId: ctx.organizationId,
      templateId: req.params.id,
      version: req.params.version
    });
    return res.json({ success: true, data: version });
  } catch (error) {
    return sendContentPlatformError(res, error, 'Failed to get template version');
  }
};

exports.compareTemplateVersions = async (req, res) => {
  try {
    const ctx = getRequestContext(req);
    const versionA = req.body?.versionA ?? req.query.versionA;
    const versionB = req.body?.versionB ?? req.query.versionB;

    if (versionA == null || versionB == null) {
      return res.status(400).json({
        success: false,
        code: 'CONTENT_VALIDATION_FAILED',
        message: 'versionA and versionB are required',
        details: [
          { path: 'versionA', message: 'Required' },
          { path: 'versionB', message: 'Required' }
        ],
        traceId: null
      });
    }

    const comparison = await contentTemplateService.compareTemplateVersions({
      organizationId: ctx.organizationId,
      templateId: req.params.id,
      versionA,
      versionB
    });
    return res.json({ success: true, data: comparison });
  } catch (error) {
    return sendContentPlatformError(res, error, 'Failed to compare template versions');
  }
};

exports.restoreTemplateVersion = async (req, res) => {
  try {
    const ctx = getRequestContext(req);
    const result = await contentTemplateService.restoreTemplateVersion({
      organizationId: ctx.organizationId,
      templateId: req.params.id,
      version: req.params.version,
      userId: ctx.userId,
      ipAddress: ctx.ipAddress
    });
    return res.json({ success: true, data: result });
  } catch (error) {
    return sendContentPlatformError(res, error, 'Failed to restore template version');
  }
};

exports.validateTemplate = async (req, res) => {
  try {
    const ctx = getRequestContext(req);
    const validation = await contentTemplateService.validateTemplate({
      organizationId: ctx.organizationId,
      templateId: req.params.id,
      userId: ctx.userId,
      jsonDefinition: req.body?.jsonDefinition
    });
    return res.json({ success: true, data: validation });
  } catch (error) {
    return sendContentPlatformError(res, error, 'Failed to validate template');
  }
};

exports.renderTemplate = async (req, res) => {
  try {
    const ctx = getRequestContext(req);
    const preview = req.path.includes('/preview')
      || req.body?.preview === true
      || req.query.preview === '1';
    const outputFormat = req.body?.outputFormat || req.query.format || (preview ? 'html' : 'pdf');
    const persistOutput = req.body?.persistOutput !== false && outputFormat !== 'html';
    const result = await contentTemplateService.requestRender({
      organizationId: ctx.organizationId,
      templateId: req.body?.templateId || req.params.id,
      userId: ctx.userId,
      outputFormat,
      preview,
      jsonDefinition: req.body?.jsonDefinition || null,
      pageSettings: req.body?.pageSettings || null,
      persistOutput,
      runtimeContext: req.body?.runtimeContext || {},
      ipAddress: ctx.ipAddress
    });

    if (result.html && (req.query.raw === '1' || outputFormat === 'html')) {
      if (req.query.raw === '1') {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(result.html || '');
      }
    }

    return res.json({ success: true, data: result });
  } catch (error) {
    return sendContentPlatformError(res, error, 'Failed to render template');
  }
};

exports.renderTemplatePreview = async (req, res) => {
  req.body = { ...(req.body || {}), preview: true };
  return exports.renderTemplate(req, res);
};
