'use strict';

const moduleNumberingService = require('../services/moduleNumberingService');
const { attachSettingsAuditDiff, cloneForAudit } = require('../utils/settingsAuditSnapshot');

function requireOrgAdmin(req, res) {
  if (req.user?.isOwner) return true;
  const role = String(req.user?.role || '').toLowerCase();
  if (role === 'owner' || role === 'admin' || req.user?.isPlatformAdmin) return true;
  res.status(403).json({ success: false, message: 'Admin access required' });
  return false;
}

function handleError(res, error, fallback) {
  const status = error?.status || (error?.code === 'NOT_FOUND' ? 404 : 500);
  if (status >= 500) {
    console.error('[moduleNumberingController]', error);
  }
  return res.status(status).json({
    success: false,
    code: error?.code || undefined,
    message: error?.message || fallback,
  });
}

/**
 * GET /api/settings/module-numbering
 */
exports.listModuleNumbering = async (req, res) => {
  try {
    if (!requireOrgAdmin(req, res)) return;
    const configs = await moduleNumberingService.listConfigs(req.user.organizationId);
    return res.json({ success: true, configs });
  } catch (error) {
    return handleError(res, error, 'Failed to load module numbering');
  }
};

/**
 * GET /api/settings/module-numbering/:moduleKey
 */
exports.getModuleNumbering = async (req, res) => {
  try {
    if (!requireOrgAdmin(req, res)) return;
    const moduleKey = decodeURIComponent(String(req.params.moduleKey || ''));
    const config = await moduleNumberingService.getOrCreateConfig(
      req.user.organizationId,
      moduleKey
    );
    const plain = config.toObject ? config.toObject() : config;
    const entry = moduleNumberingService.resolveRegistryEntry(moduleKey);
    let previewValue = plain.format;
    try {
      previewValue = moduleNumberingService.preview({
        format: plain.format,
        prefix: plain.prefix,
        suffix: plain.suffix,
        sequenceLength: plain.sequenceLength,
        currentSequence: plain.currentSequence,
        startingSequence: plain.startingSequence,
      });
    } catch {
      /* keep format */
    }
    return res.json({
      success: true,
      config: {
        ...plain,
        label: entry.label || moduleKey,
        numberFieldKey: plain.numberFieldKey || entry.numberFieldKey,
        numberFieldLabel: entry.numberFieldLabel || entry.numberFieldKey || plain.numberFieldKey,
        preview: previewValue,
      },
    });
  } catch (error) {
    return handleError(res, error, 'Failed to load module numbering config');
  }
};

/**
 * PUT /api/settings/module-numbering/:moduleKey
 */
exports.updateModuleNumbering = async (req, res) => {
  try {
    if (!requireOrgAdmin(req, res)) return;
    const moduleKey = decodeURIComponent(String(req.params.moduleKey || ''));
    const patch = req.body || {};
    const { before, after } = await moduleNumberingService.updateConfig(
      req.user.organizationId,
      moduleKey,
      patch,
      {
        confirmLowerStarting: Boolean(patch.confirmLowerStarting),
        updatedBy: req.user._id,
      }
    );

    const auditKeys = [
      'moduleKey',
      ...Object.keys(patch).filter((k) => k !== 'confirmLowerStarting'),
    ];
    attachSettingsAuditDiff(res, cloneForAudit(before), cloneForAudit(after), {
      keys: auditKeys,
    });

    let previewValue = after.format;
    try {
      previewValue = moduleNumberingService.preview({
        format: after.format,
        prefix: after.prefix,
        suffix: after.suffix,
        sequenceLength: after.sequenceLength,
        currentSequence: after.currentSequence,
        startingSequence: after.startingSequence,
      });
    } catch {
      /* keep */
    }

    return res.json({
      success: true,
      config: { ...after, preview: previewValue },
    });
  } catch (error) {
    return handleError(res, error, 'Failed to update module numbering');
  }
};

/**
 * POST /api/settings/module-numbering/:moduleKey/preview
 */
exports.previewModuleNumbering = async (req, res) => {
  try {
    if (!requireOrgAdmin(req, res)) return;
    const body = req.body || {};
    const moduleKey = decodeURIComponent(String(req.params.moduleKey || ''));
    let payload = body;
    if (!body.format) {
      const config = await moduleNumberingService.getOrCreateConfig(
        req.user.organizationId,
        moduleKey
      );
      const plain = config.toObject ? config.toObject() : config;
      payload = {
        format: plain.format,
        prefix: plain.prefix,
        suffix: plain.suffix,
        sequenceLength: plain.sequenceLength,
        currentSequence: plain.currentSequence,
        startingSequence: plain.startingSequence,
        ...body,
      };
    }
    const preview = moduleNumberingService.preview(payload);
    return res.json({ success: true, preview });
  } catch (error) {
    return handleError(res, error, 'Failed to preview numbering');
  }
};

/**
 * POST /api/settings/module-numbering/:moduleKey/resync-sequence
 */
exports.resyncModuleNumbering = async (req, res) => {
  try {
    if (!requireOrgAdmin(req, res)) return;
    const moduleKey = decodeURIComponent(String(req.params.moduleKey || ''));
    const before = cloneForAudit(
      await moduleNumberingService.getOrCreateConfig(req.user.organizationId, moduleKey)
    );
    const result = await moduleNumberingService.resyncFromExistingRecords(
      req.user.organizationId,
      moduleKey
    );
    const after = cloneForAudit(
      await moduleNumberingService.getOrCreateConfig(req.user.organizationId, moduleKey)
    );
    attachSettingsAuditDiff(res, before, after, {
      keys: ['moduleKey', 'currentSequence'],
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    return handleError(res, error, 'Failed to resync sequence');
  }
};
