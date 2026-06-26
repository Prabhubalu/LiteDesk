'use strict';

const ContentTheme = require('../../models/ContentTheme');
const {
  CONTENT_PLATFORM_ERROR_CODES,
  ContentPlatformError
} = require('../../utils/contentPlatformErrors');
const { writeContentAuditLog } = require('./contentPlatformEventService');

function notDeletedFilter() {
  return { deletedAt: null };
}

function formatTheme(theme) {
  if (!theme) return theme;
  return typeof theme.toObject === 'function' ? theme.toObject() : theme;
}

function buildDefaultThemePayload(name = 'Default Theme') {
  return {
    name,
    description: 'Organization default document theme',
    status: 'draft',
    latestVersion: 1,
    colors: {
      primary: '#4f46e5',
      secondary: '#6366f1',
      text: '#111827',
      muted: '#6b7280',
      border: '#d1d5db',
      background: '#ffffff'
    },
    typography: {
      bodyFont: 'Arial, Helvetica, sans-serif',
      headingFont: 'Arial, Helvetica, sans-serif',
      baseFontSize: 12,
      headingScale: 1.25
    },
    tables: {
      headerBackground: '#f9fafb',
      borderColor: '#d1d5db',
      cellPadding: 8
    },
    headers: {
      default: { html: '' }
    },
    footers: {
      default: { html: '' }
    },
    watermark: {
      text: '',
      opacity: 0.15
    }
  };
}

function validateThemePayload(payload, { partial = false } = {}) {
  const issues = [];

  if (!partial || payload.name != null) {
    if (!payload.name || typeof payload.name !== 'string' || !payload.name.trim()) {
      issues.push({ path: 'name', message: 'Theme name is required' });
    }
  }

  if (payload.colors != null && (typeof payload.colors !== 'object' || Array.isArray(payload.colors))) {
    issues.push({ path: 'colors', message: 'Theme colors must be an object' });
  }

  if (payload.typography != null && (typeof payload.typography !== 'object' || Array.isArray(payload.typography))) {
    issues.push({ path: 'typography', message: 'Theme typography must be an object' });
  }

  return {
    valid: issues.length === 0,
    errors: issues
  };
}

async function listThemes(params) {
  const {
    organizationId,
    page = 1,
    limit = 20,
    status,
    search
  } = params;

  const query = {
    organizationId,
    ...notDeletedFilter()
  };

  if (status) query.status = status;
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }

  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const safePage = Math.max(Number(page) || 1, 1);
  const skip = (safePage - 1) * safeLimit;

  const [items, total] = await Promise.all([
    ContentTheme.find(query).sort({ updatedAt: -1 }).skip(skip).limit(safeLimit).lean(),
    ContentTheme.countDocuments(query)
  ]);

  return {
    items: items.map(formatTheme),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit) || 1
    }
  };
}

async function getThemeById(params) {
  const { organizationId, themeId } = params;
  const theme = await ContentTheme.findOne({
    _id: themeId,
    organizationId,
    ...notDeletedFilter()
  }).lean();

  if (!theme) {
    throw new ContentPlatformError(
      CONTENT_PLATFORM_ERROR_CODES.NOT_FOUND,
      'Theme not found',
      { statusCode: 404 }
    );
  }

  return formatTheme(theme);
}

async function createTheme(params) {
  const { organizationId, userId, payload = {}, ipAddress = null } = params;
  const merged = {
    ...buildDefaultThemePayload(),
    ...payload,
    organizationId,
    createdBy: userId,
    modifiedBy: userId
  };

  const validation = validateThemePayload(merged);
  if (!validation.valid) {
    throw new ContentPlatformError(
      CONTENT_PLATFORM_ERROR_CODES.VALIDATION_FAILED,
      'Theme validation failed',
      { statusCode: 400, details: validation.errors }
    );
  }

  const theme = await ContentTheme.create(merged);

  await writeContentAuditLog({
    organizationId,
    action: 'theme.created',
    entityType: 'content_theme',
    entityId: theme._id,
    userId,
    after: formatTheme(theme),
    ipAddress
  });

  return formatTheme(theme);
}

async function updateTheme(params) {
  const { organizationId, themeId, userId, payload = {}, ipAddress = null } = params;

  const theme = await ContentTheme.findOne({
    _id: themeId,
    organizationId,
    ...notDeletedFilter()
  });

  if (!theme) {
    throw new ContentPlatformError(
      CONTENT_PLATFORM_ERROR_CODES.NOT_FOUND,
      'Theme not found',
      { statusCode: 404 }
    );
  }

  const validation = validateThemePayload(payload, { partial: true });
  if (!validation.valid) {
    throw new ContentPlatformError(
      CONTENT_PLATFORM_ERROR_CODES.VALIDATION_FAILED,
      'Theme validation failed',
      { statusCode: 400, details: validation.errors }
    );
  }

  const before = formatTheme(theme);
  const allowed = [
    'name',
    'description',
    'colors',
    'typography',
    'tables',
    'charts',
    'headers',
    'footers',
    'watermark'
  ];

  for (const key of allowed) {
    if (payload[key] !== undefined) {
      theme[key] = payload[key];
    }
  }

  theme.modifiedBy = userId;
  theme.latestVersion = (theme.latestVersion || 1) + 1;
  await theme.save();

  const after = formatTheme(theme);

  await writeContentAuditLog({
    organizationId,
    action: 'theme.updated',
    entityType: 'content_theme',
    entityId: theme._id,
    userId,
    before,
    after,
    ipAddress
  });

  return after;
}

async function publishTheme(params) {
  const { organizationId, themeId, userId, ipAddress = null } = params;

  const theme = await ContentTheme.findOne({
    _id: themeId,
    organizationId,
    ...notDeletedFilter()
  });

  if (!theme) {
    throw new ContentPlatformError(
      CONTENT_PLATFORM_ERROR_CODES.NOT_FOUND,
      'Theme not found',
      { statusCode: 404 }
    );
  }

  const validation = validateThemePayload(formatTheme(theme));
  if (!validation.valid) {
    throw new ContentPlatformError(
      CONTENT_PLATFORM_ERROR_CODES.PUBLISH_BLOCKED,
      'Theme cannot be published while validation errors exist',
      { statusCode: 400, details: validation.errors }
    );
  }

  const before = formatTheme(theme);
  theme.status = 'published';
  theme.modifiedBy = userId;
  await theme.save();

  const after = formatTheme(theme);

  await writeContentAuditLog({
    organizationId,
    action: 'theme.published',
    entityType: 'content_theme',
    entityId: theme._id,
    userId,
    before,
    after,
    ipAddress
  });

  return after;
}

async function archiveTheme(params) {
  const { organizationId, themeId, userId, ipAddress = null } = params;

  const theme = await ContentTheme.findOne({
    _id: themeId,
    organizationId,
    ...notDeletedFilter()
  });

  if (!theme) {
    throw new ContentPlatformError(
      CONTENT_PLATFORM_ERROR_CODES.NOT_FOUND,
      'Theme not found',
      { statusCode: 404 }
    );
  }

  const before = formatTheme(theme);
  theme.status = 'archived';
  theme.modifiedBy = userId;
  await theme.save();

  await writeContentAuditLog({
    organizationId,
    action: 'theme.updated',
    entityType: 'content_theme',
    entityId: theme._id,
    userId,
    before,
    after: formatTheme(theme),
    metadata: { archived: true },
    ipAddress
  });

  return formatTheme(theme);
}

async function deleteTheme(params) {
  const { organizationId, themeId, userId, ipAddress = null } = params;

  const theme = await ContentTheme.findOne({
    _id: themeId,
    organizationId,
    ...notDeletedFilter()
  });

  if (!theme) {
    throw new ContentPlatformError(
      CONTENT_PLATFORM_ERROR_CODES.NOT_FOUND,
      'Theme not found',
      { statusCode: 404 }
    );
  }

  const before = formatTheme(theme);
  theme.deletedAt = new Date();
  theme.modifiedBy = userId;
  await theme.save();

  await writeContentAuditLog({
    organizationId,
    action: 'theme.updated',
    entityType: 'content_theme',
    entityId: theme._id,
    userId,
    before,
    metadata: { deleted: true },
    ipAddress
  });

  return { id: theme._id, deleted: true };
}

module.exports = {
  buildDefaultThemePayload,
  validateThemePayload,
  listThemes,
  getThemeById,
  createTheme,
  updateTheme,
  publishTheme,
  archiveTheme,
  deleteTheme
};
