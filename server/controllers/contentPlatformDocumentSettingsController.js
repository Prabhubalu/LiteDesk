'use strict';

const {
  getModuleDocumentTemplateSettings,
  setModuleDefaultTemplate,
  assertSupportedModuleKey
} = require('../services/contentPlatform/contentPlatformDocumentSettingsService');
const {
  getShadowParitySummary,
  compareModuleDocumentPdf
} = require('../services/contentPlatform/contentPlatformShadowParityService');
const { sendContentPlatformError } = require('../utils/contentPlatformErrors');

function requireOrgAdmin(req, res) {
  if (req.user?.isOwner) return true;
  const role = String(req.user?.role || '').toLowerCase();
  if (role === 'owner' || role === 'admin' || req.user?.isPlatformAdmin) return true;
  res.status(403).json({ success: false, message: 'Admin access required' });
  return false;
}

/**
 * GET /api/settings/content-platform/documents/:moduleKey
 */
exports.getModuleDocumentTemplateSettings = async (req, res) => {
  try {
    assertSupportedModuleKey(req.params.moduleKey);
    const data = await getModuleDocumentTemplateSettings({
      organizationId: req.user.organizationId,
      moduleKey: req.params.moduleKey
    });
    return res.json({ success: true, data });
  } catch (error) {
    return sendContentPlatformError(res, error, 'Failed to load document template settings');
  }
};

/**
 * PUT /api/settings/content-platform/documents/:moduleKey
 * Body: { defaultTemplateId: string | null }
 */
exports.updateModuleDocumentTemplateSettings = async (req, res) => {
  try {
    if (!requireOrgAdmin(req, res)) return;

    assertSupportedModuleKey(req.params.moduleKey);

    const defaultTemplateId = req.body?.defaultTemplateId ?? null;
    const data = await setModuleDefaultTemplate({
      organizationId: req.user.organizationId,
      moduleKey: req.params.moduleKey,
      templateId: defaultTemplateId,
      userId: req.user._id,
      ipAddress: req.ip || null
    });

    return res.json({ success: true, data });
  } catch (error) {
    return sendContentPlatformError(res, error, 'Failed to update document template settings');
  }
};

/**
 * GET /api/settings/content-platform/shadow-parity/:moduleKey
 */
exports.getShadowParitySummary = async (req, res) => {
  try {
    assertSupportedModuleKey(req.params.moduleKey);
    const data = await getShadowParitySummary({
      organizationId: req.user.organizationId,
      moduleKey: req.params.moduleKey,
      limit: req.query.limit
    });
    return res.json({ success: true, data });
  } catch (error) {
    return sendContentPlatformError(res, error, 'Failed to load shadow parity summary');
  }
};

/**
 * POST /api/settings/content-platform/shadow-parity/:moduleKey/compare
 * Body: { recordId: string, templateId?: string | null }
 */
exports.compareShadowParity = async (req, res) => {
  try {
    if (!requireOrgAdmin(req, res)) return;

    assertSupportedModuleKey(req.params.moduleKey);

    const result = await compareModuleDocumentPdf({
      organizationId: req.user.organizationId,
      moduleKey: req.params.moduleKey,
      recordId: req.body?.recordId,
      templateId: req.body?.templateId || null,
      userId: req.user._id,
      ipAddress: req.ip || null,
      persist: true,
      source: 'manual_compare'
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    return sendContentPlatformError(res, error, 'Failed to compare document PDFs');
  }
};
