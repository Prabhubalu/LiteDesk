'use strict';

const mongoose = require('mongoose');
const ReleaseNote = require('../models/ReleaseNote');
const ReleaseNoteItem = require('../models/ReleaseNoteItem');
const UserReleaseView = require('../models/UserReleaseView');
const UserReleaseSnooze = require('../models/UserReleaseSnooze');
const Organization = require('../models/Organization');
const User = require('../models/User');
const {
  IMPORTANCE_RANK,
  UNSEEN_MAX_RELEASES,
  UNSEEN_LOOKBACK_DAYS,
  VIEW_BATCH_MAX_IDS,
  STATS_CACHE_MS,
  RELEASE_NOTE_VIEW_SOURCES
} = require('../constants/releaseNoteConstants');
const {
  userMatchesReleaseTargeting,
  buildTargetedOrganizationQuery,
  buildTargetedUserQuery
} = require('./releaseNoteTargetingService');
const { markdownToHtml } = require('../utils/releaseNoteMarkdown');
const {
  validateReleaseNotePayload,
  validateReleaseNoteItems,
  validateCtaUrl,
  validateImageUrl
} = require('../middleware/releaseNoteValidation');

const statsCache = new Map();

class ReleaseNoteServiceError extends Error {
  constructor(message, { statusCode = 400, code = 'RELEASE_NOTE_ERROR' } = {}) {
    super(message);
    this.name = 'ReleaseNoteServiceError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

function clearStatsCache(releaseNoteId) {
  if (releaseNoteId) {
    statsCache.delete(String(releaseNoteId));
  }
}

function normalizeSlug(slug) {
  return String(slug || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function serializeItem(item) {
  const description = item.description || '';
  return {
    id: String(item._id),
    type: item.type,
    title: item.title,
    description,
    descriptionHtml: markdownToHtml(description),
    imageUrl: item.imageUrl || null,
    ctaLabel: item.ctaLabel || null,
    ctaUrl: item.ctaUrl || null,
    sortOrder: item.sortOrder ?? 0
  };
}

function serializeRelease(release, items = []) {
  return {
    id: String(release._id),
    version: release.version,
    slug: release.slug,
    title: release.title,
    summary: release.summary,
    importance: release.importance,
    status: release.status,
    targetApps: release.targetApps || [],
    targetPlans: release.targetPlans || [],
    badgeExpiresAt: release.badgeExpiresAt || null,
    scheduledPublishAt: release.scheduledPublishAt || null,
    publishedAt: release.publishedAt || null,
    publishedBy: release.publishedBy ? String(release.publishedBy) : null,
    createdBy: release.createdBy ? String(release.createdBy) : null,
    createdAt: release.createdAt,
    updatedAt: release.updatedAt,
    items: items.map(serializeItem)
  };
}

function computeCombinedImportance(releases) {
  let max = 0;
  let label = 'patch';
  for (const release of releases) {
    const rank = IMPORTANCE_RANK[release.importance] || 0;
    if (rank > max) {
      max = rank;
      label = release.importance;
    }
  }
  return label;
}

function computeSurface(combinedImportance) {
  if (combinedImportance === 'major') return 'modal';
  if (combinedImportance === 'minor' || combinedImportance === 'patch') return 'drawer';
  return 'badge_only';
}

function toUserObjectId(userId) {
  if (!userId) return userId;
  const value = String(userId);
  if (mongoose.Types.ObjectId.isValid(value)) {
    return new mongoose.Types.ObjectId(value);
  }
  return userId;
}

async function loadOrganizationForUser(user) {
  if (!user?.organizationId) return null;
  return Organization.findById(user.organizationId).lean();
}

async function getViewedReleaseIds(userId) {
  const views = await UserReleaseView.find({ userId: toUserObjectId(userId) }).select('releaseNoteId').lean();
  return views.map((v) => v.releaseNoteId);
}

async function isUserSnoozed(userId, { releases = [] } = {}) {
  const snooze = await UserReleaseSnooze.findOne({ userId: toUserObjectId(userId) }).lean();
  if (!snooze?.snoozedUntil) return false;
  if (new Date(snooze.snoozedUntil) <= new Date()) return false;

  const snoozedAt = snooze.createdAt ? new Date(snooze.createdAt) : null;
  if (snoozedAt && releases.length) {
    const hasReleaseAfterSnooze = releases.some((release) => {
      if (!release?.publishedAt) return false;
      return new Date(release.publishedAt) > snoozedAt;
    });
    if (hasReleaseAfterSnooze) return false;
  }

  return true;
}

async function loadItemsByReleaseIds(releaseIds) {
  if (!releaseIds.length) return new Map();
  const items = await ReleaseNoteItem.find({ releaseNoteId: { $in: releaseIds } })
    .sort({ sortOrder: 1, createdAt: 1 })
    .lean();
  const map = new Map();
  for (const item of items) {
    const key = String(item.releaseNoteId);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

async function filterTargetedReleases(releases, user, organization, { bypassTargeting = false } = {}) {
  if (bypassTargeting) return releases;
  return releases.filter((release) => userMatchesReleaseTargeting({ user, organization, releaseNote: release }));
}

async function listPublishedCandidates({ excludeIds = [], lookbackDays = UNSEEN_LOOKBACK_DAYS } = {}) {
  const lookback = new Date();
  lookback.setDate(lookback.getDate() - lookbackDays);
  const now = new Date();

  return ReleaseNote.find({
    status: 'published',
    publishedAt: { $lte: now, $gte: lookback },
    _id: { $nin: excludeIds }
  })
    .sort({ publishedAt: 1 })
    .lean();
}

async function getUnseenForUser(user) {
  const organization = await loadOrganizationForUser(user);
  const viewedIds = await getViewedReleaseIds(user._id);
  const candidates = await listPublishedCandidates({ excludeIds: viewedIds });
  const targeted = await filterTargetedReleases(candidates, user, organization);
  const releases = targeted.slice(0, UNSEEN_MAX_RELEASES);
  const snoozed = await isUserSnoozed(user._id, { releases });

  const itemMap = await loadItemsByReleaseIds(releases.map((r) => r._id));
  const serialized = releases.map((release) =>
    serializeRelease(release, itemMap.get(String(release._id)) || [])
  );

  const combinedImportance = computeCombinedImportance(releases);
  return {
    releases: serialized,
    surface: snoozed ? 'badge_only' : computeSurface(combinedImportance),
    combinedImportance,
    snoozed
  };
}

async function getBadgeForUser(user) {
  const { releases, combinedImportance } = await getUnseenForUser(user);
  return {
    count: releases.length,
    highestImportance: combinedImportance
  };
}

async function getHistoryForUser(user, { page = 1, limit = 20 } = {}) {
  const organization = await loadOrganizationForUser(user);
  const bypassTargeting = user.isPlatformAdmin === true;
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(50, Math.max(1, Number(limit) || 20));

  const candidates = await ReleaseNote.find({
    status: 'published',
    publishedAt: { $lte: new Date() }
  })
    .sort({ publishedAt: -1 })
    .lean();

  const targeted = await filterTargetedReleases(candidates, user, organization, { bypassTargeting });
  const total = targeted.length;
  const start = (safePage - 1) * safeLimit;
  const pageReleases = targeted.slice(start, start + safeLimit);
  const itemMap = await loadItemsByReleaseIds(pageReleases.map((r) => r._id));

  return {
    releases: pageReleases.map((release) =>
      serializeRelease(release, itemMap.get(String(release._id)) || [])
    ),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      pages: Math.ceil(total / safeLimit) || 1
    }
  };
}

function assertValidViewSource(source) {
  if (!source) return 'help_center';
  if (!RELEASE_NOTE_VIEW_SOURCES.includes(source)) {
    throw new ReleaseNoteServiceError('Invalid view source', { code: 'VALIDATION_ERROR' });
  }
  return source;
}

async function markViewed(userId, releaseNoteId, source) {
  const release = await ReleaseNote.findById(releaseNoteId).lean();
  if (!release || release.status !== 'published') {
    throw new ReleaseNoteServiceError('Release note not found', { statusCode: 404 });
  }

  const safeSource = assertValidViewSource(source);
  const userObjectId = toUserObjectId(userId);
  await UserReleaseView.findOneAndUpdate(
    { userId: userObjectId, releaseNoteId },
    { $set: { viewedAt: new Date(), source: safeSource } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  clearStatsCache(releaseNoteId);
  return { ok: true };
}

async function markViewedBatch(userId, releaseNoteIds, source) {
  const ids = [...new Set((releaseNoteIds || []).map(String))].filter(Boolean);
  if (!ids.length) {
    throw new ReleaseNoteServiceError('releaseNoteIds is required', { code: 'VALIDATION_ERROR' });
  }
  if (ids.length > VIEW_BATCH_MAX_IDS) {
    throw new ReleaseNoteServiceError(`Maximum ${VIEW_BATCH_MAX_IDS} release IDs per batch`, {
      code: 'VALIDATION_ERROR'
    });
  }

  const objectIds = ids.map((id) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ReleaseNoteServiceError(`Invalid release note id: ${id}`, { code: 'VALIDATION_ERROR' });
    }
    return new mongoose.Types.ObjectId(id);
  });

  const published = await ReleaseNote.find({
    _id: { $in: objectIds },
    status: 'published'
  }).select('_id').lean();

  const safeSource = assertValidViewSource(source);
  const now = new Date();
  const userObjectId = toUserObjectId(userId);
  const ops = published.map((release) => ({
    updateOne: {
      filter: { userId: userObjectId, releaseNoteId: release._id },
      update: { $set: { viewedAt: now, source: safeSource } },
      upsert: true
    }
  }));

  if (ops.length) {
    await UserReleaseView.bulkWrite(ops, { ordered: false });
    for (const release of published) clearStatsCache(release._id);
  }

  return { updated: ops.length };
}

async function snoozeUser(userId, hours = 24) {
  const safeHours = Math.min(168, Math.max(1, Number(hours) || 24));
  const snoozedUntil = new Date(Date.now() + safeHours * 60 * 60 * 1000);
  await UserReleaseSnooze.findOneAndUpdate(
    { userId: toUserObjectId(userId) },
    { $set: { snoozedUntil } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return { snoozedUntil };
}

async function replaceItems(releaseNoteId, items) {
  validateReleaseNoteItems(items);
  await ReleaseNoteItem.deleteMany({ releaseNoteId });
  if (!items?.length) return [];

  const docs = items.map((item, index) => {
    if (item.imageUrl) validateImageUrl(item.imageUrl);
    if (item.ctaUrl) validateCtaUrl(item.ctaUrl);
    return {
      releaseNoteId,
      type: item.type,
      title: item.title,
      description: (item.description || '').trim(),
      imageUrl: item.imageUrl || null,
      ctaLabel: item.ctaLabel || null,
      ctaUrl: item.ctaUrl || null,
      sortOrder: item.sortOrder ?? index
    };
  });

  return ReleaseNoteItem.insertMany(docs);
}

async function getReleaseWithItems(releaseNoteId) {
  const release = await ReleaseNote.findById(releaseNoteId).lean();
  if (!release) return null;
  const items = await ReleaseNoteItem.find({ releaseNoteId }).sort({ sortOrder: 1, createdAt: 1 }).lean();
  return serializeRelease(release, items);
}

async function listPlatformNotes({ status, page = 1, limit = 20 } = {}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const query = {};
  if (status) query.status = status;

  const [total, notes] = await Promise.all([
    ReleaseNote.countDocuments(query),
    ReleaseNote.find(query)
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean()
  ]);

  return {
    releases: notes.map((note) => serializeRelease(note, [])),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      pages: Math.ceil(total / safeLimit) || 1
    }
  };
}

async function createReleaseNote(userId, payload) {
  validateReleaseNotePayload(payload, { isCreate: true });
  const slug = normalizeSlug(payload.slug || payload.version || payload.title);
  const existing = await ReleaseNote.findOne({ slug }).select('_id').lean();
  if (existing) {
    throw new ReleaseNoteServiceError('Slug already exists', { code: 'VALIDATION_ERROR' });
  }

  const release = await ReleaseNote.create({
    version: payload.version.trim(),
    slug,
    title: payload.title.trim(),
    summary: (payload.summary || '').trim(),
    importance: payload.importance,
    status: 'draft',
    targetApps: payload.targetApps || [],
    targetPlans: payload.targetPlans || [],
    badgeExpiresAt: payload.badgeExpiresAt || null,
    createdBy: userId
  });

  const items = await replaceItems(release._id, payload.items || []);
  return serializeRelease(release.toObject(), items);
}

async function updateReleaseNote(releaseNoteId, payload) {
  const release = await ReleaseNote.findById(releaseNoteId);
  if (!release) {
    throw new ReleaseNoteServiceError('Release note not found', { statusCode: 404 });
  }
  if (release.status === 'published' || release.status === 'archived') {
    throw new ReleaseNoteServiceError('Published releases cannot be edited; archive and create a new release', {
      code: 'VALIDATION_ERROR',
      statusCode: 409
    });
  }

  validateReleaseNotePayload(payload, { isCreate: false });

  if (payload.slug) {
    const slug = normalizeSlug(payload.slug);
    const conflict = await ReleaseNote.findOne({ slug, _id: { $ne: release._id } }).select('_id').lean();
    if (conflict) {
      throw new ReleaseNoteServiceError('Slug already exists', { code: 'VALIDATION_ERROR' });
    }
    release.slug = slug;
  }

  if (payload.version !== undefined) release.version = payload.version.trim();
  if (payload.title !== undefined) release.title = payload.title.trim();
  if (payload.summary !== undefined) release.summary = (payload.summary || '').trim();
  if (payload.importance !== undefined) release.importance = payload.importance;
  if (payload.targetApps !== undefined) release.targetApps = payload.targetApps;
  if (payload.targetPlans !== undefined) release.targetPlans = payload.targetPlans;
  if (payload.badgeExpiresAt !== undefined) release.badgeExpiresAt = payload.badgeExpiresAt;

  await release.save();

  let items;
  if (payload.items !== undefined) {
    items = await replaceItems(release._id, payload.items);
  } else {
    items = await ReleaseNoteItem.find({ releaseNoteId: release._id }).sort({ sortOrder: 1 }).lean();
  }

  return serializeRelease(release.toObject(), items);
}

async function publishReleaseNote(releaseNoteId, userId) {
  const release = await ReleaseNote.findById(releaseNoteId);
  if (!release) {
    throw new ReleaseNoteServiceError('Release note not found', { statusCode: 404 });
  }
  if (release.status === 'published') {
    throw new ReleaseNoteServiceError('Release is already published', { code: 'VALIDATION_ERROR' });
  }
  if (release.status === 'archived') {
    throw new ReleaseNoteServiceError('Archived releases cannot be published', { code: 'VALIDATION_ERROR' });
  }

  const itemCount = await ReleaseNoteItem.countDocuments({ releaseNoteId: release._id });
  if (!itemCount) {
    throw new ReleaseNoteServiceError('Cannot publish a release without items', { code: 'VALIDATION_ERROR' });
  }

  release.status = 'published';
  release.publishedAt = new Date();
  release.publishedBy = userId;
  release.scheduledPublishAt = null;
  await release.save();
  clearStatsCache(release._id);

  return getReleaseWithItems(release._id);
}

async function scheduleReleaseNote(releaseNoteId, scheduledPublishAt) {
  const release = await ReleaseNote.findById(releaseNoteId);
  if (!release) {
    throw new ReleaseNoteServiceError('Release note not found', { statusCode: 404 });
  }
  if (release.status === 'published' || release.status === 'archived') {
    throw new ReleaseNoteServiceError('Only draft releases can be scheduled', { code: 'VALIDATION_ERROR' });
  }

  const when = new Date(scheduledPublishAt);
  if (Number.isNaN(when.getTime()) || when <= new Date()) {
    throw new ReleaseNoteServiceError('scheduledPublishAt must be a future date', { code: 'VALIDATION_ERROR' });
  }

  const itemCount = await ReleaseNoteItem.countDocuments({ releaseNoteId: release._id });
  if (!itemCount) {
    throw new ReleaseNoteServiceError('Cannot schedule a release without items', { code: 'VALIDATION_ERROR' });
  }

  release.status = 'scheduled';
  release.scheduledPublishAt = when;
  await release.save();
  return getReleaseWithItems(release._id);
}

async function archiveReleaseNote(releaseNoteId) {
  const release = await ReleaseNote.findById(releaseNoteId);
  if (!release) {
    throw new ReleaseNoteServiceError('Release note not found', { statusCode: 404 });
  }
  release.status = 'archived';
  await release.save();
  clearStatsCache(release._id);
  return { id: String(release._id), status: release.status };
}

async function countTargetedUsers(releaseNote) {
  const orgQuery = buildTargetedOrganizationQuery(releaseNote);
  const orgs = await Organization.find(orgQuery).select('_id').lean();
  const organizationIds = orgs.map((org) => org._id);
  if (!organizationIds.length) return 0;

  const userQuery = buildTargetedUserQuery(releaseNote, organizationIds);
  return User.countDocuments(userQuery);
}

async function getAudiencePreview(releaseNoteId) {
  const release = await ReleaseNote.findById(releaseNoteId).lean();
  if (!release) {
    throw new ReleaseNoteServiceError('Release note not found', { statusCode: 404 });
  }
  const targetedUserCount = await countTargetedUsers(release);
  return { releaseNoteId: String(release._id), targetedUserCount };
}

async function getReleaseStats(releaseNoteId) {
  const cacheKey = String(releaseNoteId);
  const cached = statsCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const release = await ReleaseNote.findById(releaseNoteId).lean();
  if (!release) {
    throw new ReleaseNoteServiceError('Release note not found', { statusCode: 404 });
  }
  if (release.status !== 'published' && release.status !== 'archived') {
    throw new ReleaseNoteServiceError('Stats are only available for published or archived releases', {
      code: 'VALIDATION_ERROR'
    });
  }

  const [targetedUserCount, viewedUserCount, viewsBySourceAgg, lastViewed] = await Promise.all([
    countTargetedUsers(release),
    UserReleaseView.countDocuments({ releaseNoteId: release._id }),
    UserReleaseView.aggregate([
      { $match: { releaseNoteId: release._id } },
      { $group: { _id: '$source', count: { $sum: 1 } } }
    ]),
    UserReleaseView.findOne({ releaseNoteId: release._id }).sort({ viewedAt: -1 }).select('viewedAt').lean()
  ]);

  const viewsBySource = {
    auto_modal: 0,
    drawer: 0,
    help_center: 0,
    snooze: 0
  };
  for (const row of viewsBySourceAgg) {
    if (row._id && Object.prototype.hasOwnProperty.call(viewsBySource, row._id)) {
      viewsBySource[row._id] = row.count;
    }
  }

  const data = {
    releaseNoteId: String(release._id),
    targetedUserCount,
    viewedUserCount,
    viewRate: targetedUserCount > 0 ? viewedUserCount / targetedUserCount : 0,
    viewsBySource,
    lastViewedAt: lastViewed?.viewedAt || null
  };

  statsCache.set(cacheKey, { data, expiresAt: Date.now() + STATS_CACHE_MS });
  return data;
}

async function publishDueScheduledReleases() {
  const now = new Date();
  const due = await ReleaseNote.find({
    status: 'scheduled',
    scheduledPublishAt: { $lte: now }
  });

  let published = 0;
  for (const release of due) {
    const itemCount = await ReleaseNoteItem.countDocuments({ releaseNoteId: release._id });
    if (!itemCount) continue;
    release.status = 'published';
    release.publishedAt = now;
    release.publishedBy = release.createdBy;
    release.scheduledPublishAt = null;
    await release.save();
    clearStatsCache(release._id);
    published += 1;
  }
  return { published };
}

module.exports = {
  ReleaseNoteServiceError,
  getUnseenForUser,
  getBadgeForUser,
  getHistoryForUser,
  markViewed,
  markViewedBatch,
  snoozeUser,
  listPlatformNotes,
  getReleaseWithItems,
  createReleaseNote,
  updateReleaseNote,
  publishReleaseNote,
  scheduleReleaseNote,
  archiveReleaseNote,
  getAudiencePreview,
  getReleaseStats,
  publishDueScheduledReleases,
  computeCombinedImportance,
  computeSurface
};
