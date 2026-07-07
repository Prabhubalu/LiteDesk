'use strict';

const ContentDocument = require('../../models/ContentDocument');
const ContentDocumentVersion = require('../../models/ContentDocumentVersion');
const { getAssetById } = require('../contentPlatform/contentAssetService');
const {
  CONTENT_TYPE_BY_ADDON,
  APP_KEY_BY_ADDON,
  CONTENT_STUDIO_SUBTITLE_SIZES,
} = require('../../constants/contentStudioConstants');
const { normalizeAddonKey } = require('../../constants/addonKeys');
const {
  assertValidBlockDocument,
  createEmptyBlockDocument,
} = require('./contentBlockValidationService');
const { blocksToPlainText } = require('./contentStudioBlockRenderer');

class ContentStudioError extends Error {
  constructor(message, { code = 'CONTENT_STUDIO_ERROR', statusCode = 400 } = {}) {
    super(message);
    this.name = 'ContentStudioError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

function notDeletedFilter() {
  return { deletedAt: null };
}

function slugifyTitle(title) {
  return String(title || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'untitled';
}

async function ensureUniqueSlug({ organizationId, contentType, slug, excludeId = null }) {
  const base = slugifyTitle(slug);
  let candidate = base;
  let suffix = 1;

  while (true) {
    const query = {
      organizationId,
      contentType,
      slug: candidate,
      ...notDeletedFilter(),
    };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }
    const existing = await ContentDocument.findOne(query).select('_id').lean();
    if (!existing) {
      return candidate;
    }
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
}

function normalizeArticleColor(value) {
  const raw = String(value || '').trim();
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) return '';
  const normalized = raw.toLowerCase();
  if (normalized.length === 4) {
    return `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`;
  }
  return normalized;
}

function normalizePresentation(presentation) {
  const defaults = {
    coverPosition: 'below-title',
    titleOverlapCover: false,
    subtitleSize: 'md',
    headingColor: '',
    subheadingColor: '',
  };
  if (!presentation || typeof presentation !== 'object') {
    return defaults;
  }
  const coverPosition = presentation.coverPosition === 'above-title' ? 'above-title' : 'below-title';
  const subtitleSize = CONTENT_STUDIO_SUBTITLE_SIZES.includes(presentation.subtitleSize)
    ? presentation.subtitleSize
    : 'md';
  const titleOverlapCover = coverPosition === 'above-title' && Boolean(presentation.titleOverlapCover);
  return {
    coverPosition,
    titleOverlapCover,
    subtitleSize,
    headingColor: normalizeArticleColor(presentation.headingColor),
    subheadingColor: normalizeArticleColor(presentation.subheadingColor),
  };
}

function resolveAddonContext(addonKey) {
  const normalized = normalizeAddonKey(addonKey);
  const contentType = CONTENT_TYPE_BY_ADDON[normalized];
  const appKey = APP_KEY_BY_ADDON[normalized];
  if (!contentType || !appKey) {
    throw new ContentStudioError('Unsupported content addon', {
      code: 'INVALID_ADDON',
      statusCode: 400,
    });
  }
  return { addonKey: normalized, contentType, appKey };
}

function serializeContentDocument(doc, version = null) {
  const row = doc?.toObject ? doc.toObject() : doc;
  return {
    ...row,
    currentVersion: version
      ? {
          _id: version._id,
          version: version.version,
          blocks: version.blocks,
          publishStatus: version.publishStatus,
          createdAt: version.createdAt,
        }
      : null,
  };
}

async function listContentDocuments({
  organizationId,
  addonKey,
  status,
  page = 1,
  limit = 25,
  search,
  collectionId,
  visibility,
}) {
  const { contentType } = resolveAddonContext(addonKey);
  const query = {
    organizationId,
    addonKey: normalizeAddonKey(addonKey),
    contentType,
    ...notDeletedFilter(),
  };

  if (status) {
    query.status = status;
  }

  if (search) {
    const pattern = new RegExp(String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    query.$or = [{ title: pattern }, { summary: pattern }, { slug: pattern }, { subtitle: pattern }, { searchText: pattern }];
  }

  if (collectionId) {
    query.collectionId = collectionId;
  }

  if (visibility) {
    query.visibility = visibility;
  }

  const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 100);
  const safePage = Math.max(Number(page) || 1, 1);
  const skip = (safePage - 1) * safeLimit;

  const [items, total] = await Promise.all([
    ContentDocument.find(query)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    ContentDocument.countDocuments(query),
  ]);

  return {
    items,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      pages: Math.ceil(total / safeLimit) || 1,
    },
  };
}

async function getContentDocumentById({ organizationId, id }) {
  const doc = await ContentDocument.findOne({
    _id: id,
    organizationId,
    ...notDeletedFilter(),
  }).lean();

  if (!doc) {
    throw new ContentStudioError('Content document not found', {
      code: 'NOT_FOUND',
      statusCode: 404,
    });
  }

  let version = null;
  if (doc.currentVersionId) {
    version = await ContentDocumentVersion.findOne({
      _id: doc.currentVersionId,
      organizationId,
    }).lean();
  }

  return attachCoverImageUrl(doc, version);
}

async function attachCoverImageUrl(doc, version = null) {
  const row = serializeContentDocument(doc, version);
  if (!row.coverAssetId) {
    return { ...row, coverImageUrl: null };
  }
  try {
    const asset = await getAssetById({
      organizationId: row.organizationId,
      assetId: row.coverAssetId,
    });
    return { ...row, coverImageUrl: asset.downloadUrl || null };
  } catch {
    return { ...row, coverImageUrl: null };
  }
}

async function createContentDocument({
  organizationId,
  addonKey,
  title,
  slug,
  summary,
  visibility,
  featured,
  blocks,
  collectionId,
  coverAssetId,
  presentation,
  userId,
}) {
  const { addonKey: normalizedAddon, contentType, appKey } = resolveAddonContext(addonKey);
  const safeTitle = String(title || '').trim();
  if (!safeTitle) {
    throw new ContentStudioError('Title is required', { code: 'TITLE_REQUIRED' });
  }

  const blockDocument = assertValidBlockDocument(blocks || createEmptyBlockDocument());
  const uniqueSlug = await ensureUniqueSlug({
    organizationId,
    contentType,
    slug: slug || safeTitle,
  });

  let resolvedCollectionId = collectionId || null;
  let resolvedPresentation = presentation;
  if (normalizedAddon === 'articles') {
    const { getArticlesAddonSettings } = require('./articlesAddonSettingsService');
    const { defaultPresentationFromAppearance } = require('./articlesAppearanceService');
    const { settings } = await getArticlesAddonSettings(organizationId);
    if (!resolvedCollectionId) {
      resolvedCollectionId = settings?.defaultCollectionId || null;
    }
    if (!resolvedPresentation) {
      resolvedPresentation = defaultPresentationFromAppearance(settings.appearance);
    }
  }

  const contentDocument = await ContentDocument.create({
    organizationId,
    addonKey: normalizedAddon,
    appKey,
    contentType,
    title: safeTitle,
    slug: uniqueSlug,
    summary: String(summary || '').trim(),
    visibility: visibility || (normalizedAddon === 'articles' ? 'portal' : 'internal'),
    featured: Boolean(featured),
    status: 'draft',
    collectionId: resolvedCollectionId,
    coverAssetId: coverAssetId || null,
    presentation: normalizePresentation(resolvedPresentation),
    latestVersion: 1,
    authorId: userId || null,
    createdBy: userId || null,
    updatedBy: userId || null,
  });

  const version = await ContentDocumentVersion.create({
    organizationId,
    contentDocumentId: contentDocument._id,
    version: 1,
    document: { blocks: blockDocument },
    blocks: blockDocument,
    publishStatus: 'draft',
    createdBy: userId || null,
  });

  contentDocument.currentVersionId = version._id;
  await contentDocument.save();

  return getContentDocumentById({
    organizationId,
    id: contentDocument._id,
  });
}

async function saveContentDocumentDraft({
  organizationId,
  id,
  title,
  subtitle,
  summary,
  slug,
  visibility,
  featured,
  blocks,
  seo,
  collectionId,
  coverAssetId,
  presentation,
  userId,
}) {
  const doc = await ContentDocument.findOne({
    _id: id,
    organizationId,
    ...notDeletedFilter(),
  });

  if (!doc) {
    throw new ContentStudioError('Content document not found', {
      code: 'NOT_FOUND',
      statusCode: 404,
    });
  }

  if (title !== undefined) {
    const safeTitle = String(title).trim();
    if (!safeTitle) {
      throw new ContentStudioError('Title is required', { code: 'TITLE_REQUIRED' });
    }
    doc.title = safeTitle;
  }

  if (subtitle !== undefined) doc.subtitle = String(subtitle || '').trim();
  if (summary !== undefined) doc.summary = String(summary || '').trim();
  if (visibility !== undefined) doc.visibility = visibility;
  if (featured !== undefined) doc.featured = Boolean(featured);
  if (collectionId !== undefined) doc.collectionId = collectionId || null;
  if (coverAssetId !== undefined) doc.coverAssetId = coverAssetId || null;
  if (presentation !== undefined) {
    doc.presentation = normalizePresentation({ ...(doc.presentation || {}), ...presentation });
  }

  if (slug !== undefined) {
    doc.slug = await ensureUniqueSlug({
      organizationId,
      contentType: doc.contentType,
      slug,
      excludeId: doc._id,
    });
  }

  if (seo && typeof seo === 'object') {
    doc.seo = { ...(doc.seo || {}), ...seo };
  }

  let version = null;
  if (blocks !== undefined) {
    const blockDocument = assertValidBlockDocument(blocks);
    const nextVersionNumber = (doc.latestVersion || 0) + 1;
    version = await ContentDocumentVersion.create({
      organizationId,
      contentDocumentId: doc._id,
      version: nextVersionNumber,
      document: { blocks: blockDocument },
      blocks: blockDocument,
      publishStatus: 'draft',
      createdBy: userId || null,
    });
    doc.latestVersion = nextVersionNumber;
    doc.currentVersionId = version._id;
  }

  doc.updatedBy = userId || null;
  await doc.save();

  if (!version && doc.currentVersionId) {
    version = await ContentDocumentVersion.findById(doc.currentVersionId).lean();
  }

  return serializeContentDocument(doc.toObject(), version);
}

async function publishContentDocument({ organizationId, id, userId }) {
  const doc = await ContentDocument.findOne({
    _id: id,
    organizationId,
    ...notDeletedFilter(),
  });

  if (!doc) {
    throw new ContentStudioError('Content document not found', {
      code: 'NOT_FOUND',
      statusCode: 404,
    });
  }

  if (!doc.currentVersionId) {
    throw new ContentStudioError('No draft version to publish', {
      code: 'NO_DRAFT_VERSION',
    });
  }

  const version = await ContentDocumentVersion.findOne({
    _id: doc.currentVersionId,
    organizationId,
    contentDocumentId: doc._id,
  });

  if (!version) {
    throw new ContentStudioError('Draft version not found', {
      code: 'NO_DRAFT_VERSION',
      statusCode: 404,
    });
  }

  version.publishStatus = 'published';
  await version.save();

  const blockText = blocksToPlainText(version.blocks || createEmptyBlockDocument());
  doc.searchText = [doc.title, doc.subtitle, doc.summary, blockText]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join('\n');

  doc.status = 'published';
  doc.publishedVersionId = version._id;
  doc.publishedAt = new Date();
  doc.updatedBy = userId || null;
  await doc.save();

  setImmediate(() => {
    const { emitContentPublishedWebhook } = require('./contentPublishingWebhookService');
    emitContentPublishedWebhook({
      organizationId,
      document: doc.toObject(),
    }).catch((error) => {
      console.error('[contentDocumentService] publish webhook failed', error?.message || error);
    });
  });

  return serializeContentDocument(doc.toObject(), version.toObject());
}

async function unpublishContentDocument({ organizationId, id, userId }) {
  const doc = await ContentDocument.findOne({
    _id: id,
    organizationId,
    ...notDeletedFilter(),
  });

  if (!doc) {
    throw new ContentStudioError('Content document not found', {
      code: 'NOT_FOUND',
      statusCode: 404,
    });
  }

  doc.status = 'draft';
  doc.updatedBy = userId || null;
  await doc.save();

  if (doc.addonKey === 'articles') {
    setImmediate(() => {
      const { emitContentUnpublishedWebhook } = require('./contentPublishingWebhookService');
      emitContentUnpublishedWebhook({
        organizationId,
        document: doc.toObject(),
      }).catch((error) => {
        console.error('[contentDocumentService] unpublish webhook failed', error?.message || error);
      });
    });
  }

  return getContentDocumentById({ organizationId, id: doc._id });
}

async function archiveContentDocument({ organizationId, id, userId }) {
  const doc = await ContentDocument.findOne({
    _id: id,
    organizationId,
    ...notDeletedFilter(),
  });

  if (!doc) {
    throw new ContentStudioError('Content document not found', {
      code: 'NOT_FOUND',
      statusCode: 404,
    });
  }

  doc.status = 'archived';
  doc.archivedAt = new Date();
  doc.updatedBy = userId || null;
  await doc.save();

  return getContentDocumentById({ organizationId, id: doc._id });
}

async function deleteContentDocument({ organizationId, id, userId }) {
  const doc = await ContentDocument.findOne({
    _id: id,
    organizationId,
    ...notDeletedFilter(),
  });

  if (!doc) {
    throw new ContentStudioError('Content document not found', {
      code: 'NOT_FOUND',
      statusCode: 404,
    });
  }

  doc.deletedAt = new Date();
  doc.updatedBy = userId || null;
  await doc.save();

  return { _id: doc._id, deleted: true };
}

async function searchAgentKnowledgeArticles({ organizationId, query, limit = 5 }) {
  const { isArticlesCaseDeflectionEnabled } = require('./articlesAddonSettingsService');
  const deflectionEnabled = await isArticlesCaseDeflectionEnabled(organizationId);
  if (!deflectionEnabled) {
    return [];
  }

  const searchTerm = String(query || '').trim();
  if (searchTerm.length < 2) {
    return [];
  }

  const pattern = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const rows = await ContentDocument.find({
    organizationId,
    addonKey: 'articles',
    contentType: 'knowledge_article',
    status: 'published',
    deletedAt: null,
    visibility: { $in: ['portal', 'public', 'internal'] },
    $or: [{ title: pattern }, { summary: pattern }, { subtitle: pattern }, { searchText: pattern }],
  })
    .select('title summary subtitle slug visibility status updatedAt')
    .sort({ updatedAt: -1 })
    .limit(Math.min(Math.max(Number(limit) || 5, 1), 20))
    .lean();

  return rows.map((row) => ({
    _id: row._id,
    title: row.title,
    description: row.summary || row.subtitle || '',
    slug: row.slug,
    visibility: row.visibility,
    updatedAt: row.updatedAt,
    source: 'content_studio',
  }));
}

async function getBlockRegistry() {
  const { CONTENT_STUDIO_BLOCK_TYPES } = require('../../constants/contentStudioConstants');
  return CONTENT_STUDIO_BLOCK_TYPES.map((type) => ({
    type,
    category: getBlockCategory(type),
  }));
}

function getBlockCategory(type) {
  const kbBlocks = new Set(['steps', 'faq', 'related_articles']);
  const blogBlocks = new Set(['hero', 'cta', 'testimonial', 'stats', 'newsletter_signup']);
  if (kbBlocks.has(type)) return 'knowledge_base';
  if (blogBlocks.has(type)) return 'marketing';
  if (['image', 'embed'].includes(type)) return 'media';
  if (['heading', 'paragraph', 'quote', 'list', 'checklist', 'code', 'table'].includes(type)) {
    return 'basic';
  }
  return 'layout';
}

module.exports = {
  ContentStudioError,
  listContentDocuments,
  getContentDocumentById,
  createContentDocument,
  saveContentDocumentDraft,
  publishContentDocument,
  unpublishContentDocument,
  archiveContentDocument,
  deleteContentDocument,
  searchAgentKnowledgeArticles,
  getBlockRegistry,
  slugifyTitle,
};
