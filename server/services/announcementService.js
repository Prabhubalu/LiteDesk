'use strict';

const { randomUUID } = require('crypto');
const Announcement = require('../models/Announcement');
const AnnouncementUserState = require('../models/AnnouncementUserState');
const {
  ANNOUNCEMENT_DISPLAY_TYPES,
  ANNOUNCEMENT_PRIORITIES,
  ANNOUNCEMENT_TRIGGERS,
} = require('../constants/announcementConstants');
const {
  buildAudienceContext,
  matchesAudience,
} = require('./announcementTargetingService');
const { shouldShowByCadence } = require('./announcementCadenceService');
const Role = require('../models/Role');
const Group = require('../models/Group');
const User = require('../models/User');
const { writeEvent } = require('./announcementAnalyticsService');
const systemAnnouncementService = require('./systemAnnouncementService');
const {
  emitAnnouncementPublished,
  emitAnnouncementAcknowledged,
  emitAnnouncementCtaClicked,
} = require('./announcementEventService');

const PRIORITY_RANK_MERGE = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  information: 4,
};

function pickHigherPriority(a, b) {
  if (!a) return b;
  if (!b) return a;
  const ra = PRIORITY_RANK_MERGE[a.priority] ?? 9;
  const rb = PRIORITY_RANK_MERGE[b.priority] ?? 9;
  return ra <= rb ? a : b;
}

class AnnouncementServiceError extends Error {
  constructor(message, code = 'ANNOUNCEMENT_ERROR', statusCode = 400) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

function isSafeMediaUrl(value) {
  if (value == null) return false;
  const raw = String(value).trim();
  if (!raw || raw.length > 2000) return false;
  if (raw.startsWith('/') && !raw.startsWith('//')) return true;
  try {
    const url = new URL(raw);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizeYoutubeUrl(value) {
  if (value == null || value === '') return null;
  const raw = String(value).trim().slice(0, 500);
  if (!raw) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) {
    return `https://www.youtube.com/watch?v=${raw}`;
  }
  if (!isSafeMediaUrl(raw)) {
    throw new AnnouncementServiceError('Invalid YouTube URL', 'INVALID_YOUTUBE_URL', 400);
  }
  if (!/(youtube\.com|youtu\.be|youtube-nocookie\.com)/i.test(raw)) {
    throw new AnnouncementServiceError('YouTube URL must be a youtube.com or youtu.be link', 'INVALID_YOUTUBE_URL', 400);
  }
  return raw;
}

function normalizeAttachments(list) {
  if (!Array.isArray(list)) return [];
  return list
    .slice(0, 5)
    .map((item) => {
      const url = item?.url != null ? String(item.url).trim() : '';
      if (!isSafeMediaUrl(url)) return null;
      const size = Number(item?.size);
      return {
        name: String(item?.name || '').trim().slice(0, 200),
        url: url.slice(0, 2000),
        mime: item?.mime != null ? String(item.mime).trim().slice(0, 120) : null,
        size: Number.isFinite(size) && size >= 0 ? size : null,
      };
    })
    .filter(Boolean);
}

function normalizeContent(payload) {
  const imageRaw = payload?.content?.imageUrl;
  const imageUrl = imageRaw == null || imageRaw === ''
    ? null
    : (isSafeMediaUrl(imageRaw)
      ? String(imageRaw).trim().slice(0, 2000)
      : (() => { throw new AnnouncementServiceError('Invalid image URL', 'INVALID_IMAGE_URL', 400); })());

  return {
    body: String(payload?.content?.body || payload.detailedDescription || ''),
    imageUrl,
    icon: payload?.content?.icon != null
      ? String(payload.content.icon).trim().slice(0, 80) || null
      : null,
    youtubeUrl: normalizeYoutubeUrl(payload?.content?.youtubeUrl),
    attachments: normalizeAttachments(payload?.content?.attachments),
  };
}

const PRIORITY_RANK = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  information: 4,
};

function normalizeCtas(ctas) {
  if (!Array.isArray(ctas)) return [];
  return ctas.slice(0, 3).map((cta, index) => ({
    id: String(cta.id || randomUUID()),
    label: String(cta.label || '').trim().slice(0, 40),
    actionType: cta.actionType || 'internal_route',
    target: String(cta.target || '').trim().slice(0, 2000),
    style: cta.style || (index === 0 ? 'primary' : 'secondary'),
    sortOrder: Number.isFinite(cta.sortOrder) ? cta.sortOrder : index,
  })).filter((cta) => cta.label && cta.target);
}

function assertCreatePayload(payload) {
  const title = String(payload?.title || '').trim();
  if (!title) {
    throw new AnnouncementServiceError('Title is required', 'TITLE_REQUIRED');
  }
  if (!ANNOUNCEMENT_DISPLAY_TYPES.includes(payload?.displayType)) {
    throw new AnnouncementServiceError('Display type is required', 'DISPLAY_TYPE_REQUIRED');
  }
  const audienceMode = payload?.audience?.mode || 'everyone';
  if (audienceMode === 'segment') {
    const segments = payload?.audience?.segments;
    if (!Array.isArray(segments) || segments.length === 0) {
      throw new AnnouncementServiceError('At least one audience segment is required', 'AUDIENCE_REQUIRED');
    }
  }
  const startAt = payload?.schedule?.startAt
    ? new Date(payload.schedule.startAt)
    : new Date();
  if (Number.isNaN(startAt.getTime())) {
    throw new AnnouncementServiceError('Start date is required', 'START_REQUIRED');
  }
  const publishImmediately = payload?.schedule?.publishImmediately !== false;
  const endAt = payload?.schedule?.endAt ? new Date(payload.schedule.endAt) : null;
  if (!publishImmediately && !endAt) {
    throw new AnnouncementServiceError(
      'End date is required for scheduled announcements',
      'END_REQUIRED',
    );
  }
  return { title, startAt, endAt, publishImmediately, audienceMode };
}

function buildDocFromPayload(payload, { organizationId, userId, status }) {
  const { title, startAt, endAt, publishImmediately, audienceMode } = assertCreatePayload(payload);
  const priority = ANNOUNCEMENT_PRIORITIES.includes(payload.priority)
    ? payload.priority
    : 'medium';
  const triggerType = ANNOUNCEMENT_TRIGGERS.includes(payload?.trigger?.type)
    ? payload.trigger.type
    : (publishImmediately ? 'immediate' : 'scheduled');

  return {
    organizationId,
    title,
    shortDescription: String(payload.shortDescription || '').trim().slice(0, 500),
    detailedDescription: String(payload.detailedDescription || payload?.content?.body || ''),
    category: String(payload.category || '').trim().slice(0, 80),
    tags: Array.isArray(payload.tags) ? payload.tags.map(String).slice(0, 20) : [],
    displayType: payload.displayType,
    priority,
    content: normalizeContent(payload),
    ctas: normalizeCtas(payload.ctas),
    audience: {
      mode: audienceMode,
      segments: audienceMode === 'everyone' ? [] : (payload.audience?.segments || []),
    },
    trigger: { type: triggerType },
    schedule: {
      publishImmediately,
      startAt,
      endAt,
      timezone: String(payload?.schedule?.timezone || 'UTC'),
    },
    userBehaviour: {
      dismissible: payload?.userBehaviour?.dismissible !== false,
      stickyBanner: payload?.userBehaviour?.stickyBanner === true,
      autoCloseSeconds: payload?.userBehaviour?.autoCloseSeconds ?? null,
      showOnce: payload?.userBehaviour?.showOnce === true,
      showEveryLogin: payload?.userBehaviour?.showEveryLogin === true,
      showDaily: payload?.userBehaviour?.showDaily === true,
      requireAcknowledgement: payload?.userBehaviour?.requireAcknowledgement === true,
    },
    status,
    source: {
      kind: payload?.source?.kind || 'manual',
      externalRef: payload?.source?.externalRef || null,
    },
    createdBy: userId,
    modifiedBy: userId,
  };
}

function isInActiveWindow(doc, now = new Date()) {
  if (doc.status !== 'published') return false;
  const start = doc.schedule?.startAt ? new Date(doc.schedule.startAt) : null;
  const end = doc.schedule?.endAt ? new Date(doc.schedule.endAt) : null;
  if (start && start > now) return false;
  if (end && end <= now) return false;
  return true;
}

function toAdminListItem(doc) {
  const now = new Date();
  const active = isInActiveWindow(doc, now);
  return {
    id: String(doc._id),
    title: doc.title,
    shortDescription: doc.shortDescription,
    displayType: doc.displayType,
    priority: doc.priority,
    status: doc.status,
    effectiveStatus: active ? 'active' : doc.status,
    audience: doc.audience,
    trigger: doc.trigger,
    schedule: doc.schedule,
    createdBy: doc.createdBy,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    publishedAt: doc.publishedAt,
    stats: doc.stats,
  };
}

function toViewModel(doc) {
  const content = doc.content?.toObject?.() || doc.content || {};
  return {
    id: String(doc._id),
    title: doc.title,
    shortDescription: doc.shortDescription,
    detailedDescription: doc.detailedDescription,
    displayType: doc.displayType,
    priority: doc.priority,
    content: {
      body: content.body || '',
      imageUrl: content.imageUrl || null,
      icon: content.icon || null,
      youtubeUrl: content.youtubeUrl || null,
      attachments: Array.isArray(content.attachments)
        ? content.attachments.map((file) => ({
          name: file?.name || '',
          url: file?.url || '',
          mime: file?.mime || null,
          size: file?.size ?? null,
        })).filter((file) => file.url)
        : [],
    },
    ctas: (doc.ctas || []).slice().sort((a, b) => a.sortOrder - b.sortOrder).map((cta) => ({
      id: cta.id,
      label: cta.label,
      actionType: cta.actionType,
      target: cta.target,
      style: cta.style || 'link',
      sortOrder: cta.sortOrder,
    })),
    userBehaviour: doc.userBehaviour,
    schedule: {
      startAt: doc.schedule?.startAt,
      endAt: doc.schedule?.endAt,
      timezone: doc.schedule?.timezone,
    },
    ownership: { scope: 'organization' },
  };
}

function userShouldSee(doc, state, now = new Date(), opts = {}) {
  if (!isInActiveWindow(doc, now)) return false;
  return shouldShowByCadence(doc, state, now, opts);
}

async function listAnnouncements(organizationId, query = {}) {
  const filter = { organizationId };
  if (query.status) filter.status = query.status;
  if (query.displayType) filter.displayType = query.displayType;
  if (query.priority) filter.priority = query.priority;

  const rows = await Announcement.find(filter)
    .sort({ updatedAt: -1 })
    .limit(Math.min(Number(query.limit) || 50, 100))
    .lean();

  let items = rows.map(toAdminListItem);
  if (query.active === 'true') {
    items = items.filter((row) => row.effectiveStatus === 'active');
  }
  if (query.expired === 'true') {
    items = items.filter((row) => row.status === 'expired');
  }
  return { items };
}

async function getAnnouncement(organizationId, id) {
  const doc = await Announcement.findOne({ _id: id, organizationId }).lean();
  if (!doc) {
    throw new AnnouncementServiceError('Announcement not found', 'NOT_FOUND', 404);
  }
  return { ...doc, id: String(doc._id), effectiveStatus: isInActiveWindow(doc) ? 'active' : doc.status };
}

async function createAnnouncement({ organizationId, userId, payload, publish = false }) {
  const now = new Date();
  const { startAt, publishImmediately } = assertCreatePayload(payload);
  let status = 'draft';
  if (publish) {
    status = (!publishImmediately && startAt > now) ? 'scheduled' : 'published';
  }

  const data = buildDocFromPayload(payload, { organizationId, userId, status });
  if (status === 'published') {
    data.publishedAt = now;
    data.publishedBy = userId;
  }

  const created = await Announcement.create(data);
  const result = await getAnnouncement(organizationId, created._id);
  if (status === 'published') {
    emitAnnouncementPublished({
      organizationId,
      announcementId: created._id,
      triggeredBy: userId,
      announcement: result,
    });
  }
  return result;
}

async function updateAnnouncement({ organizationId, userId, id, payload }) {
  const existing = await Announcement.findOne({ _id: id, organizationId });
  if (!existing) {
    throw new AnnouncementServiceError('Announcement not found', 'NOT_FOUND', 404);
  }
  if (existing.status === 'published') {
    throw new AnnouncementServiceError(
      'Pause the announcement before editing',
      'LIVE_LOCKED',
    );
  }
  if (['archived', 'expired'].includes(existing.status)) {
    throw new AnnouncementServiceError('Cannot edit archived or expired announcements', 'IMMUTABLE');
  }

  const data = buildDocFromPayload(
    { ...existing.toObject(), ...payload, schedule: { ...existing.schedule?.toObject?.() || existing.schedule, ...payload.schedule } },
    { organizationId, userId, status: existing.status },
  );
  delete data.createdBy;
  delete data.status;
  delete data.publishedAt;
  delete data.publishedBy;

  Object.assign(existing, data);
  existing.modifiedBy = userId;
  await existing.save();
  return getAnnouncement(organizationId, id);
}

async function publishAnnouncement({ organizationId, userId, id }) {
  const doc = await Announcement.findOne({ _id: id, organizationId });
  if (!doc) {
    throw new AnnouncementServiceError('Announcement not found', 'NOT_FOUND', 404);
  }
  if (doc.status === 'archived') {
    throw new AnnouncementServiceError('Cannot publish archived announcement', 'INVALID_STATUS');
  }

  const now = new Date();
  const startAt = doc.schedule?.startAt ? new Date(doc.schedule.startAt) : now;
  const scheduled = doc.schedule?.publishImmediately === false && startAt > now;

  doc.status = scheduled ? 'scheduled' : 'published';
  if (!scheduled) {
    doc.publishedAt = now;
    doc.publishedBy = userId;
  }
  doc.modifiedBy = userId;
  await doc.save();
  const result = await getAnnouncement(organizationId, id);
  if (doc.status === 'published') {
    emitAnnouncementPublished({
      organizationId,
      announcementId: id,
      triggeredBy: userId,
      announcement: result,
    });
  }
  return result;
}

async function pauseAnnouncement({ organizationId, userId, id }) {
  const doc = await Announcement.findOne({ _id: id, organizationId });
  if (!doc) {
    throw new AnnouncementServiceError('Announcement not found', 'NOT_FOUND', 404);
  }
  if (doc.status !== 'published') {
    throw new AnnouncementServiceError('Only published announcements can be paused', 'INVALID_STATUS');
  }
  doc.status = 'paused';
  doc.pausedAt = new Date();
  doc.modifiedBy = userId;
  await doc.save();
  return getAnnouncement(organizationId, id);
}

async function resumeAnnouncement({ organizationId, userId, id }) {
  const doc = await Announcement.findOne({ _id: id, organizationId });
  if (!doc) {
    throw new AnnouncementServiceError('Announcement not found', 'NOT_FOUND', 404);
  }
  if (doc.status !== 'paused') {
    throw new AnnouncementServiceError('Only paused announcements can be resumed', 'INVALID_STATUS');
  }
  doc.status = 'published';
  doc.resumedAt = new Date();
  doc.modifiedBy = userId;
  await doc.save();
  return getAnnouncement(organizationId, id);
}

async function archiveAnnouncement({ organizationId, userId, id }) {
  const doc = await Announcement.findOne({ _id: id, organizationId });
  if (!doc) {
    throw new AnnouncementServiceError('Announcement not found', 'NOT_FOUND', 404);
  }
  doc.status = 'archived';
  doc.archivedAt = new Date();
  doc.archivedBy = userId;
  doc.modifiedBy = userId;
  await doc.save();
  return getAnnouncement(organizationId, id);
}

async function duplicateAnnouncement({ organizationId, userId, id }) {
  const source = await Announcement.findOne({ _id: id, organizationId }).lean();
  if (!source) {
    throw new AnnouncementServiceError('Announcement not found', 'NOT_FOUND', 404);
  }
  const endAt = source.schedule?.endAt || null;
  // Drafts: keep open-ended schedule valid (assertCreatePayload requires endAt when not immediate).
  const publishImmediately = endAt
    ? source.schedule?.publishImmediately === true
    : true;

  return createAnnouncement({
    organizationId,
    userId,
    payload: {
      title: `Copy of ${source.title}`.slice(0, 200),
      shortDescription: source.shortDescription,
      detailedDescription: source.detailedDescription,
      category: source.category,
      tags: source.tags,
      displayType: source.displayType,
      priority: source.priority,
      content: source.content,
      ctas: (source.ctas || []).map(({ id: _ctaId, ...cta }) => cta),
      audience: source.audience,
      trigger: source.trigger,
      schedule: {
        publishImmediately,
        startAt: source.schedule?.startAt || new Date(),
        endAt,
        timezone: source.schedule?.timezone || 'UTC',
      },
      userBehaviour: source.userBehaviour,
      source: { kind: 'manual', externalRef: null },
    },
    publish: false,
  });
}

async function deleteAnnouncement({ organizationId, id }) {
  const doc = await Announcement.findOne({ _id: id, organizationId });
  if (!doc) {
    throw new AnnouncementServiceError('Announcement not found', 'NOT_FOUND', 404);
  }
  if (doc.status !== 'draft') {
    throw new AnnouncementServiceError('Only drafts can be deleted; archive instead', 'INVALID_STATUS');
  }
  await Announcement.deleteOne({ _id: id, organizationId });
  return { deleted: true };
}

async function getActiveForUser({ organizationId, user, surface = 'web_app' }) {
  const userId = user?._id;
  if (!userId) {
    return { banner: null, popover: null };
  }

  const now = new Date();
  const audienceCtx = await buildAudienceContext(user, { surface });
  const cadenceOpts = { lastLogin: user?.lastLogin || null };

  const candidates = await Announcement.find({
    organizationId,
    status: 'published',
    'schedule.startAt': { $lte: now },
    $or: [
      { 'schedule.endAt': null },
      { 'schedule.endAt': { $gt: now } },
    ],
  }).lean();

  const audienceMatched = candidates.filter((doc) => matchesAudience(doc, audienceCtx));

  const ids = audienceMatched.map((row) => row._id);
  const states = ids.length
    ? await AnnouncementUserState.find({
      organizationId,
      userId,
      announcementId: { $in: ids },
    }).lean()
    : [];
  const stateById = new Map(states.map((s) => [String(s.announcementId), s]));

  const visible = audienceMatched
    .filter((doc) => userShouldSee(doc, stateById.get(String(doc._id)), now, cadenceOpts))
    .sort((a, b) => {
      const pr = (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9);
      if (pr !== 0) return pr;
      return new Date(b.schedule?.startAt || 0) - new Date(a.schedule?.startAt || 0);
    });

  const orgBanner = visible.find((d) => d.displayType === 'banner') || null;
  const orgPopover = visible.find((d) => d.displayType === 'popover') || null;

  const platform = await systemAnnouncementService.getActivePlatformForUser({
    organizationId,
    user,
  });

  return {
    banner: pickHigherPriority(
      orgBanner ? toViewModel(orgBanner) : null,
      platform.banner,
    ),
    popover: pickHigherPriority(
      orgPopover ? toViewModel(orgPopover) : null,
      platform.popover,
    ),
  };
}

/** Runtime for orgs without the addon — platform/system banners only. */
async function getActivePlatformOnlyForUser({ organizationId, user }) {
  return systemAnnouncementService.getActivePlatformForUser({ organizationId, user });
}

async function getAudienceOptions(organizationId) {
  const [roles, groups, users] = await Promise.all([
    Role.find({ organizationId }).select('_id name').sort({ name: 1 }).lean(),
    Group.find({ organizationId }).select('_id name').sort({ name: 1 }).lean(),
    User.find({
      organizationId,
      $or: [{ status: 'active' }, { status: { $exists: false } }, { status: null }],
    })
      .select('_id firstName lastName email userType')
      .sort({ firstName: 1, lastName: 1 })
      .limit(200)
      .lean(),
  ]);

  return {
    userTypes: [
      { value: 'INTERNAL', label: 'Internal users' },
      { value: 'EXTERNAL', label: 'External / portal users' },
    ],
    roles: roles.map((r) => ({ id: String(r._id), name: r.name })),
    teams: groups.map((g) => ({ id: String(g._id), name: g.name })),
    users: users.map((u) => ({
      id: String(u._id),
      name: [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email || String(u._id),
      email: u.email || '',
      userType: u.userType || 'INTERNAL',
    })),
  };
}

async function ensureUserState({ organizationId, userId, announcementId }) {
  let state = await AnnouncementUserState.findOne({ organizationId, userId, announcementId });
  if (!state) {
    state = await AnnouncementUserState.create({
      organizationId,
      userId,
      announcementId,
    });
  }
  return state;
}

function eventMeta(meta = {}) {
  return {
    surface: meta.surface || 'web_app',
    deviceType: meta.deviceType || null,
    platform: meta.platform || null,
  };
}

async function recordPlatformInteraction({
  organizationId,
  userId,
  announcementId,
  type,
  ctaId,
  meta,
}) {
  const doc = await systemAnnouncementService.findPlatformForOrg(organizationId, announcementId);
  if (!doc) return null;

  if (type === 'dismiss' && doc.userBehaviour?.dismissible === false) {
    throw new AnnouncementServiceError('This announcement cannot be dismissed', 'NOT_DISMISSIBLE', 403);
  }

  const state = await systemAnnouncementService.ensurePlatformUserState({
    organizationId,
    userId,
    announcementId,
  });
  const now = new Date();

  if (type === 'view') {
    if (!state.firstViewedAt) state.firstViewedAt = now;
    state.lastViewedAt = now;
    state.lastShownAt = now;
    state.viewCount = (state.viewCount || 0) + 1;
    await state.save();
    await PlatformAnnouncementStatsInc(doc._id, { views: 1, reads: 1 });
    return { ok: true, platform: true };
  }
  if (type === 'dismiss') {
    state.dismissedAt = now;
    await state.save();
    await PlatformAnnouncementStatsInc(doc._id, { dismissals: 1 });
    return { ok: true, platform: true };
  }
  if (type === 'acknowledge') {
    state.acknowledgedAt = now;
    if (doc.userBehaviour?.dismissible !== false) {
      state.dismissedAt = state.dismissedAt || now;
    }
    await state.save();
    await PlatformAnnouncementStatsInc(doc._id, { acknowledgements: 1 });
    return { ok: true, platform: true };
  }
  if (type === 'cta_click') {
    const cta = (doc.ctas || []).find((row) => row.id === ctaId);
    if (!cta) {
      throw new AnnouncementServiceError('CTA not found', 'CTA_NOT_FOUND', 404);
    }
    const existing = (state.ctaClicks || []).find((row) => row.ctaId === ctaId);
    if (existing) {
      existing.count += 1;
      existing.clickedAt = now;
    } else {
      state.ctaClicks.push({ ctaId, clickedAt: now, count: 1 });
    }
    await state.save();
    await PlatformAnnouncementStatsInc(doc._id, { ctaClicks: 1 });
    return { ok: true, platform: true, target: cta.target, actionType: cta.actionType };
  }
  return { ok: true, platform: true };
}

async function PlatformAnnouncementStatsInc(id, fields) {
  const PlatformAnnouncement = require('../models/PlatformAnnouncement');
  const inc = {};
  for (const [key, value] of Object.entries(fields)) {
    inc[`stats.${key}`] = value;
  }
  await PlatformAnnouncement.updateOne({ _id: id }, { $inc: inc });
}

async function recordView({ organizationId, userId, announcementId, meta }) {
  const doc = await Announcement.findOne({ _id: announcementId, organizationId });
  if (!doc || !isInActiveWindow(doc)) {
    const platformResult = await recordPlatformInteraction({
      organizationId,
      userId,
      announcementId,
      type: 'view',
      meta,
    });
    if (platformResult) return platformResult;
    throw new AnnouncementServiceError('Announcement not available', 'NOT_AVAILABLE', 404);
  }
  const state = await ensureUserState({ organizationId, userId, announcementId });
  const now = new Date();
  if (!state.firstViewedAt) state.firstViewedAt = now;
  state.lastViewedAt = now;
  state.lastShownAt = now;
  state.viewCount = (state.viewCount || 0) + 1;
  await state.save();
  await Announcement.updateOne({ _id: announcementId }, { $inc: { 'stats.views': 1, 'stats.reads': 1 } });
  const context = eventMeta(meta);
  await writeEvent({
    organizationId,
    announcementId,
    userId,
    type: 'view',
    ...context,
  });
  await writeEvent({
    organizationId,
    announcementId,
    userId,
    type: 'read',
    ...context,
  });
  return { ok: true };
}

async function recordDismiss({ organizationId, userId, announcementId, meta }) {
  const doc = await Announcement.findOne({ _id: announcementId, organizationId });
  if (!doc) {
    const platformResult = await recordPlatformInteraction({
      organizationId,
      userId,
      announcementId,
      type: 'dismiss',
      meta,
    });
    if (platformResult) return platformResult;
    throw new AnnouncementServiceError('Announcement not found', 'NOT_FOUND', 404);
  }
  if (doc.userBehaviour?.dismissible === false) {
    throw new AnnouncementServiceError('This announcement cannot be dismissed', 'NOT_DISMISSIBLE', 403);
  }
  const state = await ensureUserState({ organizationId, userId, announcementId });
  state.dismissedAt = new Date();
  await state.save();
  await Announcement.updateOne({ _id: announcementId }, { $inc: { 'stats.dismissals': 1 } });
  await writeEvent({
    organizationId,
    announcementId,
    userId,
    type: 'dismiss',
    ...eventMeta(meta),
  });
  return { ok: true };
}

async function recordAcknowledge({ organizationId, userId, announcementId, meta }) {
  const doc = await Announcement.findOne({ _id: announcementId, organizationId });
  if (!doc) {
    const platformResult = await recordPlatformInteraction({
      organizationId,
      userId,
      announcementId,
      type: 'acknowledge',
      meta,
    });
    if (platformResult) return platformResult;
    throw new AnnouncementServiceError('Announcement not found', 'NOT_FOUND', 404);
  }
  const state = await ensureUserState({ organizationId, userId, announcementId });
  state.acknowledgedAt = new Date();
  if (doc.userBehaviour?.dismissible !== false) {
    state.dismissedAt = state.dismissedAt || state.acknowledgedAt;
  }
  await state.save();
  await Announcement.updateOne({ _id: announcementId }, { $inc: { 'stats.acknowledgements': 1 } });
  await writeEvent({
    organizationId,
    announcementId,
    userId,
    type: 'acknowledge',
    ...eventMeta(meta),
  });
  emitAnnouncementAcknowledged({ organizationId, announcementId, userId });
  return { ok: true };
}

async function recordCtaClick({ organizationId, userId, announcementId, ctaId, meta }) {
  const doc = await Announcement.findOne({ _id: announcementId, organizationId }).lean();
  if (!doc) {
    const platformResult = await recordPlatformInteraction({
      organizationId,
      userId,
      announcementId,
      type: 'cta_click',
      ctaId,
      meta,
    });
    if (platformResult) return platformResult;
    throw new AnnouncementServiceError('Announcement not found', 'NOT_FOUND', 404);
  }
  const cta = (doc.ctas || []).find((row) => row.id === ctaId);
  if (!cta) {
    throw new AnnouncementServiceError('CTA not found', 'CTA_NOT_FOUND', 404);
  }
  const state = await ensureUserState({ organizationId, userId, announcementId });
  const existing = (state.ctaClicks || []).find((row) => row.ctaId === ctaId);
  if (existing) {
    existing.count += 1;
    existing.clickedAt = new Date();
  } else {
    state.ctaClicks.push({ ctaId, clickedAt: new Date(), count: 1 });
  }
  await state.save();
  await Announcement.updateOne({ _id: announcementId }, { $inc: { 'stats.ctaClicks': 1 } });
  await writeEvent({
    organizationId,
    announcementId,
    userId,
    type: 'cta_click',
    ctaId,
    ...eventMeta(meta),
  });
  emitAnnouncementCtaClicked({ organizationId, announcementId, userId, ctaId });
  return { ok: true, target: cta.target, actionType: cta.actionType };
}

module.exports = {
  AnnouncementServiceError,
  listAnnouncements,
  getAnnouncement,
  createAnnouncement,
  updateAnnouncement,
  publishAnnouncement,
  pauseAnnouncement,
  resumeAnnouncement,
  archiveAnnouncement,
  duplicateAnnouncement,
  deleteAnnouncement,
  getActiveForUser,
  getActivePlatformOnlyForUser,
  getAudienceOptions,
  recordView,
  recordDismiss,
  recordAcknowledge,
  recordCtaClick,
  toViewModel,
  isInActiveWindow,
};
