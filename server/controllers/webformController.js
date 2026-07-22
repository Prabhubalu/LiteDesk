'use strict';

const Webform = require('../models/Webform');
const WebformSubmission = require('../models/WebformSubmission');
const webformProcessingService = require('../services/webformProcessingService');
const { uploadPublicWebformFile } = require('../services/webformFileUploadService');
const {
  findPublicWebformBySlug,
  withPublicWebformTenantContext
} = require('../services/webformPublicService');
const {
  upsertPublicRegistryEntry,
  disablePublicRegistryEntry,
  removePublicRegistryEntry
} = require('../services/webformPublicRegistryService');
const {
  WEBFORM_STATUSES,
  WEBFORM_FIELD_TYPES,
  WEBFORM_DEDUP_ACTIONS,
  WEBFORM_RECORD_ACTIONS,
  WEBFORM_FIELD_WIDTHS,
  normalizeWebformFieldType,
  isWebformPicklistFieldType,
  listWebformBuilderFieldTypes
} = require('../constants/webformFields');
const { sanitizeFormActions } = require('../constants/webformFormActions');
const { sanitizeWebformBranding, sanitizeHexColor } = require('../constants/webformBranding');
const { sanitizeFieldVisibility, defaultFieldVisibility } = require('../constants/webformConditionalLogic');
const {
  isMultiStepEnabled,
  sanitizeFieldStepId,
  sanitizeMultiStepConfig,
  sanitizeWebformSteps
} = require('../constants/webformMultiStep');
const {
  listTenantWebformModules,
  resolveWebformTargetModule,
  resolveModuleAppKey,
  getModuleFieldsForWebform,
  serializeModuleFieldsForWebformClient
} = require('../services/webformModuleMetadataService');
const { resolvePublicCaptchaConfig, isCaptchaRequiredForWebform, verifyRecaptchaToken, formatCaptchaForClient } = require('../services/webformCaptchaService');
const { getWebformAnalytics } = require('../services/webformAnalyticsService');
const { appendWebformAuditEntry } = require('../services/webformAuditService');

function formatWebformForClient(webform) {
  if (!webform) return webform;
  const doc = typeof webform.toObject === 'function'
    ? webform.toObject()
    : { ...webform };
  doc.captcha = formatCaptchaForClient(doc);
  if (doc.captcha) {
    delete doc.captcha.secretKey;
  }
  return doc;
}

function applyBrandingToUpdate(update, branding) {
  const sanitized = sanitizeWebformBranding(branding);
  update.$set['branding.logoUrl'] = sanitized.logoUrl;
  update.$set['branding.themeColor'] = sanitized.themeColor;
  update.$set['branding.backgroundColor'] = sanitized.backgroundColor;
  update.$set['branding.fontFamily'] = sanitized.fontFamily;
}

function applyCaptchaToUpdate(update, captcha, rawSecret) {
  if (!captcha || typeof captcha !== 'object') return;

  update.$set['captcha.enabled'] = captcha.enabled === true;
  update.$set['captcha.siteKey'] = String(captcha.siteKey || '').trim();

  const secret = String(rawSecret || captcha.secretKey || '').trim();
  if (secret) {
    update.$set['captcha.secretKey'] = secret;
  }
}

async function resolveWebformFillModuleFields(organizationId, moduleKey, appKey, fields) {
  const key = String(moduleKey || '').trim().toLowerCase();
  if (!key || !organizationId) return [];

  try {
    const liveFields = await getModuleFieldsForWebform(organizationId, key, appKey);
    return serializeModuleFieldsForWebformClient(liveFields, fields);
  } catch (err) {
    console.warn('[webformController.resolveWebformFillModuleFields] failed:', err?.message || err);
    return [];
  }
}

async function buildPublicWebformPayload(webform) {
  const fields = Array.isArray(webform?.fields) ? webform.fields : [];
  const moduleKey = String(webform?.targetModuleKey || '').trim().toLowerCase();
  const moduleFields = moduleKey && webform?.organizationId
    ? await resolveWebformFillModuleFields(webform.organizationId, moduleKey, webform.targetAppKey, fields)
    : [];

  return {
    webformId: webform.webformId,
    name: webform.name,
    description: webform.description,
    targetModuleKey: webform.targetModuleKey || '',
    targetAppKey: webform.targetAppKey || '',
    headerImageUrl: webform.headerImageUrl || '',
    headerBackgroundColor: sanitizeHexColor(webform.headerBackgroundColor, ''),
    branding: sanitizeWebformBranding(webform.branding),
    multiStep: sanitizeMultiStepConfig(webform.multiStep),
    steps: sanitizeWebformSteps(webform.steps, isMultiStepEnabled(webform)),
    fields,
    moduleFields,
    formActions: sanitizeFormActions(webform.formActions),
    thankYouMessage: webform.thankYouMessage,
    redirectUrl: webform.redirectUrl,
    captcha: resolvePublicCaptchaConfig(webform)
  };
}

async function buildWebformFillPreviewPayloadFromBody(organizationId, body) {
  const multiStep = sanitizeMultiStepConfig(body?.multiStep);
  const steps = sanitizeWebformSteps(body?.steps, multiStep.enabled);
  const webformShape = { multiStep, steps };
  const fields = Array.isArray(body?.fields)
    ? body.fields.map((field, index) => sanitizeField(field, index, webformShape))
    : [];
  const moduleKey = String(body?.targetModuleKey || '').trim().toLowerCase();
  const moduleFields = moduleKey
    ? await resolveWebformFillModuleFields(organizationId, moduleKey, body?.targetAppKey, fields)
    : [];

  return {
    webformId: body?.webformId || '',
    name: String(body?.name || '').trim(),
    description: String(body?.description || '').trim(),
    targetModuleKey: body?.targetModuleKey || '',
    targetAppKey: body?.targetAppKey || '',
    headerImageUrl: String(body?.headerImageUrl || '').trim(),
    headerBackgroundColor: sanitizeHexColor(body?.headerBackgroundColor, ''),
    branding: sanitizeWebformBranding(body?.branding),
    multiStep,
    steps,
    fields,
    moduleFields,
    formActions: sanitizeFormActions(body?.formActions),
    thankYouMessage: String(body?.thankYouMessage || '').trim(),
    redirectUrl: String(body?.redirectUrl || '').trim(),
    status: WEBFORM_STATUSES.includes(body?.status) ? body.status : 'Draft',
    captcha: resolvePublicCaptchaConfig(body)
  };
}

async function syncRegistryIfPublic(webform) {
  if (!webform?.publicLink?.enabled || !webform?.publicLink?.slug) return;
  await upsertPublicRegistryEntry({
    slug: webform.publicLink.slug,
    organizationId: webform.organizationId,
    webformId: webform._id
  });
}

function sanitizeField(field, index, webform) {
  const fieldId = String(field.fieldId || field.fieldKey || `field_${index + 1}`).trim();
  const normalizedType = normalizeWebformFieldType(field.type);
  const type = WEBFORM_FIELD_TYPES.includes(normalizedType) ? normalizedType : 'Text';
  const picklist = isWebformPicklistFieldType(type);
  const crmFieldKey = String(field.crmFieldKey || '').trim();
  return {
    fieldId,
    label: String(field.label || `Field ${index + 1}`).trim(),
    type,
    required: field.required === true,
    helpText: String(field.helpText || '').trim(),
    placeholder: String(field.placeholder || '').trim(),
    options: picklist && Array.isArray(field.options)
      ? field.options.map((opt) => String(opt).trim()).filter(Boolean)
      : [],
    crmFieldKey,
    columnWidth: WEBFORM_FIELD_WIDTHS.includes(field.columnWidth) ? field.columnWidth : 'full',
    order: Number.isFinite(Number(field.order)) ? Number(field.order) : index,
    stepId: sanitizeFieldStepId(field.stepId, webform),
    ...(crmFieldKey
      ? { visibility: defaultFieldVisibility() }
      : {
        dependencies: Array.isArray(field.dependencies) && field.dependencies.length
          ? field.dependencies
          : undefined,
        visibility: sanitizeFieldVisibility(field.visibility)
      })
  };
}

async function sanitizeWebformPayload(body, organizationId, userId) {
  const requestedModuleKey = String(body.targetModuleKey || 'people').toLowerCase();
  const requestedAppKey = body.targetAppKey ? String(body.targetAppKey).toUpperCase() : null;
  const resolvedTarget =
    (await resolveWebformTargetModule(organizationId, requestedModuleKey, requestedAppKey))
    || (await resolveWebformTargetModule(organizationId, requestedModuleKey))
    || {
      moduleKey: requestedModuleKey,
      appKey: resolveModuleAppKey(requestedModuleKey, requestedAppKey || 'PLATFORM')
    };

  const multiStep = sanitizeMultiStepConfig(body.multiStep);
  const steps = sanitizeWebformSteps(body.steps, multiStep.enabled);
  const webformShape = { multiStep, steps };

  const payload = {
    organizationId,
    name: String(body.name || 'Untitled Webform').trim(),
    description: String(body.description || '').trim(),
    status: WEBFORM_STATUSES.includes(body.status) ? body.status : 'Draft',
    targetModuleKey: resolvedTarget.moduleKey,
    targetAppKey: resolvedTarget.appKey || resolveModuleAppKey(resolvedTarget.moduleKey, 'PLATFORM'),
    fields: Array.isArray(body.fields) ? body.fields.map((field, index) => sanitizeField(field, index, webformShape)) : [],
    recordAction: body.recordAction || 'create',
    headerImageUrl: String(body.headerImageUrl || '').trim(),
    headerBackgroundColor: sanitizeHexColor(body.headerBackgroundColor, ''),
    branding: sanitizeWebformBranding(body.branding),
    multiStep,
    steps,
    thankYouMessage: String(body.thankYouMessage || '').trim(),
    redirectUrl: String(body.redirectUrl || '').trim(),
    formActions: sanitizeFormActions(body.formActions),
    modifiedBy: userId
  };

  if (body.dedup && typeof body.dedup === 'object') {
    payload.dedup = {
      enabled: body.dedup.enabled === true,
      keys: Array.isArray(body.dedup.keys)
        ? body.dedup.keys.map((key) => String(key).trim()).filter(Boolean)
        : [],
      action: WEBFORM_DEDUP_ACTIONS.includes(body.dedup.action) ? body.dedup.action : 'update'
    };
  }

  if (body.notifyOnSubmit && typeof body.notifyOnSubmit === 'object') {
    payload.notifyOnSubmit = {
      enabled: body.notifyOnSubmit.enabled !== false,
      userIds: Array.isArray(body.notifyOnSubmit.userIds)
        ? body.notifyOnSubmit.userIds
          .map((id) => {
            if (id && typeof id === 'object' && id._id) return String(id._id).trim();
            return String(id || '').trim();
          })
          .filter(Boolean)
        : []
    };
  }

  if (body.taskOnSubmit && typeof body.taskOnSubmit === 'object') {
    const assigneeOptions = ['record_owner', 'webform_creator', 'specific_user'];
    const assignee = assigneeOptions.includes(body.taskOnSubmit.assignee)
      ? body.taskOnSubmit.assignee
      : 'record_owner';
    payload.taskOnSubmit = {
      enabled: body.taskOnSubmit.enabled === true,
      title: String(body.taskOnSubmit.title || '').trim(),
      description: String(body.taskOnSubmit.description || '').trim(),
      dueInDays: Number.isFinite(Number(body.taskOnSubmit.dueInDays))
        ? Math.max(0, Number(body.taskOnSubmit.dueInDays))
        : null,
      assignee,
      assigneeUserId:
        assignee === 'specific_user' && body.taskOnSubmit.assigneeUserId
          ? String(body.taskOnSubmit.assigneeUserId).trim()
          : null
    };
    if (!payload.taskOnSubmit.enabled) {
      payload.taskOnSubmit.title = '';
      payload.taskOnSubmit.description = '';
      payload.taskOnSubmit.assigneeUserId = null;
    }
  }

  if (body.webhook && typeof body.webhook === 'object') {
    payload.webhook = {
      enabled: body.webhook.enabled === true,
      url: String(body.webhook.url || '').trim(),
      secret: String(body.webhook.secret || '').trim()
    };
    if (!payload.webhook.enabled) {
      payload.webhook.url = '';
    }
  }

  if (body.captcha && typeof body.captcha === 'object') {
    payload.captcha = {
      enabled: body.captcha.enabled === true,
      siteKey: String(body.captcha.siteKey || '').trim()
    };
    const secretKey = String(body.captcha.secretKey || '').trim();
    if (secretKey) {
      payload.captcha.secretKey = secretKey;
    }
  }

  if (payload.recordAction && !WEBFORM_RECORD_ACTIONS.includes(payload.recordAction)) {
    payload.recordAction = 'create';
  }

  if (body.publicLink && typeof body.publicLink === 'object') {
    payload.publicLink = {
      enabled: body.publicLink.enabled === true,
      slug: body.publicLink.slug ? String(body.publicLink.slug).trim().toLowerCase() : undefined
    };
    if (!payload.publicLink.enabled || !payload.publicLink.slug) {
      delete payload.publicLink.slug;
    }
  }

  return payload;
}

function applyPublicLinkToUpdate(update, publicLink) {
  if (!publicLink || typeof publicLink !== 'object') return;

  const enabled = publicLink.enabled === true;
  const slug = publicLink.slug ? String(publicLink.slug).trim().toLowerCase() : '';

  if (enabled && slug) {
    update.$set['publicLink.enabled'] = true;
    update.$set['publicLink.slug'] = slug;
    return;
  }

  update.$set['publicLink.enabled'] = false;
  update.$unset = { ...(update.$unset || {}), 'publicLink.slug': '' };
}

function buildListQuery(organizationId, query) {
  const filter = { organizationId };
  if (query.status && WEBFORM_STATUSES.includes(query.status)) {
    filter.status = query.status;
  }
  if (query.search) {
    const search = String(query.search).trim();
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { webformId: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
  }
  return filter;
}

exports.getWebforms = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const skip = (page - 1) * limit;
    const sortBy = String(req.query.sortBy || 'updatedAt');
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

    const filter = buildListQuery(req.user.organizationId, req.query);
    const [rows, total] = await Promise.all([
      Webform.find(filter)
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .populate('createdBy', 'firstName lastName email')
        .populate('modifiedBy', 'firstName lastName email')
        .lean(),
      Webform.countDocuments(filter)
    ]);

    return res.json({
      success: true,
      data: rows.map(formatWebformForClient),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1
      }
    });
  } catch (error) {
    console.error('[webformController.getWebforms]', error);
    return res.status(500).json({ success: false, message: 'Error fetching webforms.' });
  }
};

exports.createWebform = async (req, res) => {
  try {
    const payload = await sanitizeWebformPayload(req.body, req.user.organizationId, req.user._id);
    payload.createdBy = req.user._id;
    if (payload.status === 'Active') {
      payload.publishedAt = new Date();
    }

    const webform = await Webform.create(payload);
    const populated = await Webform.findById(webform._id)
      .populate('createdBy', 'firstName lastName email')
      .populate('modifiedBy', 'firstName lastName email');

    const { attachSettingsAuditDiff, cloneForAudit } = require('../utils/settingsAuditSnapshot');
    const formatted = formatWebformForClient(populated);
    attachSettingsAuditDiff(res, {}, cloneForAudit(formatted), { body: req.body || {} });

    return res.status(201).json({ success: true, data: formatted });
  } catch (error) {
    console.error('[webformController.createWebform]', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Error creating webform.'
    });
  }
};

exports.getWebformById = async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    const orgFilter = { organizationId: req.user.organizationId };
    let webform = await Webform.findOne({ _id: id, ...orgFilter })
      .populate('createdBy', 'firstName lastName email')
      .populate('modifiedBy', 'firstName lastName email');

    if (!webform && id) {
      webform = await Webform.findOne({ webformId: id, ...orgFilter })
        .populate('createdBy', 'firstName lastName email')
        .populate('modifiedBy', 'firstName lastName email');
    }

    if (!webform) {
      return res.status(404).json({ success: false, message: 'Webform not found.' });
    }

    try {
      await syncRegistryIfPublic(webform);
    } catch (registryErr) {
      console.warn('[webformController.getWebformById] registry sync failed:', registryErr?.message || registryErr);
    }

    return res.json({ success: true, data: formatWebformForClient(webform) });
  } catch (error) {
    console.error('[webformController.getWebformById]', error);
    return res.status(500).json({ success: false, message: 'Error fetching webform.' });
  }
};

exports.updateWebform = async (req, res) => {
  try {
    const existing = await Webform.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Webform not found.' });
    }

    const { attachSettingsAuditDiff, cloneForAudit } = require('../utils/settingsAuditSnapshot');
    const before = cloneForAudit(formatWebformForClient(existing));

    const payload = await sanitizeWebformPayload(req.body, req.user.organizationId, req.user._id);
    delete payload.organizationId;
    delete payload.createdBy;

    if (payload.status === 'Active' && existing.status !== 'Active' && !existing.publishedAt) {
      payload.publishedAt = new Date();
    } else {
      delete payload.publishedAt;
    }

    const publicLink = payload.publicLink;
    const captcha = payload.captcha;
    const branding = payload.branding;
    delete payload.publicLink;
    delete payload.captcha;
    delete payload.branding;

    const update = { $set: payload };
    applyPublicLinkToUpdate(update, publicLink);
    applyCaptchaToUpdate(update, captcha, req.body?.captcha?.secretKey);
    applyBrandingToUpdate(update, branding);

    const updated = await Webform.findOneAndUpdate(
      { _id: existing._id, organizationId: req.user.organizationId },
      update,
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Webform not found.' });
    }

    if (updated.publicLink?.enabled && updated.publicLink?.slug) {
      await upsertPublicRegistryEntry({
        slug: updated.publicLink.slug,
        organizationId: updated.organizationId,
        webformId: updated._id
      });
    } else if (existing.publicLink?.slug) {
      await disablePublicRegistryEntry(existing.publicLink.slug);
    }

    if (payload.status && payload.status !== existing.status) {
      void appendWebformAuditEntry({
        webformId: updated._id,
        organizationId: updated.organizationId,
        type: 'status_changed',
        message: `Status changed from ${existing.status} to ${updated.status}.`,
        actorUserId: req.user._id,
        metadata: { from: existing.status, to: updated.status }
      });
    }
    if (existing.publicLink?.enabled && !updated.publicLink?.enabled) {
      void appendWebformAuditEntry({
        webformId: updated._id,
        organizationId: updated.organizationId,
        type: 'unpublished',
        message: 'Public link disabled.',
        actorUserId: req.user._id
      });
    }

    const populated = await Webform.findById(updated._id)
      .populate('createdBy', 'firstName lastName email')
      .populate('modifiedBy', 'firstName lastName email');

    const formatted = formatWebformForClient(populated);
    attachSettingsAuditDiff(res, before, cloneForAudit(formatted), { body: req.body || {} });

    return res.json({ success: true, data: formatted });
  } catch (error) {
    console.error('[webformController.updateWebform]', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Error updating webform.'
    });
  }
};

exports.deleteWebform = async (req, res) => {
  try {
    const deleted = await Webform.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId
    });

    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Webform not found.' });
    }

    const { attachSettingsAuditDiff, cloneForAudit } = require('../utils/settingsAuditSnapshot');
    const before = cloneForAudit({
      name: deleted.name,
      status: deleted.status,
      targetModuleKey: deleted.targetModuleKey
    });

    if (deleted.publicLink?.slug) {
      await removePublicRegistryEntry(deleted.publicLink.slug);
    }

    await Webform.findOneAndDelete({
      _id: req.params.id,
      organizationId: req.user.organizationId
    });

    attachSettingsAuditDiff(res, before, {}, { keys: Object.keys(before || {}) });

    return res.json({ success: true, message: 'Webform deleted.' });
  } catch (error) {
    console.error('[webformController.deleteWebform]', error);
    return res.status(500).json({ success: false, message: 'Error deleting webform.' });
  }
};

exports.duplicateWebform = async (req, res) => {
  try {
    const source = await Webform.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId
    }).lean();

    if (!source) {
      return res.status(404).json({ success: false, message: 'Webform not found.' });
    }

    const copyPayload = {
      organizationId: req.user.organizationId,
      name: `${source.name} (Copy)`,
      description: source.description,
      status: 'Draft',
      targetModuleKey: source.targetModuleKey,
      targetAppKey: source.targetAppKey,
      fields: source.fields,
      recordAction: source.recordAction,
      dedup: source.dedup,
      notifyOnSubmit: source.notifyOnSubmit,
      taskOnSubmit: source.taskOnSubmit,
      webhook: { enabled: false, url: '', secret: '' },
      thankYouMessage: source.thankYouMessage,
      redirectUrl: source.redirectUrl,
      headerImageUrl: source.headerImageUrl || '',
      headerBackgroundColor: sanitizeHexColor(source.headerBackgroundColor, ''),
      branding: sanitizeWebformBranding(source.branding),
      formActions: sanitizeFormActions(source.formActions),
      publicLink: { enabled: false },
      createdBy: req.user._id,
      modifiedBy: req.user._id
    };

    const created = await Webform.create(copyPayload);
    const populated = await Webform.findById(created._id)
      .populate('createdBy', 'firstName lastName email')
      .populate('modifiedBy', 'firstName lastName email');

    const { attachSettingsAuditDiff, cloneForAudit } = require('../utils/settingsAuditSnapshot');
    const formatted = formatWebformForClient(populated);
    attachSettingsAuditDiff(
      res,
      {},
      cloneForAudit({ name: formatted.name, status: formatted.status, sourceId: source._id }),
      { keys: ['name', 'status', 'sourceId'] }
    );

    return res.status(201).json({ success: true, data: formatted });
  } catch (error) {
    console.error('[webformController.duplicateWebform]', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Error duplicating webform.'
    });
  }
};

exports.getWebformModules = async (req, res) => {
  try {
    const modules = await listTenantWebformModules(req.user.organizationId);
    return res.json({
      success: true,
      data: modules
    });
  } catch (error) {
    console.error('[webformController.getWebformModules]', error);
    return res.status(500).json({ success: false, message: 'Error fetching webform modules.' });
  }
};

exports.getWebformFieldTypes = async (req, res) => {
  try {
    return res.json({
      success: true,
      data: listWebformBuilderFieldTypes()
    });
  } catch (error) {
    console.error('[webformController.getWebformFieldTypes]', error);
    return res.status(500).json({ success: false, message: 'Error fetching webform field types.' });
  }
};

exports.resolveWebformFillPreviewPayload = async (req, res) => {
  try {
    const data = await buildWebformFillPreviewPayloadFromBody(req.user.organizationId, req.body);
    return res.json({ success: true, data });
  } catch (error) {
    console.error('[webformController.resolveWebformFillPreviewPayload]', error);
    return res.status(500).json({ success: false, message: 'Error building webform fill preview.' });
  }
};

exports.enablePublicLink = async (req, res) => {
  try {
    const webform = await Webform.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId
    });

    if (!webform) {
      return res.status(404).json({ success: false, message: 'Webform not found.' });
    }

    const { attachSettingsAuditDiff, cloneForAudit } = require('../utils/settingsAuditSnapshot');
    const before = cloneForAudit({
      publicLinkEnabled: !!webform.publicLink?.enabled,
      status: webform.status
    });

    if (!String(webform.name || '').trim()) {
      return res.status(400).json({ success: false, message: 'Webform name is required before publishing.' });
    }
    if (!Array.isArray(webform.fields) || webform.fields.length === 0) {
      return res.status(400).json({ success: false, message: 'Add at least one field before publishing.' });
    }

    let slug = webform.publicLink?.slug;
    if (!slug) {
      let baseSlug = String(webform.name || 'webform')
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 50);

      if (!baseSlug) {
        baseSlug = `webform-${webform.webformId || webform._id.toString().substring(0, 8)}`;
      }

      slug = baseSlug;
      let counter = 1;
      let existing = await Webform.findOne({
        'publicLink.slug': slug,
        _id: { $ne: webform._id }
      });

      while (existing) {
        slug = `${baseSlug}-${counter}`;
        existing = await Webform.findOne({
          'publicLink.slug': slug,
          _id: { $ne: webform._id }
        });
        counter += 1;
        if (counter > 100) {
          slug = `${baseSlug}-${Date.now()}`;
          break;
        }
      }
    }

    webform.publicLink = { enabled: true, slug };
    webform.modifiedBy = req.user._id;
    if (webform.status === 'Draft') {
      webform.status = 'Active';
      webform.publishedAt = webform.publishedAt || new Date();
    }
    await webform.save();

    await upsertPublicRegistryEntry({
      slug,
      organizationId: webform.organizationId,
      webformId: webform._id
    });

    void appendWebformAuditEntry({
      webformId: webform._id,
      organizationId: webform.organizationId,
      type: 'published',
      message: `Public link enabled at slug "${slug}".`,
      actorUserId: req.user._id,
      metadata: { slug }
    });

    const populated = await Webform.findById(webform._id)
      .populate('createdBy', 'firstName lastName email')
      .populate('modifiedBy', 'firstName lastName email');

    attachSettingsAuditDiff(
      res,
      before,
      cloneForAudit({
        publicLinkEnabled: true,
        status: webform.status,
        slug
      }),
      { keys: ['publicLinkEnabled', 'status', 'slug'] }
    );

    return res.json({
      success: true,
      data: formatWebformForClient(populated),
      message: 'Public link enabled successfully.'
    });
  } catch (error) {
    console.error('[webformController.enablePublicLink]', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Error enabling public link.'
    });
  }
};

exports.getWebformAnalytics = async (req, res) => {
  try {
    const webform = await Webform.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId
    }).select('_id');

    if (!webform) {
      return res.status(404).json({ success: false, message: 'Webform not found.' });
    }

    const data = await getWebformAnalytics(webform._id, req.user.organizationId, req.query);
    return res.json({ success: true, data });
  } catch (error) {
    console.error('[webformController.getWebformAnalytics]', error);
    return res.status(500).json({ success: false, message: 'Error loading webform analytics.' });
  }
};

exports.syncPublicRegistry = async (req, res) => {
  try {
    const webform = await Webform.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId
    });

    if (!webform) {
      return res.status(404).json({ success: false, message: 'Webform not found.' });
    }

    if (!webform.publicLink?.enabled || !webform.publicLink?.slug) {
      return res.status(400).json({
        success: false,
        message: 'Public link is not enabled for this webform.'
      });
    }

    await upsertPublicRegistryEntry({
      slug: webform.publicLink.slug,
      organizationId: webform.organizationId,
      webformId: webform._id
    });

    void appendWebformAuditEntry({
      webformId: webform._id,
      organizationId: webform.organizationId,
      type: 'registry_synced',
      message: 'Public slug registry re-synced.',
      actorUserId: req.user._id,
      metadata: { slug: webform.publicLink.slug }
    });

    return res.json({ success: true, message: 'Public registry synced.' });
  } catch (error) {
    console.error('[webformController.syncPublicRegistry]', error);
    return res.status(500).json({ success: false, message: 'Error syncing public registry.' });
  }
};

exports.getWebformSubmissions = async (req, res) => {
  try {
    const webform = await Webform.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId
    }).select('name webformId fields targetModuleKey targetAppKey publicLink totalSubmissions status');

    if (!webform) {
      return res.status(404).json({ success: false, message: 'Webform not found.' });
    }

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const skip = (page - 1) * limit;

    const filter = {
      webformId: webform._id,
      organizationId: req.user.organizationId
    };
    if (req.query.status) {
      filter.status = String(req.query.status).trim();
    }

    const [rows, total] = await Promise.all([
      WebformSubmission.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      WebformSubmission.countDocuments(filter)
    ]);

    return res.json({
      success: true,
      data: {
        webform,
        submissions: rows
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1
      }
    });
  } catch (error) {
    console.error('[webformController.getWebformSubmissions]', error);
    return res.status(500).json({ success: false, message: 'Error fetching webform submissions.' });
  }
};

exports.getWebformPreviewBySlug = async (req, res) => {
  try {
    const slug = String(req.params.slug || '').trim().toLowerCase();
    if (!slug) {
      return res.status(400).json({ success: false, message: 'Slug is required.' });
    }

    const webform = await Webform.findOne({
      organizationId: req.user.organizationId,
      'publicLink.slug': slug,
      status: { $in: ['Active', 'Draft'] }
    });

    if (!webform) {
      return res.status(404).json({ success: false, message: 'Webform not found or not available.' });
    }

    try {
      await syncRegistryIfPublic(webform);
    } catch (registryErr) {
      console.warn('[webformController.getWebformPreviewBySlug] registry sync failed:', registryErr?.message || registryErr);
    }

    return res.json({
      success: true,
      data: await buildPublicWebformPayload(webform)
    });
  } catch (error) {
    console.error('[webformController.getWebformPreviewBySlug]', error);
    return res.status(500).json({ success: false, message: 'Error loading webform preview.' });
  }
};

exports.getPublicWebformBySlug = async (req, res) => {
  try {
    const webform = await findPublicWebformBySlug(req.params.slug, { allowDraft: true });

    if (!webform) {
      return res.status(404).json({ success: false, message: 'Webform not found or not available.' });
    }

    try {
      await syncRegistryIfPublic(webform);
    } catch (registryErr) {
      console.warn('[webformController.getPublicWebformBySlug] registry sync failed:', registryErr?.message || registryErr);
    }

    void withPublicWebformTenantContext(webform, () =>
      Webform.updateOne({ _id: webform._id }, { $inc: { totalViews: 1 } })
    ).catch((viewErr) => {
      console.warn('[webformController.getPublicWebformBySlug] view count failed:', viewErr?.message || viewErr);
    });

    return res.json({
      success: true,
      data: await buildPublicWebformPayload(webform)
    });
  } catch (error) {
    console.error('[webformController.getPublicWebformBySlug]', error);
    return res.status(500).json({ success: false, message: 'Error loading webform.' });
  }
};

exports.uploadPublicWebformFile = async (req, res) => {
  try {
    const webform = await findPublicWebformBySlug(req.params.slug, { allowDraft: false });

    if (!webform) {
      return res.status(404).json({
        success: false,
        message: 'Webform not found or not available.'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'File is required.'
      });
    }

    const data = await withPublicWebformTenantContext(webform, () =>
      uploadPublicWebformFile({
        webform,
        file: req.file,
        fieldId: req.body?.fieldId,
        ipAddress: req.ip
      })
    );

    return res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    const status = error.statusCode || 400;
    console.error('[webformController.uploadPublicWebformFile]', error);
    return res.status(status).json({
      success: false,
      message: error.message || 'Error uploading file.'
    });
  }
};

exports.submitPublicWebform = async (req, res) => {
  try {
    const webform = await findPublicWebformBySlug(req.params.slug, { allowDraft: false });

    if (!webform) {
      return res.status(404).json({
        success: false,
        message: 'Webform not found or not available.'
      });
    }

    const fieldValues = req.body?.fieldValues || req.body?.fields || req.body;
    const idempotencyKey =
      req.headers['x-idempotency-key']
      || req.headers['idempotency-key']
      || req.body?.idempotencyKey;

    if (isCaptchaRequiredForWebform(webform)) {
      const captchaToken =
        req.body?.captchaToken
        || req.body?.['g-recaptcha-response']
        || req.headers['x-captcha-token'];
      const captchaResult = await verifyRecaptchaToken(captchaToken, req.ip, webform);
      if (!captchaResult.ok) {
        return res.status(400).json({
          success: false,
          message: captchaResult.error || 'CAPTCHA verification failed.'
        });
      }
    }

    const submission = await withPublicWebformTenantContext(webform, async () => {
      const freshWebform = await Webform.findById(webform._id);
      if (!freshWebform) {
        const error = new Error('Webform not found or not available.');
        error.statusCode = 404;
        throw error;
      }

      return webformProcessingService.processSubmission({
        webform: freshWebform,
        fieldValues,
        organizationId: freshWebform.organizationId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || '',
        idempotencyKey
      });
    });

    const statusCode = submission.idempotentReplay ? 200 : 201;

    return res.status(statusCode).json({
      success: true,
      data: {
        submissionId: submission._id,
        crmOutcome: submission.crmOutcome || null,
        dedupOutcome: submission.dedupOutcome || null,
        thankYouMessage: webform.thankYouMessage || '',
        redirectUrl: webform.redirectUrl || '',
        idempotentReplay: submission.idempotentReplay === true
      },
      message: webform.thankYouMessage || 'Thank you for your submission.'
    });
  } catch (error) {
    const status = error.statusCode || 400;
    console.error('[webformController.submitPublicWebform]', error);
    return res.status(status).json({
      success: false,
      message: error.message || 'Error submitting webform.',
      fieldId: error.fieldId || undefined,
      dedupOutcome: error.dedupOutcome || undefined,
      idempotentReplay: error.idempotentReplay === true
    });
  }
};
