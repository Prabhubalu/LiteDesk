'use strict';

const { blocksToPlainText } = require('./contentStudioBlockRenderer');
const { getAssetById } = require('../contentPlatform/contentAssetService');
const { resolveStudioAsset } = require('./resolveStudioAsset');

const CONTENT_STUDIO_SUBTITLE_SIZES = new Set(['sm', 'md', 'lg', 'xl']);

function resolveFileUrlBase(publicAppBaseUrl) {
  const { getPublicFileBaseUrl, isNonFileServingOrigin } = require('./contentPublishingService');
  const preferred = String(publicAppBaseUrl || '').trim().replace(/\/$/, '');
  if (preferred && !isNonFileServingOrigin(preferred)) return preferred;
  return getPublicFileBaseUrl({ requestOrigin: preferred }) || preferred;
}

function isManagedFilePath(pathname) {
  const path = String(pathname || '');
  return path.startsWith('/api/files/download') || path.startsWith('/api/uploads/');
}

function absolutizePublicAssetUrl(url, publicAppBaseUrl) {
  const raw = String(url || '').trim();
  if (!raw) return raw;
  if (raw.startsWith('data:')) return raw;

  const base = resolveFileUrlBase(publicAppBaseUrl);

  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    try {
      const parsed = new URL(raw);
      if (isManagedFilePath(parsed.pathname) && base) {
        const { isNonFileServingOrigin } = require('./contentPublishingService');
        if (isNonFileServingOrigin(parsed.origin)) {
          return `${base}${parsed.pathname}${parsed.search}`;
        }
      }
    } catch {
      // keep raw
    }
    return raw;
  }

  if (!base) return raw;
  if (raw.startsWith('/')) {
    return `${base}${raw}`;
  }
  return raw;
}

function absolutizePublicAssetUrlsInHtml(html, publicAppBaseUrl) {
  if (!html) return html;
  const base = resolveFileUrlBase(publicAppBaseUrl);
  if (!base) return html;
  return String(html).replace(
    /(\s(?:src|href)=["'])(\/api\/(?:files\/download|uploads)[^"']*)(["'])/gi,
    (_match, prefix, path, suffix) => `${prefix}${base}${path}${suffix}`,
  );
}

function normalizeHeadlessPresentation(presentation) {
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
  const subtitleSize = CONTENT_STUDIO_SUBTITLE_SIZES.has(presentation.subtitleSize)
    ? presentation.subtitleSize
    : 'md';
  return {
    coverPosition,
    titleOverlapCover: coverPosition === 'above-title' && Boolean(presentation.titleOverlapCover),
    subtitleSize,
    headingColor: String(presentation.headingColor || '').trim(),
    subheadingColor: String(presentation.subheadingColor || '').trim(),
  };
}

function shapeHeadlessArticleSummary(doc, collectionMeta = null) {
  const collectionId = doc.collectionId ? String(doc.collectionId) : null;
  const meta = collectionMeta || null;
  return {
    id: String(doc._id),
    title: doc.title,
    slug: doc.slug,
    summary: doc.summary || doc.subtitle || '',
    updatedAt: doc.updatedAt,
    publishedAt: doc.publishedAt,
    featured: Boolean(doc.featured),
    sticky: Boolean(doc.sticky),
    tags: Array.isArray(doc.tags) ? doc.tags : [],
    readingTimeMinutes: Number.isFinite(Number(doc.readingTimeMinutes))
      ? Number(doc.readingTimeMinutes)
      : null,
    collectionId,
    collectionSlug: meta?.slug || null,
    collectionName: meta?.name || null,
  };
}

async function resolveCoverImage(doc, publicAppBaseUrl = '') {
  if (!doc?.coverAssetId) return null;
  const asset = await resolveStudioAsset({
    organizationId: doc.organizationId,
    assetId: doc.coverAssetId,
    addonKey: doc.addonKey,
  });
  if (!asset?.downloadUrl) return null;
  return {
    url: absolutizePublicAssetUrl(asset.downloadUrl, publicAppBaseUrl),
    alt: String(asset.accessibilityAltText || '').trim(),
    width: asset.width || null,
    height: asset.height || null,
  };
}

async function shapeHeadlessSeo(seo, organizationId, publicAppBaseUrl = '') {
  const source = seo && typeof seo === 'object' ? seo : {};
  const shaped = {
    metaTitle: String(source.metaTitle || '').trim(),
    metaDescription: String(source.metaDescription || '').trim(),
    canonicalUrl: String(source.canonicalUrl || '').trim(),
    robots: String(source.robots || '').trim(),
    ogImageUrl: '',
  };

  if (source.ogImageAssetId && organizationId) {
    try {
      const asset = await getAssetById({
        organizationId,
        assetId: source.ogImageAssetId,
      });
      shaped.ogImageUrl = absolutizePublicAssetUrl(asset.downloadUrl || '', publicAppBaseUrl);
    } catch {
      shaped.ogImageUrl = '';
    }
  }

  return shaped;
}

async function resolveAssetUrlsInBlocks(blocks, organizationId, publicAppBaseUrl = '') {
  if (!blocks || typeof blocks !== 'object') return null;

  async function walk(node) {
    if (!node || typeof node !== 'object') return node;
    if (Array.isArray(node)) {
      return Promise.all(node.map((entry) => walk(entry)));
    }

    const result = { ...node };
    if (result.attrs && typeof result.attrs === 'object') {
      const attrs = { ...result.attrs };
      const assetId = attrs.assetId || attrs.contentAssetId;
      if (assetId && organizationId) {
        try {
          const asset = await getAssetById({ organizationId, assetId });
          if (asset.downloadUrl && !attrs.src) {
            attrs.src = asset.downloadUrl;
          }
          if (asset.accessibilityAltText && !attrs.alt) {
            attrs.alt = asset.accessibilityAltText;
          }
        } catch {
          // Keep existing attrs when asset lookup fails.
        }
      }
      if (attrs.src) {
        attrs.src = absolutizePublicAssetUrl(attrs.src, publicAppBaseUrl);
      }
      if (attrs.imageUrl) {
        attrs.imageUrl = absolutizePublicAssetUrl(attrs.imageUrl, publicAppBaseUrl);
      }
      delete attrs.assetId;
      delete attrs.contentAssetId;
      result.attrs = attrs;
    }

    if (Array.isArray(result.content)) {
      result.content = await Promise.all(result.content.map((entry) => walk(entry)));
    }

    return result;
  }

  return walk(blocks);
}

function estimateReadMinutes(text) {
  const words = String(text || '').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

async function shapeHeadlessArticleDetail(doc, {
  blocks,
  authorName = '',
  authorAvatar = '',
  collectionName = '',
  collectionMeta = null,
  publicAppBaseUrl = '',
}) {
  const resolvedBlocks = blocks
    ? await resolveAssetUrlsInBlocks(blocks, doc.organizationId, publicAppBaseUrl)
    : null;
  const plainText = resolvedBlocks
    ? blocksToPlainText(resolvedBlocks)
    : String(doc.searchText || doc.summary || '');
  const readSource = [doc.title, doc.subtitle, plainText].filter(Boolean).join(' ');
  const meta = collectionMeta || null;

  return {
    ...shapeHeadlessArticleSummary(doc, meta),
    subtitle: doc.subtitle || '',
    seo: await shapeHeadlessSeo(doc.seo, doc.organizationId, publicAppBaseUrl),
    coverImage: await resolveCoverImage(doc, publicAppBaseUrl),
    authorName,
    authorAvatar: absolutizePublicAssetUrl(String(authorAvatar || '').trim(), publicAppBaseUrl),
    collectionName: collectionName || meta?.name || '',
    readMinutes: Number.isFinite(Number(doc.readingTimeMinutes))
      ? Number(doc.readingTimeMinutes)
      : estimateReadMinutes(readSource),
    readingTimeMinutes: Number.isFinite(Number(doc.readingTimeMinutes))
      ? Number(doc.readingTimeMinutes)
      : estimateReadMinutes(readSource),
    plainText,
    presentation: normalizeHeadlessPresentation(doc.presentation),
    blocks: resolvedBlocks,
  };
}

module.exports = {
  absolutizePublicAssetUrl,
  absolutizePublicAssetUrlsInHtml,
  resolveCoverImage,
  shapeHeadlessArticleSummary,
  shapeHeadlessArticleDetail,
  shapeHeadlessSeo,
  resolveAssetUrlsInBlocks,
  resolveCoverImage,
};
