'use strict';

/**
 * Control Plane authoring for PlatformAnnouncement (AA8).
 * System trial/subscription rows remain owned by systemAnnouncementService.
 */

const mongoose = require('mongoose');
const PlatformAnnouncement = require('../models/PlatformAnnouncement');
const {
  ANNOUNCEMENT_DISPLAY_TYPES,
  ANNOUNCEMENT_PRIORITIES,
  ANNOUNCEMENT_STATUSES,
} = require('../constants/announcementConstants');

class PlatformAnnouncementAdminError extends Error {
  constructor(message, statusCode = 400, code = 'PLATFORM_ANNOUNCEMENT_ERROR') {
    super(message);
    this.name = 'PlatformAnnouncementAdminError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

const SYSTEM_TEMPLATE_KEYS = new Set(['trial_expiry', 'subscription_renewal']);

const PRESETS = {
  maintenance: {
    category: 'maintenance',
    title: 'Scheduled maintenance',
    shortDescription: 'Arivu will be briefly unavailable for planned maintenance.',
    detailedDescription:
      'We are performing scheduled maintenance to keep the platform reliable. '
      + 'Some features may be unavailable during the window. Thanks for your patience.',
    displayType: 'banner',
    priority: 'high',
    targetMode: 'all',
    criticalBypassOrgMute: true,
    userBehaviour: {
      dismissible: true,
      autoCloseSeconds: 0,
      showOnce: false,
      showEveryLogin: true,
      showDaily: false,
      requireAcknowledgement: false,
    },
    ctas: [],
  },
  security: {
    category: 'security',
    title: 'Security advisory',
    shortDescription: 'Important security notice from Arivu.',
    detailedDescription:
      'Please review this security advisory and follow any required actions. '
      + 'Contact support if you need help securing your workspace.',
    displayType: 'popover',
    priority: 'critical',
    targetMode: 'all',
    criticalBypassOrgMute: true,
    userBehaviour: {
      dismissible: false,
      autoCloseSeconds: 0,
      showOnce: false,
      showEveryLogin: true,
      showDaily: false,
      requireAcknowledgement: true,
    },
    ctas: [{
      id: 'learn_more',
      label: 'Learn more',
      actionType: 'external_url',
      target: 'https://arivu.io/security',
      style: 'primary',
      sortOrder: 0,
    }],
  },
};

function assertObjectId(value, field) {
  if (!value || !mongoose.Types.ObjectId.isValid(value)) {
    throw new PlatformAnnouncementAdminError(`Invalid ${field}`, 400, 'INVALID_ID');
  }
}

function normalizeOrgIds(ids) {
  if (!Array.isArray(ids)) return [];
  const unique = [...new Set(ids.map((id) => String(id).trim()).filter(Boolean))];
  for (const id of unique) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new PlatformAnnouncementAdminError(`Invalid organization id: ${id}`, 400, 'INVALID_ORG_ID');
    }
  }
  return unique.map((id) => new mongoose.Types.ObjectId(id));
}

function isSystemOwned(doc) {
  if (!doc) return false;
  if (doc.category === 'system') return true;
  if (SYSTEM_TEMPLATE_KEYS.has(String(doc.templateKey || ''))) return true;
  const kind = String(doc.source?.kind || '');
  return kind.startsWith('system_');
}

function toAdminView(doc) {
  if (!doc) return null;
  return {
    id: String(doc._id),
    templateKey: doc.templateKey,
    category: doc.category,
    targetMode: doc.targetMode || 'organizations',
    targetOrganizationId: doc.targetOrganizationId ? String(doc.targetOrganizationId) : null,
    targetOrganizationIds: (doc.targetOrganizationIds || []).map((id) => String(id)),
    title: doc.title,
    shortDescription: doc.shortDescription || '',
    detailedDescription: doc.detailedDescription || '',
    displayType: doc.displayType,
    priority: doc.priority,
    content: doc.content || {},
    ctas: doc.ctas || [],
    schedule: {
      startAt: doc.schedule?.startAt || null,
      endAt: doc.schedule?.endAt || null,
      timezone: doc.schedule?.timezone || 'UTC',
    },
    trigger: doc.trigger || { type: 'every_login' },
    userBehaviour: doc.userBehaviour || {},
    status: doc.status,
    source: doc.source || { kind: 'manual' },
    criticalBypassOrgMute: Boolean(doc.criticalBypassOrgMute),
    isSystem: isSystemOwned(doc),
    createdBy: doc.createdBy ? String(doc.createdBy) : null,
    publishedBy: doc.publishedBy ? String(doc.publishedBy) : null,
    publishedAt: doc.publishedAt || null,
    archivedAt: doc.archivedAt || null,
    stats: doc.stats || {},
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function applyBody(doc, body, { isCreate = false } = {}) {
  if (body.title !== undefined) doc.title = String(body.title || '').trim();
  if (body.shortDescription !== undefined) doc.shortDescription = String(body.shortDescription || '').trim();
  if (body.detailedDescription !== undefined) {
    doc.detailedDescription = String(body.detailedDescription || '').trim();
  }

  if (body.displayType !== undefined) {
    if (!ANNOUNCEMENT_DISPLAY_TYPES.includes(body.displayType)) {
      throw new PlatformAnnouncementAdminError('Invalid displayType', 400, 'INVALID_DISPLAY_TYPE');
    }
    doc.displayType = body.displayType;
  }

  if (body.priority !== undefined) {
    if (!ANNOUNCEMENT_PRIORITIES.includes(body.priority)) {
      throw new PlatformAnnouncementAdminError('Invalid priority', 400, 'INVALID_PRIORITY');
    }
    doc.priority = body.priority;
  }

  if (body.category !== undefined) {
    const allowed = ['maintenance', 'security', 'product', 'general'];
    if (!allowed.includes(body.category)) {
      throw new PlatformAnnouncementAdminError('Invalid category', 400, 'INVALID_CATEGORY');
    }
    doc.category = body.category;
  } else if (isCreate && !doc.category) {
    doc.category = 'general';
  }

  if (body.targetMode !== undefined) {
    if (!['all', 'organizations'].includes(body.targetMode)) {
      throw new PlatformAnnouncementAdminError('Invalid targetMode', 400, 'INVALID_TARGET_MODE');
    }
    doc.targetMode = body.targetMode;
  }

  if (body.targetOrganizationIds !== undefined || body.targetMode !== undefined) {
    if (doc.targetMode === 'all') {
      doc.targetOrganizationIds = [];
      doc.targetOrganizationId = null;
    } else if (body.targetOrganizationIds !== undefined) {
      const ids = normalizeOrgIds(body.targetOrganizationIds || []);
      doc.targetOrganizationIds = ids;
      doc.targetOrganizationId = ids[0] || null;
    }
  }

  if (body.schedule && typeof body.schedule === 'object') {
    doc.schedule = doc.schedule || {};
    if (body.schedule.startAt !== undefined) {
      doc.schedule.startAt = body.schedule.startAt ? new Date(body.schedule.startAt) : new Date();
    }
    if (body.schedule.endAt !== undefined) {
      doc.schedule.endAt = body.schedule.endAt ? new Date(body.schedule.endAt) : null;
    }
    if (body.schedule.timezone !== undefined) {
      doc.schedule.timezone = String(body.schedule.timezone || 'UTC');
    }
  }

  if (body.userBehaviour && typeof body.userBehaviour === 'object') {
    doc.userBehaviour = {
      ...(doc.userBehaviour?.toObject?.() || doc.userBehaviour || {}),
      ...body.userBehaviour,
    };
  }

  if (body.ctas !== undefined) {
    if (!Array.isArray(body.ctas)) {
      throw new PlatformAnnouncementAdminError('ctas must be an array', 400, 'INVALID_CTAS');
    }
    doc.ctas = body.ctas.map((cta, index) => ({
      id: String(cta.id || `cta_${index + 1}`),
      label: String(cta.label || 'Open').slice(0, 40),
      actionType: cta.actionType || 'internal_route',
      target: String(cta.target || '/'),
      style: ['primary', 'secondary', 'link'].includes(cta.style) ? cta.style : 'primary',
      sortOrder: Number.isFinite(cta.sortOrder) ? cta.sortOrder : index,
    }));
  }

  if (body.criticalBypassOrgMute !== undefined) {
    doc.criticalBypassOrgMute = Boolean(body.criticalBypassOrgMute);
  }

  if (body.content && typeof body.content === 'object') {
    doc.content = { ...(doc.content?.toObject?.() || doc.content || {}), ...body.content };
  }

  if (!doc.title) {
    throw new PlatformAnnouncementAdminError('Title is required', 400, 'TITLE_REQUIRED');
  }

  doc.content = doc.content || {};
  doc.content.body = doc.shortDescription || doc.detailedDescription || doc.content.body || '';
  doc.trigger = doc.trigger || { type: 'every_login' };
}

async function listPlatformAnnouncements({
  status,
  category,
  includeSystem = false,
  page = 1,
  limit = 50,
} = {}) {
  const filter = {};
  if (status && ANNOUNCEMENT_STATUSES.includes(status)) filter.status = status;
  if (category) filter.category = category;
  if (!includeSystem && !category) {
    filter.category = { $ne: 'system' };
  }

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 50));
  const skip = (pageNum - 1) * limitNum;

  const [rows, total] = await Promise.all([
    PlatformAnnouncement.find(filter)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    PlatformAnnouncement.countDocuments(filter),
  ]);

  return {
    announcements: rows.map(toAdminView),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum) || 1,
    },
  };
}

async function getPlatformAnnouncement(id) {
  assertObjectId(id, 'id');
  const doc = await PlatformAnnouncement.findById(id).lean();
  if (!doc) {
    throw new PlatformAnnouncementAdminError('Announcement not found', 404, 'NOT_FOUND');
  }
  return toAdminView(doc);
}

async function createPlatformAnnouncement(userId, body = {}) {
  const presetKey = body.preset ? String(body.preset) : null;
  const preset = presetKey && PRESETS[presetKey] ? PRESETS[presetKey] : null;

  const id = new mongoose.Types.ObjectId();
  const doc = new PlatformAnnouncement({
    _id: id,
    templateKey: `cp_${id.toString()}`,
    category: preset?.category || 'general',
    targetMode: preset?.targetMode || 'all',
    targetOrganizationId: null,
    targetOrganizationIds: [],
    title: preset?.title || 'Untitled platform announcement',
    shortDescription: preset?.shortDescription || '',
    detailedDescription: preset?.detailedDescription || '',
    displayType: preset?.displayType || 'banner',
    priority: preset?.priority || 'high',
    ctas: preset?.ctas || [],
    userBehaviour: preset?.userBehaviour || {
      dismissible: true,
      autoCloseSeconds: 0,
      showOnce: false,
      showEveryLogin: true,
      showDaily: false,
      requireAcknowledgement: false,
    },
    schedule: {
      startAt: new Date(),
      endAt: null,
      timezone: 'UTC',
    },
    trigger: { type: 'every_login' },
    status: 'draft',
    source: { kind: 'manual', externalRef: presetKey || null },
    criticalBypassOrgMute: Boolean(preset?.criticalBypassOrgMute),
    createdBy: userId,
    publishedAt: null,
  });

  applyBody(doc, body, { isCreate: true });
  await doc.save();
  return toAdminView(doc);
}

async function updatePlatformAnnouncement(id, body = {}) {
  assertObjectId(id, 'id');
  const doc = await PlatformAnnouncement.findById(id);
  if (!doc) {
    throw new PlatformAnnouncementAdminError('Announcement not found', 404, 'NOT_FOUND');
  }
  if (isSystemOwned(doc)) {
    throw new PlatformAnnouncementAdminError(
      'System announcements are managed automatically and cannot be edited here',
      403,
      'SYSTEM_READONLY',
    );
  }
  if (['archived', 'expired'].includes(doc.status)) {
    throw new PlatformAnnouncementAdminError('Archived announcements cannot be edited', 400, 'NOT_EDITABLE');
  }

  applyBody(doc, body);
  await doc.save();
  return toAdminView(doc);
}

async function publishPlatformAnnouncement(id, userId) {
  assertObjectId(id, 'id');
  const doc = await PlatformAnnouncement.findById(id);
  if (!doc) {
    throw new PlatformAnnouncementAdminError('Announcement not found', 404, 'NOT_FOUND');
  }
  if (isSystemOwned(doc)) {
    throw new PlatformAnnouncementAdminError('System announcements cannot be published manually', 403, 'SYSTEM_READONLY');
  }
  if (doc.status === 'archived') {
    throw new PlatformAnnouncementAdminError('Cannot publish an archived announcement', 400, 'NOT_PUBLISHABLE');
  }
  if (doc.targetMode === 'organizations' && !(doc.targetOrganizationIds || []).length) {
    throw new PlatformAnnouncementAdminError(
      'Add at least one organization before publishing',
      400,
      'ORG_REQUIRED',
    );
  }

  const startAt = doc.schedule?.startAt ? new Date(doc.schedule.startAt) : new Date();
  doc.schedule = doc.schedule || {};
  doc.schedule.startAt = startAt;
  doc.status = startAt > new Date() ? 'scheduled' : 'published';
  doc.publishedBy = userId;
  doc.publishedAt = new Date();
  doc.archivedAt = null;
  await doc.save();
  return toAdminView(doc);
}

async function pausePlatformAnnouncement(id) {
  assertObjectId(id, 'id');
  const doc = await PlatformAnnouncement.findById(id);
  if (!doc) {
    throw new PlatformAnnouncementAdminError('Announcement not found', 404, 'NOT_FOUND');
  }
  if (isSystemOwned(doc)) {
    throw new PlatformAnnouncementAdminError('System announcements cannot be paused here', 403, 'SYSTEM_READONLY');
  }
  if (!['published', 'scheduled'].includes(doc.status)) {
    throw new PlatformAnnouncementAdminError('Only published or scheduled announcements can be paused', 400, 'NOT_PAUSABLE');
  }
  doc.status = 'paused';
  await doc.save();
  return toAdminView(doc);
}

async function archivePlatformAnnouncement(id) {
  assertObjectId(id, 'id');
  const doc = await PlatformAnnouncement.findById(id);
  if (!doc) {
    throw new PlatformAnnouncementAdminError('Announcement not found', 404, 'NOT_FOUND');
  }
  if (isSystemOwned(doc)) {
    throw new PlatformAnnouncementAdminError('System announcements cannot be archived here', 403, 'SYSTEM_READONLY');
  }
  doc.status = 'archived';
  doc.archivedAt = new Date();
  await doc.save();
  return toAdminView(doc);
}

function listPresets() {
  return Object.entries(PRESETS).map(([key, value]) => ({
    key,
    category: value.category,
    title: value.title,
    shortDescription: value.shortDescription,
    displayType: value.displayType,
    priority: value.priority,
    criticalBypassOrgMute: Boolean(value.criticalBypassOrgMute),
  }));
}

module.exports = {
  PlatformAnnouncementAdminError,
  PRESETS,
  listPresets,
  listPlatformAnnouncements,
  getPlatformAnnouncement,
  createPlatformAnnouncement,
  updatePlatformAnnouncement,
  publishPlatformAnnouncement,
  pausePlatformAnnouncement,
  archivePlatformAnnouncement,
  toAdminView,
};
