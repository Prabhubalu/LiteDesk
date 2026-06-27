'use strict';

const ContentTemplate = require('../../models/ContentTemplate');
const ContentTemplateVersion = require('../../models/ContentTemplateVersion');
const ContentValidationReport = require('../../models/ContentValidationReport');
const { createBlankTemplateDefinition } = require('../../constants/contentTemplateModuleDefaults');
const {
  createBlankGrapesTemplateDefinition,
  isGrapesTemplateDefinition
} = require('../../constants/grapesTemplateDefinition');
const { normalizeTemplatePageSettings } = require('../../constants/contentPaperSizes');
const {
  CONTENT_PLATFORM_ERROR_CODES,
  ContentPlatformError
} = require('../../utils/contentPlatformErrors');
const {
  validateTemplateDefinition,
  assertValidTemplateDefinition
} = require('./contentTemplateValidationService');
const {
  CONTENT_PLATFORM_EVENT_TYPES,
  emitContentPlatformEvent,
  writeContentAuditLog
} = require('./contentPlatformEventService');

function notDeletedFilter() {
  return { deletedAt: null };
}

/**
 * @param {import('mongoose').Document|object} template
 */
function formatTemplate(template) {
  if (!template) return template;
  const doc = typeof template.toObject === 'function' ? template.toObject() : template;
  return doc;
}

/**
 * @param {object} params
 */
async function listTemplates(params) {
  const {
    organizationId,
    page = 1,
    limit = 20,
    status,
    moduleScope,
    search
  } = params;

  const query = {
    organizationId,
    ...notDeletedFilter()
  };

  if (status === 'review') {
    query.status = { $in: ['review', 'approved'] };
  } else if (status === 'archived') {
    query.status = { $in: ['archived', 'deprecated'] };
  } else if (status) {
    query.status = status;
  }
  if (moduleScope) query.moduleScope = moduleScope;
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { purpose: { $regex: search, $options: 'i' } }
    ];
  }

  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const safePage = Math.max(Number(page) || 1, 1);
  const skip = (safePage - 1) * safeLimit;

  const [items, total] = await Promise.all([
    ContentTemplate.find(query)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    ContentTemplate.countDocuments(query)
  ]);

  return {
    items: items.map(formatTemplate),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit) || 1
    }
  };
}

/**
 * @param {object} params
 */
async function getTemplateSummary(params) {
  const { organizationId } = params;
  const baseQuery = {
    organizationId,
    ...notDeletedFilter()
  };

  const [total, statusRows, recent] = await Promise.all([
    ContentTemplate.countDocuments(baseQuery),
    ContentTemplate.aggregate([
      { $match: baseQuery },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),
    ContentTemplate.find(baseQuery)
      .sort({ updatedAt: -1 })
      .limit(5)
      .select('name status purpose moduleScope outputFormat updatedAt latestPublishedVersion latestVersion')
      .lean()
  ]);

  const byStatus = {};
  for (const row of statusRows) {
    if (row?._id) byStatus[row._id] = row.count;
  }

  const draft = byStatus.draft || 0;
  const published = byStatus.published || 0;
  const review = (byStatus.review || 0) + (byStatus.approved || 0);
  const archived = (byStatus.archived || 0) + (byStatus.deprecated || 0);

  return {
    total,
    draft,
    published,
    review,
    archived,
    byStatus,
    recent: recent.map(formatTemplate)
  };
}

/**
 * @param {object} params
 */
async function getTemplateById(params) {
  const { organizationId, templateId } = params;
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

  const draftVersion = template.draftVersionId
    ? await ContentTemplateVersion.findOne({
        _id: template.draftVersionId,
        organizationId,
        templateId: template._id
      }).lean()
    : null;

  return {
    ...formatTemplate(template),
    draftDefinition: draftVersion?.jsonDefinition || null
  };
}

/**
 * @param {object} params
 */
async function createTemplate(params) {
  const {
    organizationId,
    userId,
    payload,
    ipAddress = null
  } = params;

  const jsonDefinition = payload.jsonDefinition
    || createBlankGrapesTemplateDefinition();
  assertValidTemplateDefinition(jsonDefinition);

  const pageSettings = normalizeTemplatePageSettings(payload);

  const template = await ContentTemplate.create({
    organizationId,
    name: payload.name,
    description: payload.description || '',
    purpose: payload.purpose || '',
    category: payload.category || '',
    moduleScope: payload.moduleScope || '',
    outputFormat: payload.outputFormat || 'pdf',
    paperSize: pageSettings.paperSize,
    orientation: pageSettings.orientation,
    customPageWidth: pageSettings.customPageWidth ?? null,
    customPageHeight: pageSettings.customPageHeight ?? null,
    defaultThemeId: payload.defaultThemeId || null,
    locale: payload.locale || 'en',
    timezone: payload.timezone || 'UTC',
    currency: payload.currency || null,
    tags: Array.isArray(payload.tags) ? payload.tags : [],
    ownerId: payload.ownerId || userId,
    createdBy: userId,
    modifiedBy: userId,
    status: 'draft',
    latestVersion: 1
  });

  const version = await ContentTemplateVersion.create({
    organizationId,
    templateId: template._id,
    version: 1,
    jsonDefinition,
    published: false,
    validationStatus: 'passed',
    createdBy: userId
  });

  template.draftVersionId = version._id;
  await template.save();

  await writeContentAuditLog({
    organizationId,
    action: 'template.created',
    entityType: 'content_template',
    entityId: template._id,
    userId,
    after: formatTemplate(template),
    ipAddress
  });

  emitContentPlatformEvent(CONTENT_PLATFORM_EVENT_TYPES.TEMPLATE_CREATED, {
    entityType: 'content_template',
    entityId: template._id,
    organizationId,
    triggeredBy: userId,
    currentState: formatTemplate(template)
  });

  return getTemplateById({ organizationId, templateId: template._id });
}

/**
 * @param {object} params
 */
async function updateTemplate(params) {
  const {
    organizationId,
    templateId,
    userId,
    payload,
    ipAddress = null
  } = params;

  const template = await ContentTemplate.findOne({
    _id: templateId,
    organizationId,
    ...notDeletedFilter()
  });

  if (!template) {
    throw new ContentPlatformError(
      CONTENT_PLATFORM_ERROR_CODES.NOT_FOUND,
      'Template not found',
      { statusCode: 404 }
    );
  }

  const before = formatTemplate(template);

  const metadataFields = [
    'name',
    'description',
    'purpose',
    'category',
    'moduleScope',
    'outputFormat',
    'paperSize',
    'orientation',
    'customPageWidth',
    'customPageHeight',
    'margins',
    'defaultThemeId',
    'locale',
    'timezone',
    'currency',
    'currencyDisplay',
    'tags',
    'ownerId',
    'visibility',
    'isDefault'
  ];

  for (const field of metadataFields) {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      template[field] = payload[field];
    }
  }

  if (payload.isDefault === true && template.moduleScope && template.purpose) {
    await ContentTemplate.updateMany(
      {
        organizationId,
        moduleScope: template.moduleScope,
        purpose: template.purpose,
        isDefault: true,
        _id: { $ne: template._id },
        ...notDeletedFilter()
      },
      { $set: { isDefault: false } }
    );
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'margins') && payload.margins && typeof payload.margins === 'object') {
    const clampMargin = (value, fallback) => {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) return fallback;
      return Math.min(100, Math.max(0, Math.round(parsed)));
    };
    template.margins = {
      top: clampMargin(payload.margins.top, template.margins?.top ?? 12),
      right: clampMargin(payload.margins.right, template.margins?.right ?? 12),
      bottom: clampMargin(payload.margins.bottom, template.margins?.bottom ?? 12),
      left: clampMargin(payload.margins.left, template.margins?.left ?? 12)
    };
  }

  if (
    Object.prototype.hasOwnProperty.call(payload, 'paperSize')
    || Object.prototype.hasOwnProperty.call(payload, 'orientation')
    || Object.prototype.hasOwnProperty.call(payload, 'customPageWidth')
    || Object.prototype.hasOwnProperty.call(payload, 'customPageHeight')
  ) {
    const pageSettings = normalizeTemplatePageSettings({
      paperSize: template.paperSize,
      orientation: template.orientation,
      customPageWidth: template.customPageWidth,
      customPageHeight: template.customPageHeight
    });
    template.paperSize = pageSettings.paperSize;
    template.orientation = pageSettings.orientation;
    template.customPageWidth = pageSettings.customPageWidth ?? null;
    template.customPageHeight = pageSettings.customPageHeight ?? null;
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'jsonDefinition')) {
    assertValidTemplateDefinition(payload.jsonDefinition);

    let draftVersion = template.draftVersionId
      ? await ContentTemplateVersion.findOne({
          _id: template.draftVersionId,
          organizationId,
          templateId: template._id,
          published: false
        })
      : null;

    if (!draftVersion) {
      const nextVersion = Math.max(Number(template.latestVersion) || 0, 0) + 1;
      draftVersion = await ContentTemplateVersion.create({
        organizationId,
        templateId: template._id,
        version: nextVersion,
        jsonDefinition: payload.jsonDefinition,
        published: false,
        validationStatus: 'passed',
        createdBy: userId
      });
      template.latestVersion = nextVersion;
      template.draftVersionId = draftVersion._id;
    } else {
      draftVersion.jsonDefinition = payload.jsonDefinition;
      draftVersion.validationStatus = 'passed';
      draftVersion.createdBy = userId;
      await draftVersion.save();
    }
  }

  template.modifiedBy = userId;
  await template.save();

  const after = await getTemplateById({ organizationId, templateId: template._id });

  await writeContentAuditLog({
    organizationId,
    action: 'template.updated',
    entityType: 'content_template',
    entityId: template._id,
    userId,
    before,
    after,
    ipAddress
  });

  emitContentPlatformEvent(CONTENT_PLATFORM_EVENT_TYPES.TEMPLATE_UPDATED, {
    entityType: 'content_template',
    entityId: template._id,
    organizationId,
    triggeredBy: userId,
    previousState: before,
    currentState: after
  });

  return after;
}

/**
 * @param {object} params
 */
async function publishTemplate(params) {
  const {
    organizationId,
    templateId,
    userId,
    releaseNotes = '',
    ipAddress = null
  } = params;

  const template = await ContentTemplate.findOne({
    _id: templateId,
    organizationId,
    ...notDeletedFilter()
  });

  if (!template) {
    throw new ContentPlatformError(
      CONTENT_PLATFORM_ERROR_CODES.NOT_FOUND,
      'Template not found',
      { statusCode: 404 }
    );
  }

  const draftVersion = template.draftVersionId
    ? await ContentTemplateVersion.findOne({
        _id: template.draftVersionId,
        organizationId,
        templateId: template._id,
        published: false
      })
    : null;

  if (!draftVersion) {
    throw new ContentPlatformError(
      CONTENT_PLATFORM_ERROR_CODES.CONFLICT,
      'No draft version available to publish',
      { statusCode: 409 }
    );
  }

  const validation = validateTemplateDefinition(draftVersion.jsonDefinition);
  await ContentValidationReport.create({
    organizationId,
    templateId: template._id,
    templateVersion: draftVersion.version,
    status: validation.valid ? 'passed' : 'failed',
    validationErrors: validation.errors,
    warnings: validation.warnings,
    suggestions: validation.suggestions,
    createdBy: userId
  });

  if (!validation.valid) {
    draftVersion.validationStatus = 'failed';
    await draftVersion.save();

    emitContentPlatformEvent(CONTENT_PLATFORM_EVENT_TYPES.VALIDATION_FAILED, {
      entityType: 'content_template',
      entityId: template._id,
      organizationId,
      triggeredBy: userId,
      currentState: { templateId: template._id, errors: validation.errors }
    });

    throw new ContentPlatformError(
      CONTENT_PLATFORM_ERROR_CODES.PUBLISH_BLOCKED,
      'Template cannot be published while validation errors exist',
      { statusCode: 400, details: validation.errors }
    );
  }

  const before = formatTemplate(template);

  draftVersion.published = true;
  draftVersion.validationStatus = 'passed';
  draftVersion.releaseNotes = releaseNotes;
  draftVersion.publishedBy = userId;
  draftVersion.publishedAt = new Date();
  await draftVersion.save();

  template.status = 'published';
  template.latestPublishedVersion = draftVersion.version;
  template.modifiedBy = userId;
  template.draftVersionId = null;
  await template.save();

  const after = await getTemplateById({ organizationId, templateId: template._id });

  await writeContentAuditLog({
    organizationId,
    action: 'template.published',
    entityType: 'content_template',
    entityId: template._id,
    userId,
    before,
    after,
    metadata: { version: draftVersion.version },
    ipAddress
  });

  emitContentPlatformEvent(CONTENT_PLATFORM_EVENT_TYPES.TEMPLATE_PUBLISHED, {
    entityType: 'content_template',
    entityId: template._id,
    organizationId,
    triggeredBy: userId,
    previousState: before,
    currentState: after
  });

  emitContentPlatformEvent(CONTENT_PLATFORM_EVENT_TYPES.VALIDATION_PASSED, {
    entityType: 'content_template',
    entityId: template._id,
    organizationId,
    triggeredBy: userId,
    currentState: { templateId: template._id, version: draftVersion.version }
  });

  return {
    template: after,
    publishedVersion: draftVersion.version
  };
}

/**
 * @param {object} params
 */
async function archiveTemplate(params) {
  const { organizationId, templateId, userId, ipAddress = null } = params;

  const template = await ContentTemplate.findOne({
    _id: templateId,
    organizationId,
    ...notDeletedFilter()
  });

  if (!template) {
    throw new ContentPlatformError(
      CONTENT_PLATFORM_ERROR_CODES.NOT_FOUND,
      'Template not found',
      { statusCode: 404 }
    );
  }

  const before = formatTemplate(template);
  template.status = 'archived';
  template.modifiedBy = userId;
  await template.save();

  const after = formatTemplate(template);

  await writeContentAuditLog({
    organizationId,
    action: 'template.archived',
    entityType: 'content_template',
    entityId: template._id,
    userId,
    before,
    after,
    ipAddress
  });

  emitContentPlatformEvent(CONTENT_PLATFORM_EVENT_TYPES.TEMPLATE_ARCHIVED, {
    entityType: 'content_template',
    entityId: template._id,
    organizationId,
    triggeredBy: userId,
    previousState: before,
    currentState: after
  });

  return after;
}

/**
 * @param {object} params
 */
async function deleteTemplate(params) {
  const { organizationId, templateId, userId, ipAddress = null } = params;

  const template = await ContentTemplate.findOne({
    _id: templateId,
    organizationId,
    ...notDeletedFilter()
  });

  if (!template) {
    throw new ContentPlatformError(
      CONTENT_PLATFORM_ERROR_CODES.NOT_FOUND,
      'Template not found',
      { statusCode: 404 }
    );
  }

  const before = formatTemplate(template);
  template.deletedAt = new Date();
  template.deletedBy = userId;
  template.status = 'archived';
  template.modifiedBy = userId;
  await template.save();

  await writeContentAuditLog({
    organizationId,
    action: 'template.deleted',
    entityType: 'content_template',
    entityId: template._id,
    userId,
    before,
    after: formatTemplate(template),
    ipAddress
  });

  return { deleted: true };
}

/**
 * @param {object} params
 */
async function cloneTemplate(params) {
  const { organizationId, templateId, userId, name, ipAddress = null } = params;
  const source = await getTemplateById({ organizationId, templateId });

  return createTemplate({
    organizationId,
    userId,
    ipAddress,
    payload: {
      name: name || `${source.name} (Copy)`,
      description: source.description,
      purpose: source.purpose,
      category: source.category,
      moduleScope: source.moduleScope,
      outputFormat: source.outputFormat,
      paperSize: source.paperSize,
      orientation: source.orientation,
      customPageWidth: source.customPageWidth,
      customPageHeight: source.customPageHeight,
      defaultThemeId: source.defaultThemeId,
      locale: source.locale,
      timezone: source.timezone,
      currency: source.currency,
      currencyDisplay: source.currencyDisplay,
      tags: source.tags,
      jsonDefinition: source.draftDefinition || createBlankTemplateDefinition()
    }
  });
}

async function assertTemplateExists(organizationId, templateId) {
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

  return template;
}

/**
 * @param {object} params
 */
async function listTemplateVersions(params) {
  const { organizationId, templateId } = params;
  await assertTemplateExists(organizationId, templateId);

  const versions = await ContentTemplateVersion.find({
    organizationId,
    templateId
  })
    .sort({ version: -1 })
    .select('-jsonDefinition')
    .lean();

  return versions;
}

/**
 * @param {object} params
 */
async function getTemplateVersion(params) {
  const { organizationId, templateId, version } = params;
  await assertTemplateExists(organizationId, templateId);

  const versionDoc = await ContentTemplateVersion.findOne({
    organizationId,
    templateId,
    version: Number(version)
  }).lean();

  if (!versionDoc) {
    throw new ContentPlatformError(
      CONTENT_PLATFORM_ERROR_CODES.NOT_FOUND,
      'Template version not found',
      { statusCode: 404 }
    );
  }

  return versionDoc;
}

/**
 * @param {unknown} definition
 */
function countComponents(definition) {
  if (!definition || typeof definition !== 'object') return 0;

  let count = 1;
  const node = /** @type {{ children?: unknown[] }} */ (definition);
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      count += countComponents(child);
    }
  }
  return count;
}

/**
 * @param {object} params
 */
async function compareTemplateVersions(params) {
  const { organizationId, templateId, versionA, versionB } = params;

  const [docA, docB] = await Promise.all([
    getTemplateVersion({ organizationId, templateId, version: versionA }),
    getTemplateVersion({ organizationId, templateId, version: versionB })
  ]);

  const definitionA = JSON.stringify(docA.jsonDefinition);
  const definitionB = JSON.stringify(docB.jsonDefinition);

  return {
    versionA: {
      version: docA.version,
      published: docA.published,
      publishedAt: docA.publishedAt,
      componentCount: countComponents(docA.jsonDefinition)
    },
    versionB: {
      version: docB.version,
      published: docB.published,
      publishedAt: docB.publishedAt,
      componentCount: countComponents(docB.jsonDefinition)
    },
    definitionChanged: definitionA !== definitionB
  };
}

/**
 * @param {object} params
 */
async function restoreTemplateVersion(params) {
  const {
    organizationId,
    templateId,
    version,
    userId,
    ipAddress = null
  } = params;

  const template = await ContentTemplate.findOne({
    _id: templateId,
    organizationId,
    ...notDeletedFilter()
  });

  if (!template) {
    throw new ContentPlatformError(
      CONTENT_PLATFORM_ERROR_CODES.NOT_FOUND,
      'Template not found',
      { statusCode: 404 }
    );
  }

  const sourceVersion = await ContentTemplateVersion.findOne({
    organizationId,
    templateId,
    version: Number(version)
  }).lean();

  if (!sourceVersion) {
    throw new ContentPlatformError(
      CONTENT_PLATFORM_ERROR_CODES.NOT_FOUND,
      'Template version not found',
      { statusCode: 404 }
    );
  }

  const restoredDefinition = JSON.parse(JSON.stringify(sourceVersion.jsonDefinition));
  assertValidTemplateDefinition(restoredDefinition);

  const before = formatTemplate(template);

  let draftVersion = template.draftVersionId
    ? await ContentTemplateVersion.findOne({
        _id: template.draftVersionId,
        organizationId,
        templateId: template._id,
        published: false
      })
    : null;

  if (!draftVersion) {
    const nextVersion = Math.max(Number(template.latestVersion) || 0, 0) + 1;
    draftVersion = await ContentTemplateVersion.create({
      organizationId,
      templateId: template._id,
      version: nextVersion,
      jsonDefinition: restoredDefinition,
      published: false,
      validationStatus: 'passed',
      createdBy: userId
    });
    template.latestVersion = nextVersion;
    template.draftVersionId = draftVersion._id;
  } else {
    draftVersion.jsonDefinition = restoredDefinition;
    draftVersion.validationStatus = 'passed';
    draftVersion.createdBy = userId;
    await draftVersion.save();
  }

  if (template.status === 'published') {
    template.status = 'draft';
  }

  template.modifiedBy = userId;
  await template.save();

  const after = await getTemplateById({ organizationId, templateId: template._id });

  await writeContentAuditLog({
    organizationId,
    action: 'template.restored',
    entityType: 'content_template',
    entityId: template._id,
    userId,
    before,
    after,
    metadata: { restoredFromVersion: sourceVersion.version, draftVersion: draftVersion.version },
    ipAddress
  });

  emitContentPlatformEvent(CONTENT_PLATFORM_EVENT_TYPES.TEMPLATE_UPDATED, {
    entityType: 'content_template',
    entityId: template._id,
    organizationId,
    triggeredBy: userId,
    previousState: before,
    currentState: after
  });

  return {
    template: after,
    restoredFromVersion: sourceVersion.version,
    draftVersion: draftVersion.version
  };
}

/**
 * @param {object} params
 */
async function validateTemplate(params) {
  const { organizationId, templateId, userId, jsonDefinition } = params;

  let definition = jsonDefinition;
  if (!definition) {
    const template = await getTemplateById({ organizationId, templateId });
    definition = template.draftDefinition;
  }

  const validation = validateTemplateDefinition(definition);

  if (templateId) {
    await ContentValidationReport.create({
      organizationId,
      templateId,
      templateVersion: null,
      status: validation.valid ? 'passed' : 'failed',
      validationErrors: validation.errors,
      warnings: validation.warnings,
      suggestions: validation.suggestions,
      createdBy: userId
    });
  }

  return validation;
}

/**
 * @param {object} params
 */
async function requestRender(params) {
  const contentRenderService = require('./contentRenderService');
  return contentRenderService.renderTemplate(params);
}

module.exports = {
  listTemplates,
  getTemplateSummary,
  getTemplateById,
  createTemplate,
  updateTemplate,
  publishTemplate,
  archiveTemplate,
  deleteTemplate,
  cloneTemplate,
  listTemplateVersions,
  getTemplateVersion,
  compareTemplateVersions,
  restoreTemplateVersion,
  validateTemplate,
  requestRender
};
